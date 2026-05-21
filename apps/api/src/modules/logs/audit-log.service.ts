import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/database.service';
import { FilterDto } from 'src/common/dtos/filter.dto';
import { ResponseAuditLogDto } from './dto/response-audit-log.dto';
import { ResponseAuditLogListDto } from './dto/response-audit-log.dto';
import { NotFoundException } from '@nestjs/common';

type DiffRecord = Record<string, { before: unknown; after: unknown }>;

export interface AuditLogParams {
  tableName: string;
  recordId: number;
  action: AuditAction;
  tenantId: number;
  performedById?: number;
  changes?: unknown;
}

interface SnapshotOptions {
  ignoreFields?: string[];
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logChange(params: AuditLogParams): Promise<void> {
    try {
      const { tableName, recordId, action, tenantId, performedById, changes } =
        params;
      await this.prisma.auditLog.create({
        data: {
          tableName,
          recordId,
          action,
          tenantId,
          performedById: performedById ?? null,
          changes: this.normalizeChanges(changes),
        },
      });
    } catch (error) {
      this.logger.error(
        `Falha ao registrar audit log para ${params.tableName}#${params.recordId}`,
        (error as Error)?.stack,
      );
    }
  }

  async findAll(
    filter: FilterDto,
    tenantId: number,
  ): Promise<ResponseAuditLogListDto> {
    const {
      currentPage = 1,
      pageSize = 10,
      search,
      order = 'desc',
      orderBy = 'createdAt',
    } = filter;
    const skip = (currentPage - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
    };

    if (search) {
      where.OR = [{ tableName: { contains: search, mode: 'insensitive' } }];
    }

    const [data, totalRecords] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderBy]: order },
        include: {
          performedBy: {
            select: {
              name: true,
            },
          },
          tenant: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const logs: ResponseAuditLogDto[] = data.map((log) => ({
      id: log.id,
      tableName: log.tableName,
      recordId: log.recordId,
      action: log.action,
      changes: log.changes as DiffRecord | null,
      performedById: log.performedById,
      performedByName: log.performedBy?.name,
      tenantId: log.tenantId,
      tenantName: log.tenant?.name,
      createdAt: log.createdAt,
    }));

    const totalPages = Math.ceil(totalRecords / pageSize);

    return {
      data: logs,
      currentPage,
      pageSize,
      totalRecords,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrevious: currentPage > 1,
    };
  }

  async findById(id: number, tenantId: number): Promise<ResponseAuditLogDto> {
    const log = await this.prisma.auditLog.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        performedBy: {
          select: {
            name: true,
          },
        },
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Log de auditoria não encontrado');
    }

    return {
      id: log.id,
      tableName: log.tableName,
      recordId: log.recordId,
      action: log.action,
      changes: log.changes as DiffRecord | null,
      performedById: log.performedById,
      performedByName: log.performedBy?.name,
      tenantId: log.tenantId,
      tenantName: log.tenant?.name,
      createdAt: log.createdAt,
    };
  }

  buildSnapshot<T extends object | null | undefined>(
    value: T,
    options?: SnapshotOptions,
  ): Record<string, unknown> {
    if (!value) {
      return {};
    }

    const ignoreSet = new Set(options?.ignoreFields ?? []);

    return Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [key, val]) => {
        if (ignoreSet.has(key)) {
          return acc;
        }

        const sanitized = this.sanitizeValue(val);
        if (sanitized !== undefined) {
          acc[key] = sanitized;
        }

        return acc;
      },
      {},
    );
  }

  buildDiff(
    before: object | null | undefined,
    after: object | null | undefined,
    options?: SnapshotOptions,
  ): DiffRecord {
    const beforeSnapshot = this.buildSnapshot(before, options);
    const afterSnapshot = this.buildSnapshot(after, options);

    const keys = new Set([
      ...Object.keys(beforeSnapshot),
      ...Object.keys(afterSnapshot),
    ]);

    const diff: DiffRecord = {};

    for (const key of keys) {
      const beforeValue = beforeSnapshot[key];
      const afterValue = afterSnapshot[key];

      if (this.areDifferent(beforeValue, afterValue)) {
        diff[key] = {
          before: beforeValue,
          after: afterValue,
        };
      }
    }

    return diff;
  }

  hasChanges(changes?: DiffRecord): boolean {
    if (!changes) {
      return false;
    }
    return Object.keys(changes).length > 0;
  }

  private normalizeChanges(
    changes?: unknown,
  ): Prisma.InputJsonValue | undefined {
    if (changes === undefined) {
      return undefined;
    }

    const sanitized = this.sanitizeValue(changes);

    if (sanitized === undefined) {
      return undefined;
    }

    if (
      typeof sanitized === 'object' &&
      sanitized !== null &&
      Object.keys(sanitized).length === 0
    ) {
      return undefined;
    }

    return sanitized as Prisma.InputJsonValue;
  }

  private areDifferent(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  }

  private sanitizeValue(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      const sanitizedArray = value
        .map((item) => this.sanitizeValue(item))
        .filter((item) => item !== undefined);
      return sanitizedArray;
    }

    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<
        Record<string, unknown>
      >((acc, [key, val]) => {
        const sanitized = this.sanitizeValue(val);
        if (sanitized !== undefined) {
          acc[key] = sanitized;
        }
        return acc;
      }, {});
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      return value.toString();
    }

    return value;
  }
}
