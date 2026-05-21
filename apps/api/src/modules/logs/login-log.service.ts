import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/database.service';
import { FilterDto } from 'src/common/dtos/filter.dto';
import {
  ResponseLoginLogListDto,
  ResponseLoginLogDto,
} from './dto/response-login-log.dto';

export interface LoginLogParams {
  userId?: number;
  tenantId?: number;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

@Injectable()
export class LoginLogService {
  private readonly logger = new Logger(LoginLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LoginLogParams): Promise<void> {
    try {
      const { userId, tenantId, ipAddress, userAgent, success } = params;

      await this.prisma.loginLog.create({
        data: {
          userId: userId ?? null,
          tenantId: tenantId ?? null,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          success,
        },
      });
    } catch (error) {
      this.logger.error(
        'Falha ao registrar login log',
        (error as Error)?.stack,
      );
    }
  }

  async findAll(
    filter: FilterDto,
    tenantId: number,
  ): Promise<ResponseLoginLogListDto> {
    const {
      currentPage = 1,
      pageSize = 10,
      search,
      order = 'desc',
      orderBy = 'createdAt',
    } = filter;
    const skip = (currentPage - 1) * pageSize;

    const where: Prisma.LoginLogWhereInput = {
      tenantId,
    };

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, totalRecords] = await Promise.all([
      this.prisma.loginLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderBy]: order },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          tenant: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.loginLog.count({ where }),
    ]);

    const logs: ResponseLoginLogDto[] = data.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user?.name,
      userEmail: log.user?.email,
      tenantId: log.tenantId,
      tenantName: log.tenant?.name,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      success: log.success,
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

  async findById(id: number, tenantId: number): Promise<ResponseLoginLogDto> {
    const log = await this.prisma.loginLog.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
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
      throw new NotFoundException('Log de login não encontrado');
    }

    return {
      id: log.id,
      userId: log.userId,
      userName: log.user?.name,
      userEmail: log.user?.email,
      tenantId: log.tenantId,
      tenantName: log.tenant?.name,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      success: log.success,
      createdAt: log.createdAt,
    };
  }
}
