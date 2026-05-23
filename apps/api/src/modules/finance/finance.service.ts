import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialRecurrenceFrequency,
  FinancialTransactionStatus,
  FinancialTransactionType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/database/database.service';
import { CustomRequest } from 'src/common/types/request.interface';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { TenantLimitsService } from '../limits/tenant-limits.service';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { FinancialTransactionFilterDto } from './dto/financial-transaction-filter.dto';
import {
  FinancialTransactionUpdateScope,
  UpdateFinancialTransactionDto,
} from './dto/update-financial-transaction.dto';
import { UpdateFinancialCategoryDto } from './dto/update-financial-category.dto';

const transactionIncludes = {
  category: true,
} satisfies Prisma.FinancialTransactionInclude;

type FinancialTransactionWithRelations = Prisma.FinancialTransactionGetPayload<{
  include: typeof transactionIncludes;
}>;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  async createCategory(data: CreateFinancialCategoryDto, req: CustomRequest) {
    const existingCategory = await this.prisma.financialCategory.findFirst({
      where: {
        tenantId: req.tenantId,
        name: data.name,
        type: data.type,
      },
    });

    if (existingCategory?.deletedAt === null) {
      throw new BadRequestException(
        'Já existe uma categoria com esse nome e tipo.',
      );
    }

    if (existingCategory?.deletedAt) {
      return this.prisma.financialCategory.update({
        where: { id: existingCategory.id },
        data: {
          deletedAt: null,
          name: data.name,
          type: data.type,
        },
      });
    }

    await this.tenantLimitsService.checkLimit(
      req.tenantId,
      'financialCategories',
      1,
    );

    return this.prisma.financialCategory.create({
      data: {
        name: data.name,
        type: data.type,
        tenantId: req.tenantId,
      },
    });
  }

  async getCategories(req: CustomRequest, type?: FinancialTransactionType) {
    return this.prisma.financialCategory.findMany({
      where: {
        tenantId: req.tenantId,
        deletedAt: null,
        ...(type && { type }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async updateCategory(
    id: number,
    data: UpdateFinancialCategoryDto,
    req: CustomRequest,
  ) {
    const category = await this.findCategoryOrThrow(id, req.tenantId);
    const nextName = data.name?.trim() ?? category.name;
    const nextType = data.type ?? category.type;

    const existingCategory = await this.prisma.financialCategory.findFirst({
      where: {
        tenantId: req.tenantId,
        name: nextName,
        type: nextType,
        id: { not: id },
        deletedAt: null,
      },
    });

    if (existingCategory) {
      throw new BadRequestException(
        'Já existe outra categoria com esse nome e tipo.',
      );
    }

    return this.prisma.financialCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: nextName }),
        ...(data.type !== undefined && { type: nextType }),
      },
    });
  }

  async deleteCategory(id: number, req: CustomRequest) {
    await this.findCategoryOrThrow(id, req.tenantId);

    const linkedTransactions = await this.prisma.financialTransaction.count({
      where: {
        tenantId: req.tenantId,
        categoryId: id,
        deletedAt: null,
      },
    });

    if (linkedTransactions > 0) {
      throw new BadRequestException(
        'Não é possível excluir a categoria porque existem lançamentos vinculados a ela.',
      );
    }

    return this.prisma.financialCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async createTransaction(
    data: CreateFinancialTransactionDto,
    req: CustomRequest,
  ) {
    await this.ensureCategoryBelongsToTenant(data.categoryId, req.tenantId);

    this.validatePaymentAndDueDate(data.paymentDate, data.dueDate);
    this.validatePhaseOneCreationMode(data);
    await this.tenantLimitsService.checkLimit(
      req.tenantId,
      'monthlyTransactions',
      this.getPlannedCreationCount(data),
    );

    const competenceDate = data.competenceDate
      ? new Date(data.competenceDate)
      : null;
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;

    const created = await this.createTransactionsByMode(
      data,
      req.tenantId,
      competenceDate,
      dueDate,
      paymentDate,
    );

    return {
      createdCount: created.length,
      transactions: created.map((transaction) =>
        this.mapTransaction(transaction),
      ),
    };
  }

  async getTransactions(
    filters: FinancialTransactionFilterDto,
    req: CustomRequest,
  ) {
    const {
      currentPage = 1,
      pageSize = 10,
      search,
      type,
      status,
      categoryId,
      startDate,
      endDate,
    } = filters;

    const now = new Date();
    const isOverdueFilter = status === FinancialTransactionStatus.OVERDUE;

    const where: Prisma.FinancialTransactionWhereInput = {
      tenantId: req.tenantId,
      deletedAt: null,
      ...(search && {
        description: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate && { gte: this.getStartOfDay(startDate) }),
              ...(endDate && { lte: this.getEndOfDay(endDate) }),
            },
          }
        : {}),
      ...(!isOverdueFilter &&
        status && {
          status,
        }),
      ...(isOverdueFilter && {
        status: FinancialTransactionStatus.PENDING,
        dueDate: { lt: now },
      }),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        include: this.defaultIncludes(),
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.mapTransaction(row)),
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage,
      pageSize,
    };
  }

  async updateTransaction(
    id: number,
    data: UpdateFinancialTransactionDto,
    req: CustomRequest,
  ) {
    const existing = await this.findTransactionOrThrow(id, req.tenantId);

    if (data.categoryId) {
      await this.ensureCategoryBelongsToTenant(data.categoryId, req.tenantId);
    }

    const finalStatus: FinancialTransactionStatus =
      data.status ?? existing.status;
    const finalDueDate = data.dueDate ?? existing.dueDate?.toISOString();
    const finalPaymentDate =
      data.paymentDate ?? existing.paymentDate?.toISOString();

    if (!finalDueDate) {
      throw new BadRequestException(
        'Informe a data de vencimento do lançamento.',
      );
    }

    if (finalStatus === FinancialTransactionStatus.PAID && !finalPaymentDate) {
      throw new BadRequestException(
        'Para status PAID, informe uma data de pagamento.',
      );
    }

    const updateScope =
      data.updateScope ?? FinancialTransactionUpdateScope.SINGLE;
    const updateData = this.buildTransactionUpdateData(data, existing);

    if (updateScope === FinancialTransactionUpdateScope.ALL) {
      const groupWhere = this.buildGroupedUpdateWhere(existing, req.tenantId);

      if (!groupWhere) {
        throw new BadRequestException(
          'Este lançamento não pertence a uma série ou parcelamento para edição em lote.',
        );
      }

      const result = await this.updateTransactionGroup(
        groupWhere,
        updateData,
        existing,
        data,
      );

      return {
        updatedCount: result.count,
        scope: updateScope,
      };
    }

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: updateData,
      include: this.defaultIncludes(),
    });

    return this.mapTransaction(updated);
  }

  async markTransactionAsPaid(
    id: number,
    req: CustomRequest,
    payload: {
      paymentDate?: string;
      penaltyAmount?: number;
      interestAmount?: number;
      discountAmount?: number;
      notes?: string;
    },
  ) {
    const existing = await this.findTransactionOrThrow(id, req.tenantId);

    if (existing.status === FinancialTransactionStatus.CANCELLED) {
      throw new BadRequestException(
        'Não é possível marcar como pago um lançamento cancelado.',
      );
    }

    const penaltyAmount = payload.penaltyAmount ?? 0;
    const interestAmount = payload.interestAmount ?? 0;
    const discountAmount = payload.discountAmount ?? 0;
    const adjustedAmount =
      Number(existing.amount) + penaltyAmount + interestAmount - discountAmount;

    if (adjustedAmount < 0) {
      throw new BadRequestException(
        'O valor final da baixa não pode ficar negativo.',
      );
    }

    const adjustmentNotes = [
      penaltyAmount > 0 ? `Multa: ${penaltyAmount.toFixed(2)}` : null,
      interestAmount > 0 ? `Juros: ${interestAmount.toFixed(2)}` : null,
      discountAmount > 0 ? `Desconto: ${discountAmount.toFixed(2)}` : null,
      payload.notes?.trim() ? `Obs. baixa: ${payload.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const updated = await this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.PAID,
        paymentDate: payload.paymentDate
          ? new Date(payload.paymentDate)
          : new Date(),
        amount: new Prisma.Decimal(adjustedAmount),
        notes: adjustmentNotes
          ? existing.notes
            ? `${existing.notes}\n${adjustmentNotes}`
            : adjustmentNotes
          : existing.notes,
      },
      include: this.defaultIncludes(),
    });

    return this.mapTransaction(updated);
  }

  private buildTransactionUpdateData(
    data: UpdateFinancialTransactionDto,
    existing: FinancialTransactionWithRelations,
  ): Prisma.FinancialTransactionUpdateInput {
    const updateData: Prisma.FinancialTransactionUpdateInput = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.amount !== undefined)
      updateData.amount = new Prisma.Decimal(data.amount);
    if (data.competenceDate !== undefined) {
      updateData.competenceDate = data.competenceDate
        ? new Date(data.competenceDate)
        : null;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.paymentDate !== undefined) {
      updateData.paymentDate = data.paymentDate
        ? new Date(data.paymentDate)
        : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.categoryId !== undefined) {
      updateData.category = { connect: { id: data.categoryId } };
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.recurrenceFrequency !== undefined) {
      updateData.recurrenceFrequency = data.recurrenceFrequency;
    }
    if (data.recurrenceInterval !== undefined) {
      updateData.recurrenceInterval = data.recurrenceInterval;
    }
    if (data.recurrenceCount !== undefined) {
      updateData.recurrenceCount = data.recurrenceCount;
    }
    if (data.installmentCount !== undefined) {
      updateData.installmentCount = data.installmentCount;
    }

    if (
      data.status === FinancialTransactionStatus.PAID &&
      data.paymentDate === undefined
    ) {
      updateData.paymentDate = existing.paymentDate ?? new Date();
    }

    return updateData;
  }

  private buildGroupedUpdateWhere(
    existing: FinancialTransactionWithRelations,
    tenantId: number,
  ): Prisma.FinancialTransactionWhereInput | null {
    if (existing.recurrenceGroupId) {
      return {
        tenantId,
        deletedAt: null,
        recurrenceGroupId: existing.recurrenceGroupId,
      };
    }

    if (existing.installmentGroupId) {
      return {
        tenantId,
        deletedAt: null,
        installmentGroupId: existing.installmentGroupId,
      };
    }

    return null;
  }

  private async findCategoryOrThrow(id: number, tenantId: number) {
    const category = await this.prisma.financialCategory.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria financeira não encontrada.');
    }

    return category;
  }

  private async updateTransactionGroup(
    where: Prisma.FinancialTransactionWhereInput,
    updateData: Prisma.FinancialTransactionUpdateInput,
    existing: FinancialTransactionWithRelations,
    input: UpdateFinancialTransactionDto,
  ) {
    const dueDateShiftDays = this.getDateShiftDays(
      existing.dueDate,
      input.dueDate,
    );
    const competenceDateShiftDays = this.getDateShiftDays(
      existing.competenceDate,
      input.competenceDate,
    );

    return this.prisma.$transaction(async (tx) => {
      const groupItems = await tx.financialTransaction.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      });

      for (const item of groupItems) {
        const itemUpdate: Prisma.FinancialTransactionUpdateInput = {
          ...updateData,
        };

        if (input.dueDate !== undefined) {
          itemUpdate.dueDate = this.shiftDate(item.dueDate, dueDateShiftDays);
        }

        if (input.competenceDate !== undefined) {
          itemUpdate.competenceDate = this.shiftDate(
            item.competenceDate,
            competenceDateShiftDays,
          );
        }

        await tx.financialTransaction.update({
          where: { id: item.id },
          data: itemUpdate,
        });
      }

      return { count: groupItems.length };
    });
  }

  private getDateShiftDays(
    originalDate: Date | null,
    nextDate?: string,
  ): number | null {
    if (nextDate === undefined) return null;
    if (!originalDate) return null;

    const original = new Date(originalDate);
    const updated = new Date(nextDate);
    const msPerDay = 24 * 60 * 60 * 1000;

    return Math.round((updated.getTime() - original.getTime()) / msPerDay);
  }

  private shiftDate(date: Date | null, shiftDays: number | null): Date | null {
    if (date === null) return null;
    if (shiftDays === null) return date;

    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + shiftDays);
    return shifted;
  }

  async cancelTransaction(
    id: number,
    req: CustomRequest,
    deleteScope: FinancialTransactionUpdateScope = FinancialTransactionUpdateScope.SINGLE,
  ) {
    const existing = await this.findTransactionOrThrow(id, req.tenantId);

    if (deleteScope === FinancialTransactionUpdateScope.ALL) {
      const groupWhere = this.buildGroupedUpdateWhere(existing, req.tenantId);

      if (!groupWhere) {
        throw new BadRequestException(
          'Este lançamento não pertence a uma série ou parcelamento para exclusão em lote.',
        );
      }

      const now = new Date();
      const result = await this.prisma.financialTransaction.updateMany({
        where: groupWhere,
        data: {
          status: FinancialTransactionStatus.CANCELLED,
          deletedAt: now,
        },
      });

      return {
        deletedCount: result.count,
        scope: deleteScope,
      };
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: FinancialTransactionStatus.CANCELLED,
        deletedAt: new Date(),
      },
    });
  }

  async getSummary(req: CustomRequest, startDate?: string, endDate?: string) {
    await this.tenantLimitsService.ensureAdvancedReportsAllowed(req.tenantId);
    const dateFilter: Prisma.FinancialTransactionWhereInput = {
      tenantId: req.tenantId,
      deletedAt: null,
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate && { gte: this.getStartOfDay(startDate) }),
              ...(endDate && { lte: this.getEndOfDay(endDate) }),
            },
          }
        : {}),
    };

    const [transactions, overdueCount] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where: {
          ...dateFilter,
          status: {
            not: FinancialTransactionStatus.CANCELLED,
          },
        },
        select: {
          amount: true,
          type: true,
          status: true,
        },
      }),
      this.prisma.financialTransaction.count({
        where: {
          ...dateFilter,
          status: FinancialTransactionStatus.PENDING,
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const totals = transactions.reduce(
      (acc, row) => {
        const amount = Number(row.amount);
        if (row.type === FinancialTransactionType.INCOME) {
          acc.totalIncome += amount;
        }
        if (row.type === FinancialTransactionType.EXPENSE) {
          acc.totalExpense += amount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 },
    );

    return {
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      balance: totals.totalIncome - totals.totalExpense,
      overdueCount,
    };
  }

  async getNotifications(req: CustomRequest) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const rows = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId: req.tenantId,
        deletedAt: null,
        status: FinancialTransactionStatus.PENDING,
        dueDate: { not: null },
      },
      include: this.defaultIncludes(),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    const items = rows.map((row) => this.mapTransaction(row));

    const dueToday = items.filter((item) => {
      if (!item.dueDate) return false;
      const dueDate = new Date(item.dueDate);
      return dueDate >= startOfToday && dueDate < endOfToday;
    });

    const overdueItems = items.filter(
      (item) => item.status === FinancialTransactionStatus.OVERDUE,
    );

    const overdueCounts = overdueItems.reduce(
      (acc, item) => {
        const days = this.getOverdueDays(item.dueDate!);
        if (days >= 1) acc.oneDay += 1;
        if (days >= 3) acc.threeDays += 1;
        if (days >= 7) acc.sevenDays += 1;
        return acc;
      },
      { oneDay: 0, threeDays: 0, sevenDays: 0 },
    );

    return {
      dueTodayCount: dueToday.length,
      overdueCounts,
      items: overdueItems.slice(0, 10).map((item) => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        dueDate: item.dueDate,
        daysOverdue: this.getOverdueDays(item.dueDate!),
        installmentLabel:
          item.installmentNumber && item.installmentCount
            ? `${item.installmentNumber}/${item.installmentCount}`
            : null,
      })),
    };
  }

  private async findTransactionOrThrow(id: number, tenantId: number) {
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: this.defaultIncludes(),
    });

    if (!transaction) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }

    return transaction;
  }

  private async ensureCategoryBelongsToTenant(
    categoryId: number,
    tenantId: number,
  ) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id: categoryId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException(
        'Categoria financeira inválida para este tenant.',
      );
    }
  }

  private defaultIncludes() {
    return transactionIncludes;
  }

  private validatePaymentAndDueDate(paymentDate?: string, dueDate?: string) {
    if (paymentDate && dueDate) {
      const parsedPaymentDate = new Date(paymentDate);
      const parsedDueDate = new Date(dueDate);
      if (parsedPaymentDate < parsedDueDate) {
        throw new BadRequestException(
          'A data de pagamento não pode ser anterior à data de vencimento.',
        );
      }
    }
  }

  private getPlannedCreationCount(data: CreateFinancialTransactionDto): number {
    if (data.installmentCount && data.installmentCount > 1) {
      return data.installmentCount;
    }

    if (data.recurrenceFrequency && data.recurrenceCount) {
      return data.recurrenceCount;
    }

    return 1;
  }

  private validatePhaseOneCreationMode(data: CreateFinancialTransactionDto) {
    if (!data.dueDate) {
      throw new BadRequestException(
        'Informe a data de vencimento do lançamento.',
      );
    }

    if (data.recurrenceFrequency && data.installmentCount) {
      throw new BadRequestException(
        'Use recorrência ou parcelamento na criação inicial, não os dois ao mesmo tempo.',
      );
    }

    if (data.installmentCount && !data.dueDate) {
      throw new BadRequestException(
        'Informe a data de vencimento para criar um lançamento parcelado.',
      );
    }

    if (data.recurrenceFrequency) {
      if (!data.dueDate) {
        throw new BadRequestException(
          'Informe a data de vencimento para criar uma recorrência.',
        );
      }

      if (!data.recurrenceCount) {
        throw new BadRequestException(
          'Informe a quantidade de ocorrências para criar uma recorrência.',
        );
      }
    }
  }

  private async createTransactionsByMode(
    data: CreateFinancialTransactionDto,
    tenantId: number,
    competenceDate: Date | null,
    dueDate: Date | null,
    paymentDate: Date | null,
  ) {
    if (data.installmentCount && data.installmentCount > 1) {
      return this.createInstallmentTransactions(
        data,
        tenantId,
        competenceDate,
        dueDate,
      );
    }

    if (data.recurrenceFrequency && data.recurrenceCount) {
      return this.createRecurringTransactions(
        data,
        tenantId,
        competenceDate,
        dueDate,
      );
    }

    const created = await this.prisma.financialTransaction.create({
      data: this.buildTransactionData({
        ...data,
        tenantId,
        competenceDate,
        dueDate,
        paymentDate,
      }),
      include: this.defaultIncludes(),
    });

    return [created];
  }

  private async createInstallmentTransactions(
    data: CreateFinancialTransactionDto,
    tenantId: number,
    competenceDate: Date | null,
    dueDate: Date | null,
  ) {
    const installmentCount = data.installmentCount!;
    const groupId = randomUUID();
    const amounts = this.splitAmountIntoInstallments(
      data.amount,
      installmentCount,
    );

    const created = await this.prisma.$transaction(
      amounts.map((amount, index) =>
        this.prisma.financialTransaction.create({
          data: this.buildTransactionData({
            ...data,
            tenantId,
            amount,
            description: `${data.description} (${index + 1}/${installmentCount})`,
            competenceDate: competenceDate
              ? this.addRecurrenceInterval(
                  competenceDate,
                  index,
                  FinancialRecurrenceFrequency.MONTHLY,
                  1,
                )
              : null,
            dueDate: dueDate
              ? this.addRecurrenceInterval(
                  dueDate,
                  index,
                  FinancialRecurrenceFrequency.MONTHLY,
                  1,
                )
              : null,
            paymentDate: null,
            installmentGroupId: groupId,
            installmentNumber: index + 1,
            installmentCount,
          }),
          include: this.defaultIncludes(),
        }),
      ),
    );

    return created;
  }

  private async createRecurringTransactions(
    data: CreateFinancialTransactionDto,
    tenantId: number,
    competenceDate: Date | null,
    dueDate: Date | null,
  ) {
    const recurrenceCount = data.recurrenceCount!;
    const recurrenceInterval = data.recurrenceInterval ?? 1;
    const groupId = randomUUID();

    const created = await this.prisma.$transaction(
      Array.from({ length: recurrenceCount }, (_, index) =>
        this.prisma.financialTransaction.create({
          data: this.buildTransactionData({
            ...data,
            tenantId,
            competenceDate: competenceDate
              ? this.addRecurrenceInterval(
                  competenceDate,
                  index,
                  data.recurrenceFrequency!,
                  recurrenceInterval,
                )
              : null,
            dueDate: dueDate
              ? this.addRecurrenceInterval(
                  dueDate,
                  index,
                  data.recurrenceFrequency!,
                  recurrenceInterval,
                )
              : null,
            paymentDate: null,
            isRecurring: true,
            recurrenceFrequency: data.recurrenceFrequency,
            recurrenceInterval,
            recurrenceCount,
            recurrenceGroupId: groupId,
            recurrenceIndex: index + 1,
          }),
          include: this.defaultIncludes(),
        }),
      ),
    );

    return created;
  }

  private buildTransactionData(input: {
    type: FinancialTransactionType;
    description: string;
    amount: number;
    notes?: string;
    categoryId: number;
    tenantId: number;
    competenceDate: Date | null;
    dueDate: Date | null;
    paymentDate: Date | null;
    isRecurring?: boolean;
    recurrenceFrequency?: FinancialRecurrenceFrequency;
    recurrenceInterval?: number;
    recurrenceCount?: number;
    recurrenceGroupId?: string;
    recurrenceIndex?: number;
    installmentGroupId?: string;
    installmentNumber?: number;
    installmentCount?: number;
  }): Prisma.FinancialTransactionCreateInput {
    return {
      type: input.type,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      competenceDate: input.competenceDate,
      dueDate: input.dueDate,
      paymentDate: input.paymentDate,
      notes: input.notes,
      category: { connect: { id: input.categoryId } },
      tenant: { connect: { id: input.tenantId } },
      status: input.paymentDate
        ? FinancialTransactionStatus.PAID
        : FinancialTransactionStatus.PENDING,
      isRecurring: input.isRecurring ?? false,
      recurrenceFrequency: input.recurrenceFrequency,
      recurrenceInterval: input.recurrenceInterval,
      recurrenceCount: input.recurrenceCount,
      recurrenceGroupId: input.recurrenceGroupId,
      recurrenceIndex: input.recurrenceIndex,
      installmentGroupId: input.installmentGroupId,
      installmentNumber: input.installmentNumber,
      installmentCount: input.installmentCount,
    };
  }

  private addRecurrenceInterval(
    baseDate: Date,
    index: number,
    frequency: FinancialRecurrenceFrequency,
    interval: number,
  ) {
    const nextDate = new Date(baseDate);

    if (frequency === FinancialRecurrenceFrequency.WEEKLY) {
      nextDate.setDate(nextDate.getDate() + index * 7 * interval);
      return nextDate;
    }

    if (frequency === FinancialRecurrenceFrequency.YEARLY) {
      nextDate.setFullYear(nextDate.getFullYear() + index * interval);
      return nextDate;
    }

    nextDate.setMonth(nextDate.getMonth() + index * interval);
    return nextDate;
  }

  private splitAmountIntoInstallments(
    amount: number,
    installmentCount: number,
  ) {
    const totalCents = Math.round(amount * 100);
    const baseValue = Math.floor(totalCents / installmentCount);
    const remainder = totalCents % installmentCount;

    return Array.from({ length: installmentCount }, (_, index) => {
      const cents = baseValue + (index < remainder ? 1 : 0);
      return cents / 100;
    });
  }

  private getOverdueDays(dueDate: string | Date) {
    const due = new Date(dueDate);
    const now = new Date();
    const diffInMs = now.getTime() - due.getTime();
    return Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
  }

  private getStartOfDay(value: string) {
    const date = new Date(`${value}T00:00:00`);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getEndOfDay(value: string) {
    const date = new Date(`${value}T00:00:00`);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private mapTransaction(transaction: FinancialTransactionWithRelations) {
    const now = new Date();
    const isOverdue =
      transaction.status === FinancialTransactionStatus.PENDING &&
      transaction.dueDate !== null &&
      transaction.dueDate < now;

    return {
      ...transaction,
      amount: Number(transaction.amount),
      status: isOverdue
        ? FinancialTransactionStatus.OVERDUE
        : transaction.status,
    };
  }
}
