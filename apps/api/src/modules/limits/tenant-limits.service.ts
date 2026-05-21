import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceAccessTier } from '@prisma/client';
import { PrismaService } from 'src/database/database.service';

export type ResourceType =
  | 'users'
  | 'storageMB'
  | 'financialCategories'
  | 'monthlyTransactions';

const FREE_TIER_LIMITS = {
  maxUsers: 1,
  maxStorageMB: 1024,
  maxFinancialCategories: 10,
  maxMonthlyTransactions: 100,
  allowAdvancedReports: false,
} as const;

const TRIAL_TIER_LIMITS = {
  maxUsers: -1,
  maxStorageMB: -1,
  maxFinancialCategories: -1,
  maxMonthlyTransactions: -1,
  allowAdvancedReports: true,
} as const;

@Injectable()
export class TenantLimitsService {
  private readonly logger = new Logger(TenantLimitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkLimit(
    tenantId: number,
    resourceType: ResourceType,
    increment: number = 1,
  ): Promise<void> {
    const limits = await this.getResolvedLimitsOrThrow(tenantId);
    const current = await this.getCurrentUsageValue(
      tenantId,
      resourceType,
      limits,
    );
    const max = this.getLimitValue(resourceType, limits);

    if (max === -1) {
      return;
    }

    if (current + increment > max) {
      const resourceNames: Record<ResourceType, string> = {
        users: 'usuários',
        storageMB: 'armazenamento',
        financialCategories: 'categorias financeiras',
        monthlyTransactions: 'lançamentos do mês',
      };

      throw new BadRequestException(
        `Limite de ${resourceNames[resourceType]} excedido. Máximo: ${max}, atual: ${current}. Ajuste os limites do workspace para continuar.`,
      );
    }
  }

  async incrementCounter(
    tenantId: number,
    resourceType: Extract<ResourceType, 'users' | 'storageMB'>,
    amount: number = 1,
  ): Promise<void> {
    await this.applyFreeTierIfTrialExpired(tenantId);

    const updateField =
      resourceType === 'users'
        ? { currentUsers: { increment: amount } }
        : { currentStorageMB: { increment: amount } };

    await this.prisma.tenantLimits.update({
      where: { tenantId },
      data: updateField,
    });

    this.logger.log(
      `Incremented ${resourceType} for tenant ${tenantId} by ${amount}`,
    );
  }

  async decrementCounter(
    tenantId: number,
    resourceType: Extract<ResourceType, 'users' | 'storageMB'>,
    amount: number = 1,
  ): Promise<void> {
    await this.applyFreeTierIfTrialExpired(tenantId);

    const updateField =
      resourceType === 'users'
        ? { currentUsers: { decrement: amount } }
        : { currentStorageMB: { decrement: amount } };

    await this.prisma.tenantLimits.update({
      where: { tenantId },
      data: updateField,
    });

    this.logger.log(
      `Decremented ${resourceType} for tenant ${tenantId} by ${amount}`,
    );
  }

  async getUsage(tenantId: number) {
    const tenant = await this.applyFreeTierIfTrialExpired(tenantId);
    const limits = await this.getResolvedLimitsOrThrow(tenantId);
    const monthlyTransactions = await this.countMonthlyTransactions(tenantId);
    const financialCategories = await this.countFinancialCategories(tenantId);
    const now = new Date();
    const trialEndsAt = tenant.trialEndsAt;
    const trialDaysRemaining =
      tenant.accessTier === WorkspaceAccessTier.TRIAL && trialEndsAt
        ? Math.max(
            0,
            Math.ceil(
              (trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            ),
          )
        : 0;

    return {
      accessTier: tenant.accessTier,
      trialStartsAt: tenant.trialStartsAt,
      trialEndsAt,
      trialDaysRemaining,
      allowAdvancedReports: limits.allowAdvancedReports,
      users: this.buildUsageBlock(limits.currentUsers, limits.maxUsers),
      storageMB: this.buildUsageBlock(
        limits.currentStorageMB,
        limits.maxStorageMB,
      ),
      financialCategories: this.buildUsageBlock(
        financialCategories,
        limits.maxFinancialCategories,
      ),
      monthlyTransactions: this.buildUsageBlock(
        monthlyTransactions,
        limits.maxMonthlyTransactions,
      ),
    };
  }

  async updateLimits(
    tenantId: number,
    newLimits: {
      maxUsers?: number;
      maxStorageMB?: number;
      maxFinancialCategories?: number;
      maxMonthlyTransactions?: number;
      allowAdvancedReports?: boolean;
    },
  ): Promise<void> {
    await this.prisma.tenantLimits.update({
      where: { tenantId },
      data: {
        ...(newLimits.maxUsers !== undefined && {
          maxUsers: newLimits.maxUsers,
        }),
        ...(newLimits.maxStorageMB !== undefined && {
          maxStorageMB: newLimits.maxStorageMB,
        }),
        ...(newLimits.maxFinancialCategories !== undefined && {
          maxFinancialCategories: newLimits.maxFinancialCategories,
        }),
        ...(newLimits.maxMonthlyTransactions !== undefined && {
          maxMonthlyTransactions: newLimits.maxMonthlyTransactions,
        }),
        ...(newLimits.allowAdvancedReports !== undefined && {
          allowAdvancedReports: newLimits.allowAdvancedReports,
        }),
      },
    });

    this.logger.log(`Updated limits for tenant ${tenantId}`);
  }

  async createLimits(
    tenantId: number,
    limits: {
      maxUsers: number;
      maxStorageMB: number;
      maxFinancialCategories?: number;
      maxMonthlyTransactions?: number;
      allowAdvancedReports?: boolean;
    },
  ): Promise<void> {
    await this.prisma.tenantLimits.create({
      data: {
        tenantId,
        maxUsers: limits.maxUsers,
        maxStorageMB: limits.maxStorageMB,
        maxFinancialCategories: limits.maxFinancialCategories ?? -1,
        maxMonthlyTransactions: limits.maxMonthlyTransactions ?? -1,
        allowAdvancedReports: limits.allowAdvancedReports ?? true,
      },
    });

    this.logger.log(`Created limits for tenant ${tenantId}`);
  }

  async syncCounters(tenantId: number): Promise<void> {
    await this.applyFreeTierIfTrialExpired(tenantId);

    const usersCount = await this.prisma.user.count({
      where: {
        tenantId,
        deletedAt: null,
      },
    });

    await this.prisma.tenantLimits.update({
      where: { tenantId },
      data: {
        currentUsers: usersCount,
      },
    });

    this.logger.log(`Synced counters for tenant ${tenantId}`);
  }

  async ensureAdvancedReportsAllowed(tenantId: number): Promise<void> {
    const limits = await this.getResolvedLimitsOrThrow(tenantId);

    if (!limits.allowAdvancedReports) {
      throw new ForbiddenException(
        'Relatórios avançados não estão disponíveis no plano atual do workspace.',
      );
    }
  }

  async applyFreeTierIfTrialExpired(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        accessTier: true,
        trialStartsAt: true,
        trialEndsAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    if (
      tenant.accessTier === WorkspaceAccessTier.TRIAL &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt <= new Date()
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            accessTier: WorkspaceAccessTier.FREE,
          },
        });

        await tx.tenantLimits.upsert({
          where: { tenantId },
          update: {
            ...FREE_TIER_LIMITS,
          },
          create: {
            tenantId,
            ...FREE_TIER_LIMITS,
          },
        });
      });

      this.logger.log(`Trial expirado, workspace ${tenantId} movido para FREE`);

      return {
        ...tenant,
        accessTier: WorkspaceAccessTier.FREE,
      };
    }

    return tenant;
  }

  private async getResolvedLimitsOrThrow(tenantId: number) {
    await this.applyFreeTierIfTrialExpired(tenantId);

    const limits = await this.prisma.tenantLimits.findUnique({
      where: { tenantId },
    });

    if (!limits) {
      throw new NotFoundException(
        'Limites do tenant não encontrados. Configure os limites iniciais primeiro.',
      );
    }

    return limits;
  }

  private getLimitValue(
    resourceType: ResourceType,
    limits: {
      maxUsers: number;
      maxStorageMB: number;
      maxFinancialCategories: number;
      maxMonthlyTransactions: number;
    },
  ): number {
    switch (resourceType) {
      case 'users':
        return limits.maxUsers;
      case 'storageMB':
        return limits.maxStorageMB;
      case 'financialCategories':
        return limits.maxFinancialCategories;
      case 'monthlyTransactions':
        return limits.maxMonthlyTransactions;
    }
  }

  private async getCurrentUsageValue(
    tenantId: number,
    resourceType: ResourceType,
    limits: {
      currentUsers: number;
      currentStorageMB: number;
    },
  ): Promise<number> {
    switch (resourceType) {
      case 'users':
        return limits.currentUsers;
      case 'storageMB':
        return limits.currentStorageMB;
      case 'financialCategories':
        return this.countFinancialCategories(tenantId);
      case 'monthlyTransactions':
        return this.countMonthlyTransactions(tenantId);
    }
  }

  private async countFinancialCategories(tenantId: number): Promise<number> {
    return this.prisma.financialCategory.count({
      where: {
        tenantId,
        deletedAt: null,
      },
    });
  }

  private async countMonthlyTransactions(tenantId: number): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return this.prisma.financialTransaction.count({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    });
  }

  private buildUsageBlock(current: number, max: number) {
    return {
      current,
      max,
      percentage: max === -1 ? 0 : (current / max) * 100,
      available: max === -1 ? -1 : max - current,
      isUnlimited: max === -1,
    };
  }

  getFreeTierDefaults() {
    return FREE_TIER_LIMITS;
  }

  getTrialTierDefaults() {
    return TRIAL_TIER_LIMITS;
  }
}
