import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/database.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtService } from '@nestjs/jwt';
import { buildVerificationEmailTemplate } from './onboarding-email.template';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    if (!registerDto.acceptTerms) {
      throw new BadRequestException(
        'É necessário aceitar os Termos de Uso e a Política de Privacidade.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: registerDto.ownerEmail,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Já existe uma conta com este e-mail.');
    }

    const defaultPlan = await this.prisma.plan.findFirst({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: { price: 'asc' },
    });

    if (!defaultPlan) {
      throw new BadRequestException(
        'Nenhum plano ativo disponível para onboarding.',
      );
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: registerDto.officeName,
          email: registerDto.ownerEmail,
        },
      });

      const profile = await tx.profile.create({
        data: {
          name: 'Administrador',
          description:
            'Perfil administrador criado automaticamente no onboarding.',
          permissions: { canManageAll: true, canManageUsers: true },
          tenantId: tenant.id,
        },
      });

      const now = new Date();
      const termsVersion = '2026-04-27';

      const user = await tx.user.create({
        data: {
          name: registerDto.ownerName,
          email: registerDto.ownerEmail,
          password: passwordHash,
          profileId: profile.id,
          tenantId: tenant.id,
          isEmailVerified: false,
          acceptedTermsAt: now,
          acceptedTermsVersion: termsVersion,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: defaultPlan.id,
          status: 'TRIAL',
          trialEndDate,
        },
      });

      const limits = defaultPlan.limits as {
        maxUsers?: number;
        maxContacts?: number;
        maxProcesses?: number;
        maxStorageMB?: number;
      } | null;

      await tx.tenantLimits.create({
        data: {
          tenantId: tenant.id,
          maxUsers: limits?.maxUsers ?? 10,
          maxContacts: limits?.maxContacts ?? 100,
          maxProcesses: limits?.maxProcesses ?? 50,
          maxStorageMB: limits?.maxStorageMB ?? 1024,
          currentUsers: 1,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: verificationToken,
          expiresAt: verificationExpiresAt,
        },
      });

      return { tenant, user };
    });

    const verifyUrl = `${process.env.FRONTEND_URL || 'https://dev.lawmanager.com.br'}/verify-email?token=${verificationToken}`;

    const emailContent = buildVerificationEmailTemplate({
      ownerName: registerDto.ownerName,
      officeName: registerDto.officeName,
      verifyUrl,
    });

    await this.emailService.sendEmail({
      to: registerDto.ownerEmail,
      subject: 'Confirme seu acesso ao Lawmanager',
      text: emailContent.text,
      html: emailContent.html,
    });

    return {
      message:
        'Conta criada com sucesso. Verifique seu e-mail para ativar o acesso.',
      tenantId: result.tenant.id,
      userId: result.user.id,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token: verifyEmailDto.token },
    });

    if (!record) {
      throw new BadRequestException('Token de verificação inválido.');
    }

    if (record.usedAt) {
      throw new BadRequestException('Este token já foi utilizado.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('O token de verificação expirou.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: {
          usedAt: new Date(),
        },
      });
    });

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      include: {
        tenant: true,
        profile: true,
      },
    });

    if (!user || !user.tenant) {
      throw new BadRequestException('Usuário inválido para ativação.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      profileId: user.profileId,
      tenantName: user.tenant.legalName || user.tenant.name,
      tenantCnpj: user.tenant.cnpj || '',
      permissions: (user.profile?.permissions as object | null) ?? {},
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      message: 'E-mail confirmado com sucesso.',
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
    };
  }
}
