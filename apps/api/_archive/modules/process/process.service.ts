import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AuditAction, ContactRole, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/database.service';
import {
  ResponseProcessDto,
  ResponseProcessListDto,
} from './dto/response-process.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { AuditLogService } from '../logs/audit-log.service';
import { TenantLimitsService } from '../limits/tenant-limits.service';
@Injectable()
export class ProcessService {
  private readonly logger = new Logger(ProcessService.name);
  constructor(
    private prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  async findAll(
    filters: ProcessFilterDto,
    req: CustomRequest,
  ): Promise<ResponseProcessListDto> {
    try {
      const {
        currentPage = 1,
        pageSize = 10,
        search,
        searchId,
        order = 'asc',
        orderBy = 'createdAt',
      } = filters;

      const where: Prisma.ProcessWhereInput = {
        deletedAt: null,
        tenantId: req.tenantId,
        ...(search && {
          OR: [
            ...(searchId !== undefined ? [{ id: searchId }] : []),
            {
              processNumber: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              courtDivision: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              action: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              ContactProcess: {
                some: {
                  contact: {
                    fullName: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                    deletedAt: null,
                  },
                },
              },
            },
            {
              ContactProcess: {
                some: {
                  contact: {
                    companyName: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                    deletedAt: null,
                  },
                },
              },
            },
          ],
        }),
      };

      const processes = await this.prisma.process.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: {
          ContactProcess: {
            include: {
              contact: true,
            },
          },
        },
      });

      const total = await this.prisma.process.count({ where });

      return {
        data: processes,
        currentPage,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      this.logger.error(
        `Error finding all processes: ${JSON.stringify(filters)}`,
        error?.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`${errorMessage}`);
    }
  }

  async findById(id: number, req: CustomRequest): Promise<ResponseProcessDto> {
    try {
      const process = await this.prisma.process.findFirst({
        where: {
          id,
          deletedAt: null,
          tenantId: req.tenantId,
        },
        include: {
          ContactProcess: {
            include: {
              contact: true,
            },
          },
        },
      });
      if (!process) {
        throw new NotFoundException('Processo não encontrado');
      }
      return process;
    } catch (error) {
      this.logger.error(
        `Error finding process by id: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`${errorMessage}`);
    }
  }

  async create(
    data: CreateProcessDto,
    req: CustomRequest,
  ): Promise<ResponseProcessDto> {
    try {
      const tenantId = req.tenantId;

      // Verificar limite de processos
      await this.tenantLimitsService.checkLimit(tenantId, 'processes', 1);

      const existingProcess = await this.prisma.process.findFirst({
        where: {
          processNumber: data.processNumber,
          tenantId,
        },
        select: { id: true },
      });

      if (existingProcess) {
        throw new ConflictException('Número de processo já cadastrado');
      }

      const { contacts, ...rest } = data;
      const process = await this.prisma.process.create({
        data: {
          ...rest,
          tenantId: tenantId,
          ContactProcess: {
            create: contacts.map((contact) => ({
              contactId: contact.contactId,
              role: contact.role as ContactRole,
            })),
          },
        },
      });

      // Incrementar contador de processos
      await this.tenantLimitsService.incrementCounter(tenantId, 'processes', 1);

      await this.auditLogService.logChange({
        tableName: 'processes',
        recordId: process.id,
        action: AuditAction.CREATE,
        tenantId,
        performedById: req.userId,
        changes: this.auditLogService.buildSnapshot(process, {
          ignoreFields: ['ContactProcess', 'updatedAt', 'deletedAt'],
        }),
      });

      return process;
    } catch (error) {
      this.logger.error(
        `Error creating process: ${JSON.stringify(data)}`,
        error?.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`${errorMessage}`);
    }
  }

  async update(
    id: number,
    data: UpdateProcessDto,
    req: CustomRequest,
  ): Promise<ResponseProcessDto> {
    try {
      const tenantId = req.tenantId;

      // Verificar se o processo existe e não foi deletado
      const existingProcess = await this.prisma.process.findFirst({
        where: {
          id,
          deletedAt: null,
          tenantId: req.tenantId,
        },
      });

      if (!existingProcess) {
        throw new NotFoundException('Processo não encontrado');
      }

      const { contacts, ...processData } = data;

      const process = await this.prisma.$transaction(async (prisma) => {
        // Atualizar dados básicos do processo
        await prisma.process.update({
          where: { id },
          data: {
            ...processData,
            tenantId: req.tenantId,
            updatedAt: new Date(),
          },
        });

        // Sincronizar partes do processo quando contatos forem enviados
        if (contacts !== undefined) {
          const uniqueContacts = Array.from(
            new Map(contacts.map((contact) => [contact.contactId, contact])).values(),
          );

          await prisma.contactProcess.deleteMany({
            where: { processId: id },
          });

          if (uniqueContacts.length > 0) {
            await prisma.contactProcess.createMany({
              data: uniqueContacts.map((contact) => ({
                processId: id,
                contactId: contact.contactId,
                role: contact.role as ContactRole,
              })),
            });
          }
        }

        return prisma.process.findUnique({
          where: { id },
          include: {
            ContactProcess: {
              include: {
                contact: true,
              },
            },
          },
        });
      });

      if (!process) {
        throw new NotFoundException('Processo não encontrado após atualização');
      }

      const previousSnapshot = this.auditLogService.buildSnapshot(
        existingProcess,
        {
          ignoreFields: ['ContactProcess', 'updatedAt', 'deletedAt'],
        },
      );
      const updatedSnapshot = this.auditLogService.buildSnapshot(process, {
        ignoreFields: ['ContactProcess', 'updatedAt', 'deletedAt'],
      });

      const changes = this.auditLogService.buildDiff(
        previousSnapshot,
        updatedSnapshot,
      );

      if (this.auditLogService.hasChanges(changes)) {
        await this.auditLogService.logChange({
          tableName: 'processes',
          recordId: process.id,
          action: AuditAction.UPDATE,
          tenantId,
          performedById: req.userId,
          changes,
        });
      }

      return process;
    } catch (error) {
      this.logger.error(
        `Error updating process: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`${errorMessage}`);
    }
  }

  async delete(id: number, req: CustomRequest): Promise<void> {
    try {
      const existingProcess = await this.prisma.process.findFirst({
        where: {
          id,
          deletedAt: null,
          tenantId: req.tenantId,
        },
      });

      if (!existingProcess) {
        throw new NotFoundException('Processo não encontrado');
      }

      const now = new Date();

      const updatedProcess = await this.prisma.process.update({
        where: { id },
        data: {
          deletedAt: now,
          updatedAt: now,
        },
      });

      // Decrementar contador de processos
      await this.tenantLimitsService.decrementCounter(
        req.tenantId,
        'processes',
        1,
      );

      await this.auditLogService.logChange({
        tableName: 'processes',
        recordId: updatedProcess.id,
        action: AuditAction.DELETE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: {
          deletedAt: {
            before: existingProcess.deletedAt,
            after: updatedProcess.deletedAt,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting process: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`${errorMessage}`);
    }
  }
}
