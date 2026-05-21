import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginLogService } from '../logs/login-log.service';
import { PrismaService } from 'src/database/database.service';
import { EmailService } from '../email/email.service';
import { MfaService } from './mfa.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { buildPasswordRecoveryEmailTemplate } from './password-recovery-email.template';
import { ResponseUserDto } from '../users/dto/response-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private buildAccessTokenPayload(user: ResponseUserDto) {
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      profileId: user.profileId,
      tenantName: user.tenantName,
      tenantCnpj: user.tenantCnpj,
      permissions: (user.profile?.permissions as object | null) ?? {},
    };
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
    private readonly loginLogService: LoginLogService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly mfaService: MfaService,
  ) {}

  createAccessToken(user: ResponseUserDto): string {
    return this.jwtService.sign(this.buildAccessTokenPayload(user));
  }

  async validate(
    authDto: AuthDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto | { mfaRequired: true; mfaToken: string }> {
    const { email, password } = authDto;
    this.logger.log(`Validating user: ${JSON.stringify(authDto.email)}`);
    let user: ResponseUserDto;
    try {
      user = await this.userService.validateUser(email, password);
    } catch (error) {
      await this.loginLogService.log({
        ipAddress,
        userAgent,
        success: false,
      });
      throw error;
    }

    const flags = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });

    if (flags?.twoFactorEnabled) {
      const mfaToken = this.mfaService.signMfaPendingToken({
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
      });
      return { mfaRequired: true, mfaToken };
    }

    const token = this.createAccessToken(user);

    await this.loginLogService.log({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      success: true,
    });

    return {
      access_token: token,
    };
  }

  async verifyMfa(
    mfaToken: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const pending = this.mfaService.verifyMfaPendingToken(mfaToken);
    await this.mfaService.assertSecondFactorValid(
      pending.sub,
      pending.tenantId,
      code,
    );

    const user = await this.userService.findActiveUserForAuth(
      pending.sub,
      pending.tenantId,
    );

    const token = this.createAccessToken(user);

    await this.loginLogService.log({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      success: true,
    });

    return { access_token: token };
  }

  async getUserEmailForMfa(userId: number): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return { email: user.email };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const genericMessage =
      'Se existir uma conta com este e-mail, enviaremos um link para redefinição de senha.';

    const user = await this.prisma.user.findFirst({
      where: {
        email: forgotPasswordDto.email,
        deletedAt: null,
        isEmailVerified: true,
      },
    });

    if (!user) {
      return { message: genericMessage };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    const emailContent = buildPasswordRecoveryEmailTemplate({
      userName: user.name,
      resetUrl,
    });

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Redefina sua senha no Fluxora',
      text: emailContent.text,
      html: emailContent.html,
    });

    return { message: genericMessage };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const tokenHash = createHash('sha256')
      .update(resetPasswordDto.token)
      .digest('hex');

    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!passwordResetToken) {
      throw new BadRequestException('Token de redefinição inválido.');
    }

    if (passwordResetToken.usedAt) {
      throw new BadRequestException(
        'Este link de redefinição já foi utilizado.',
      );
    }

    if (passwordResetToken.expiresAt < new Date()) {
      throw new BadRequestException('O link de redefinição expirou.');
    }

    const passwordHash = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: passwordResetToken.userId },
        data: {
          password: passwordHash,
        },
      });

      await tx.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: {
          usedAt: new Date(),
        },
      });
    });

    return {
      message:
        'Senha redefinida com sucesso. Você já pode entrar com a nova senha.',
    };
  }
}
