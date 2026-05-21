import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/database/database.service';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { decryptTwoFactorSecret, encryptTwoFactorSecret } from './mfa-crypto';

const MFA_TOKEN_TYPE = 'mfa_pending';
const RECOVERY_CODE_COUNT = 8;

export interface MfaTokenPayload {
  sub: number;
  email: string;
  tenantId: number;
  tokenType: typeof MFA_TOKEN_TYPE;
}

function normalizeTotpCode(code: string): string {
  return code.trim().replace(/\s/g, '');
}

function buildRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const a = randomBytes(4).toString('hex').toUpperCase();
    const b = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${a}-${b}`);
  }
  return codes;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signMfaPendingToken(payload: {
    sub: number;
    email: string;
    tenantId: number;
  }): string {
    return this.jwtService.sign(
      {
        ...payload,
        tokenType: MFA_TOKEN_TYPE,
      },
      { expiresIn: '10m' },
    );
  }

  verifyMfaPendingToken(token: string): MfaTokenPayload {
    try {
      const raw = this.jwtService.verify<MfaTokenPayload & { sub?: unknown }>(
        token,
        {
          secret: process.env.SECRET_KEY,
        },
      );
      if (raw.tokenType !== MFA_TOKEN_TYPE) {
        throw new UnauthorizedException('Token de segunda etapa inválido.');
      }
      const sub = Number(raw.sub);
      const tenantId = Number(raw.tenantId);
      if (isNaN(sub) || isNaN(tenantId)) {
        throw new UnauthorizedException('Token de segunda etapa inválido.');
      }
      return {
        sub,
        tenantId,
        email: String(raw.email),
        tokenType: MFA_TOKEN_TYPE,
      };
    } catch {
      throw new UnauthorizedException(
        'Token de segunda etapa inválido ou expirado.',
      );
    }
  }

  async assertSecondFactorValid(
    userId: number,
    tenantId: number,
    rawCode: string,
  ): Promise<void> {
    const normalized = rawCode.trim().replace(/\s/g, '');
    if (!normalized) {
      throw new UnauthorizedException('Código inválido.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
        twoFactorEnabled: true,
      },
      include: {
        twoFactorRecoveryCodes: {
          where: { usedAt: null },
        },
      },
    });

    if (!user?.twoFactorEncryptedSecret) {
      throw new UnauthorizedException('Autenticação em duas etapas inativa.');
    }

    const secret = decryptTwoFactorSecret(user.twoFactorEncryptedSecret);

    if (/^\d{6}$/.test(normalized)) {
      const result = verifySync({
        secret,
        token: normalized,
        epochTolerance: 30,
      });
      if (result.valid) {
        return;
      }
      throw new UnauthorizedException('Código inválido.');
    }

    for (const row of user.twoFactorRecoveryCodes) {
      const match = await bcrypt.compare(normalized, row.codeHash);
      if (match) {
        await this.prisma.twoFactorRecoveryCode.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        });
        return;
      }
    }

    throw new UnauthorizedException('Código inválido.');
  }

  async getStatus(userId: number): Promise<{
    enabled: boolean;
    pendingSetup: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorEncryptedSecret: true,
      },
    });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    return {
      enabled: user.twoFactorEnabled,
      pendingSetup: !!user.twoFactorEncryptedSecret && !user.twoFactorEnabled,
    };
  }

  async initSetup(
    userId: number,
    email: string,
  ): Promise<{ otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorEncryptedSecret: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('O 2FA já está ativo para esta conta.');
    }

    let secretPlain: string;
    if (user.twoFactorEncryptedSecret) {
      secretPlain = decryptTwoFactorSecret(user.twoFactorEncryptedSecret);
    } else {
      secretPlain = generateSecret();
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEncryptedSecret: encryptTwoFactorSecret(secretPlain),
        },
      });
    }

    const otpauthUrl = generateURI({
      issuer: 'Fluxora',
      label: email,
      secret: secretPlain,
    });

    return { otpauthUrl };
  }

  async confirmSetup(
    userId: number,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const normalized = normalizeTotpCode(code);
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Informe um código TOTP de 6 dígitos.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorEncryptedSecret: true,
      },
    });

    if (!user?.twoFactorEncryptedSecret) {
      throw new BadRequestException(
        'Inicie a configuração em /auth/mfa/setup/init antes de confirmar.',
      );
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('O 2FA já está ativo.');
    }

    const secret = decryptTwoFactorSecret(user.twoFactorEncryptedSecret);
    const result = verifySync({
      secret,
      token: normalized,
      epochTolerance: 30,
    });
    if (!result.valid) {
      throw new UnauthorizedException('Código TOTP inválido.');
    }

    const recoveryCodes = buildRecoveryCodes();
    const hashes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await tx.twoFactorRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash })),
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorConfirmedAt: new Date(),
        },
      });
    });

    return { recoveryCodes };
  }

  async disable(
    userId: number,
    password: string,
    code: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        twoFactorRecoveryCodes: { where: { usedAt: null } },
      },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('O 2FA não está ativo.');
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    await this.assertSecondFactorValid(user.id, user.tenantId, code);

    await this.prisma.$transaction(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorEncryptedSecret: null,
          twoFactorConfirmedAt: null,
        },
      });
    });

    return { message: 'Autenticação em duas etapas desativada.' };
  }

  async regenerateRecoveryCodes(
    userId: number,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, tenantId: true },
    });
    if (!user?.twoFactorEnabled) {
      throw new BadRequestException('O 2FA não está ativo.');
    }

    const normalized = normalizeTotpCode(code);
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Use o código TOTP de 6 dígitos.');
    }

    await this.assertSecondFactorValid(userId, user.tenantId, normalized);

    const recoveryCodes = buildRecoveryCodes();
    const hashes = await Promise.all(
      recoveryCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await tx.twoFactorRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash })),
      });
    });

    return { recoveryCodes };
  }
}
