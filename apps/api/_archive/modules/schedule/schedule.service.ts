import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleFiltersDto,
  UpdateParticipantsDto,
  UpdateRemindersDto,
} from './dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { AuditLogService } from '../logs/audit-log.service';
import {
  EventType,
  ScheduleStatus,
  Priority,
  ParticipantRole,
  ParticipantStatus,
  Prisma,
  AuditAction,
} from '@prisma/client';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @Inject('GoogleCalendarSyncService')
    private readonly googleSyncService?: any,
  ) {}

  /**
   * Criar novo compromisso
   */
  async create(dto: CreateScheduleDto, req: CustomRequest) {
    this.logger.log(`Creating schedule: ${JSON.stringify(dto)}`);

    try {
      // Validar datas
      this.validateDates(dto.startDate, dto.endDate);

      // Validar link de reunião online
      if (dto.isOnline && !dto.meetingLink) {
        throw new BadRequestException(
          'Link da reunião é obrigatório para eventos online',
        );
      }

      // Verificar conflitos de horário
      const conflicts = await this.checkConflicts(
        dto.startDate,
        dto.endDate,
        req.tenantId,
        undefined,
        dto.allDay ?? false,
      );
      if (conflicts.length > 0) {
        throw new ConflictException({
          message: 'Conflito de horário detectado',
          conflictingSchedules: conflicts,
        });
      }

      // Criar compromisso com transação
      const schedule = await this.prisma.$transaction(async (tx) => {
        // Criar schedule
        const createdSchedule = await tx.schedule.create({
          data: {
            title: dto.title,
            description: dto.description,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            allDay: dto.allDay || false,
            eventType: dto.eventType,
            status: dto.status || ScheduleStatus.PENDING,
            priority: dto.priority || Priority.MEDIUM,
            location: dto.location,
            isOnline: dto.isOnline || false,
            meetingLink: dto.meetingLink,
            isRecurring: dto.isRecurring || false,
            recurrenceRule: dto.recurrenceRule,
            recurrenceEndDate: dto.recurrenceEndDate
              ? new Date(dto.recurrenceEndDate)
              : null,
            userId: req.userId,
            tenantId: req.tenantId,
            processId: dto.processId,
          },
        });

        // Adicionar contatos
        if (dto.contactIds && dto.contactIds.length > 0) {
          await tx.scheduleContact.createMany({
            data: dto.contactIds.map((contactId) => ({
              scheduleId: createdSchedule.id,
              contactId,
            })),
          });
        }

        // Adicionar participantes (incluindo o criador como organizador)
        const participantIds = dto.participantIds || [];
        if (!participantIds.includes(req.userId)) {
          participantIds.push(req.userId);
        }

        if (participantIds.length > 0) {
          await tx.scheduleParticipant.createMany({
            data: participantIds.map((participantId) => ({
              scheduleId: createdSchedule.id,
              userId: participantId,
              role:
                participantId === req.userId
                  ? ParticipantRole.ORGANIZER
                  : ParticipantRole.PARTICIPANT,
              status:
                participantId === req.userId
                  ? ParticipantStatus.ACCEPTED
                  : ParticipantStatus.PENDING,
            })),
          });
        }

        // Adicionar lembretes
        if (dto.reminders && dto.reminders.length > 0) {
          await tx.scheduleReminder.createMany({
            data: dto.reminders.map((reminder) => ({
              scheduleId: createdSchedule.id,
              reminderTime: this.calculateReminderTime(
                createdSchedule.startDate,
                reminder.minutesBefore,
              ),
              reminderType: reminder.reminderType,
              minutesBefore: reminder.minutesBefore,
              wasSent: false,
            })),
          });
        }

        // Retornar com relacionamentos
        return await tx.schedule.findUnique({
          where: { id: createdSchedule.id },
          include: {
            contacts: { include: { contact: true } },
            participants: { include: { user: true } },
            reminders: true,
            process: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      });

      if (!schedule) {
        throw new NotFoundException('Compromisso não encontrado após criação');
      }

      // Log de auditoria
      await this.auditLogService.logChange({
        tableName: 'schedules',
        recordId: schedule.id,
        action: AuditAction.CREATE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: this.auditLogService.buildSnapshot(schedule, {
          ignoreFields: [
            'contacts',
            'participants',
            'reminders',
            'process',
            'user',
          ],
        }),
      });

      // Sincronizar com Google Calendar (assíncrono, não bloqueia resposta)
      if (this.googleSyncService) {
        this.googleSyncService.syncToGoogle(schedule.id).catch((error) => {
          this.logger.warn(
            `Erro ao sincronizar evento ${schedule.id} com Google Calendar: ${error.message}`,
          );
        });
      }

      return schedule;
    } catch (error) {
      this.logger.error(
        `Error creating schedule: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao criar compromisso: ${errorMessage}`,
      );
    }
  }

  /**
   * Listar compromissos com filtros e paginação
   */
  async findAll(filters: ScheduleFiltersDto, req: CustomRequest) {
    this.logger.log(`Finding all schedules: ${JSON.stringify(filters)}`);

    try {
      const {
        currentPage = 1,
        pageSize = 10,
        sortBy = 'startDate',
        sortOrder = 'ASC',
        ...filterParams
      } = filters;

      // Se startDate e endDate estão presentes, é uma requisição de calendário - ignorar paginação
      const isCalendarRequest = !!(
        filterParams.startDate && filterParams.endDate
      );

      const skip = isCalendarRequest ? undefined : (currentPage - 1) * pageSize;
      const take = isCalendarRequest ? undefined : pageSize;

      // Construir where clause
      const where: Prisma.ScheduleWhereInput = {
        tenantId: req.tenantId,
        deletedAt: null,
      };

      // Filtros opcionais
      if (filterParams.startDate) {
        where.startDate = { gte: new Date(filterParams.startDate) };
      }
      if (filterParams.endDate) {
        where.endDate = { lte: new Date(filterParams.endDate) };
      }
      if (filterParams.eventType) {
        where.eventType = filterParams.eventType;
      }
      if (filterParams.status) {
        where.status = filterParams.status;
      }
      if (filterParams.priority) {
        where.priority = filterParams.priority;
      }
      if (filterParams.processId) {
        where.processId = filterParams.processId;
      }
      if (filterParams.isRecurring !== undefined) {
        where.isRecurring = filterParams.isRecurring;
      }
      if (filterParams.search) {
        where.OR = [
          {
            title: {
              contains: filterParams.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            description: {
              contains: filterParams.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ];
      }
      if (filterParams.contactId) {
        where.contacts = {
          some: { contactId: filterParams.contactId },
        };
      }

      // Executar queries em paralelo
      const [data, totalItems] = await Promise.all([
        this.prisma.schedule.findMany({
          where,
          orderBy: { [sortBy]: sortOrder.toLowerCase() as 'asc' | 'desc' },
          include: {
            contacts: { include: { contact: true } },
            participants: { include: { user: true } },
            reminders: true,
            process: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.schedule.count({ where }),
      ]);

      // Se for requisição de calendário, retornar apenas o array de dados sem paginação
      if (isCalendarRequest) {
        return data;
      }

      return {
        data,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage,
        pageSize,
      };
    } catch (error) {
      this.logger.error(
        `Error finding schedules: ${JSON.stringify(error)}`,
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
      throw new BadRequestException(
        `Erro ao buscar compromissos: ${errorMessage}`,
      );
    }
  }

  /**
   * Buscar por ID
   */
  async findOne(id: number, req: CustomRequest) {
    this.logger.log(`Finding schedule by id: ${id}`);

    try {
      const schedule = await this.prisma.schedule.findFirst({
        where: {
          id,
          tenantId: req.tenantId,
          deletedAt: null,
        },
        include: {
          contacts: { include: { contact: true } },
          participants: { include: { user: true } },
          reminders: true,
          process: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!schedule) {
        throw new NotFoundException('Compromisso não encontrado');
      }

      // Verificar permissão
      await this.checkPermission(schedule, req);

      return schedule;
    } catch (error) {
      this.logger.error(
        `Error finding schedule: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao buscar compromisso: ${errorMessage}`,
      );
    }
  }

  /**
   * Atualizar compromisso
   */
  async update(id: number, dto: UpdateScheduleDto, req: CustomRequest) {
    this.logger.log(`Updating schedule ${id}`);

    try {
      const schedule = await this.findOne(id, req);

      // Validar datas se fornecidas
      if (dto.startDate || dto.endDate) {
        this.validateDates(
          dto.startDate || schedule.startDate.toISOString(),
          dto.endDate || schedule.endDate.toISOString(),
        );
      }

      const nextStartDate = dto.startDate
        ? new Date(dto.startDate)
        : schedule.startDate;
      const nextEndDate = dto.endDate ? new Date(dto.endDate) : schedule.endDate;
      const nextAllDay =
        dto.allDay !== undefined ? dto.allDay : schedule.allDay;

      const hasTimeWindowChanged =
        nextStartDate.getTime() !== schedule.startDate.getTime() ||
        nextEndDate.getTime() !== schedule.endDate.getTime();
      const hasAllDayChanged = nextAllDay !== schedule.allDay;

      // Verificar conflitos apenas se horário/período realmente mudou
      if (hasTimeWindowChanged || hasAllDayChanged) {
        const conflicts = await this.checkConflicts(
          nextStartDate.toISOString(),
          nextEndDate.toISOString(),
          req.tenantId,
          id,
          nextAllDay,
        );
        if (conflicts.length > 0) {
          throw new ConflictException('Conflito de horário detectado');
        }
      }

      const previousState = this.auditLogService.buildSnapshot(schedule, {
        ignoreFields: [
          'contacts',
          'participants',
          'reminders',
          'process',
          'user',
        ],
      });

      const updatedSchedule = await this.prisma.$transaction(async (tx) => {
        // Atualizar schedule
        const updated = await tx.schedule.update({
          where: { id },
          data: {
            ...(dto.title && { title: dto.title }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.startDate && { startDate: new Date(dto.startDate) }),
            ...(dto.endDate && { endDate: new Date(dto.endDate) }),
            ...(dto.allDay !== undefined && { allDay: dto.allDay }),
            ...(dto.eventType && { eventType: dto.eventType }),
            ...(dto.status && { status: dto.status }),
            ...(dto.priority && { priority: dto.priority }),
            ...(dto.location !== undefined && { location: dto.location }),
            ...(dto.isOnline !== undefined && { isOnline: dto.isOnline }),
            ...(dto.meetingLink !== undefined && {
              meetingLink: dto.meetingLink,
            }),
            ...(dto.processId !== undefined && { processId: dto.processId }),
            updatedAt: new Date(),
          },
        });

        // Atualizar contatos se fornecidos
        if (dto.contactIds !== undefined) {
          await tx.scheduleContact.deleteMany({ where: { scheduleId: id } });
          if (dto.contactIds.length > 0) {
            await tx.scheduleContact.createMany({
              data: dto.contactIds.map((contactId) => ({
                scheduleId: id,
                contactId,
              })),
            });
          }
        }

        // Atualizar participantes se fornecidos
        if (dto.participantIds !== undefined) {
          await tx.scheduleParticipant.deleteMany({
            where: { scheduleId: id },
          });
          if (dto.participantIds.length > 0) {
            await tx.scheduleParticipant.createMany({
              data: dto.participantIds.map((participantId) => ({
                scheduleId: id,
                userId: participantId,
                role:
                  participantId === req.userId
                    ? ParticipantRole.ORGANIZER
                    : ParticipantRole.PARTICIPANT,
                status:
                  participantId === req.userId
                    ? ParticipantStatus.ACCEPTED
                    : ParticipantStatus.PENDING,
              })),
            });
          }
        }

        // Atualizar lembretes se fornecidos
        if (dto.reminders !== undefined) {
          await tx.scheduleReminder.deleteMany({ where: { scheduleId: id } });
          if (dto.reminders.length > 0) {
            await tx.scheduleReminder.createMany({
              data: dto.reminders.map((reminder) => ({
                scheduleId: id,
                reminderTime: this.calculateReminderTime(
                  updated.startDate,
                  reminder.minutesBefore,
                ),
                reminderType: reminder.reminderType,
                minutesBefore: reminder.minutesBefore,
                wasSent: false,
              })),
            });
          }
        }

        const result = await tx.schedule.findUnique({
          where: { id },
          include: {
            contacts: { include: { contact: true } },
            participants: { include: { user: true } },
            reminders: true,
            process: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        if (!result) {
          throw new NotFoundException(
            'Compromisso não encontrado após atualização',
          );
        }

        return result;
      });

      if (!updatedSchedule) {
        throw new NotFoundException(
          'Compromisso não encontrado após atualização',
        );
      }

      // Log de auditoria
      const changes = this.auditLogService.buildDiff(
        previousState,
        updatedSchedule,
        {
          ignoreFields: [
            'contacts',
            'participants',
            'reminders',
            'process',
            'user',
          ],
        },
      );

      if (this.auditLogService.hasChanges(changes)) {
        await this.auditLogService.logChange({
          tableName: 'schedules',
          recordId: updatedSchedule.id,
          action: AuditAction.UPDATE,
          tenantId: req.tenantId,
          performedById: req.userId,
          changes,
        });
      }

      // Sincronizar com Google Calendar (assíncrono, não bloqueia resposta)
      if (this.googleSyncService) {
        this.googleSyncService
          .updateInGoogle(updatedSchedule.id)
          .catch((error) => {
            this.logger.warn(
              `Erro ao sincronizar atualização do evento ${updatedSchedule.id} com Google Calendar: ${error.message}`,
            );
          });
      }

      return updatedSchedule;
    } catch (error) {
      this.logger.error(
        `Error updating schedule: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar compromisso: ${errorMessage}`,
      );
    }
  }

  /**
   * Excluir compromisso (soft delete)
   */
  async remove(id: number, req: CustomRequest, deleteType: string = 'single') {
    this.logger.log(`Deleting schedule ${id}`);

    try {
      const schedule = await this.findOne(id, req);

      let deletedCount = 0;

      if (deleteType === 'all' && schedule.parentScheduleId) {
        // Deletar toda a série
        const result = await this.prisma.schedule.updateMany({
          where: {
            OR: [
              { id: schedule.parentScheduleId },
              { parentScheduleId: schedule.parentScheduleId },
            ],
            tenantId: req.tenantId,
          },
          data: { deletedAt: new Date() },
        });
        deletedCount = result.count;
      } else if (deleteType === 'thisAndFuture' && schedule.isRecurring) {
        // Deletar este e futuros
        const result = await this.prisma.schedule.updateMany({
          where: {
            parentScheduleId: schedule.parentScheduleId || schedule.id,
            startDate: { gte: schedule.startDate },
            tenantId: req.tenantId,
          },
          data: { deletedAt: new Date() },
        });
        deletedCount = result.count;
      } else {
        // Deletar apenas este
        await this.prisma.schedule.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        deletedCount = 1;
      }

      // Log de auditoria
      await this.auditLogService.logChange({
        tableName: 'schedules',
        recordId: schedule.id,
        action: AuditAction.DELETE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: {
          deletedAt: {
            before: schedule.deletedAt,
            after: new Date().toISOString(),
          },
        },
      });

      // Deletar do Google Calendar (assíncrono, não bloqueia resposta)
      if (this.googleSyncService) {
        this.googleSyncService.deleteFromGoogle(schedule.id).catch((error) => {
          this.logger.warn(
            `Erro ao deletar evento ${schedule.id} do Google Calendar: ${error.message}`,
          );
        });
      }

      return { message: 'Compromisso excluído com sucesso', deletedCount };
    } catch (error) {
      this.logger.error(
        `Error deleting schedule: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao excluir compromisso: ${errorMessage}`,
      );
    }
  }

  /**
   * Buscar eventos do calendário (período específico)
   */
  async getCalendarEvents(
    startDate: string,
    endDate: string,
    req: CustomRequest,
  ) {
    this.logger.log(`Getting calendar events from ${startDate} to ${endDate}`);

    try {
      const where: Prisma.ScheduleWhereInput = {
        tenantId: req.tenantId,
        deletedAt: null,
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
      };

      return await this.prisma.schedule.findMany({
        where,
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          allDay: true,
          eventType: true,
          status: true,
          priority: true,
          location: true,
          isOnline: true,
          process: {
            select: {
              processNumber: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `Error getting calendar events: ${JSON.stringify(error)}`,
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
      throw new BadRequestException(
        `Erro ao buscar eventos do calendário: ${errorMessage}`,
      );
    }
  }

  /**
   * Próximos compromissos
   */
  async getUpcoming(req: CustomRequest, days: number = 7, limit: number = 10) {
    this.logger.log(`Getting upcoming schedules for next ${days} days`);

    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + days);

      const where: Prisma.ScheduleWhereInput = {
        tenantId: req.tenantId,
        deletedAt: null,
        startDate: {
          gte: now,
          lte: futureDate,
        },
        status: {
          in: [ScheduleStatus.PENDING, ScheduleStatus.CONFIRMED],
        },
      };

      return await this.prisma.schedule.findMany({
        where,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: {
          process: {
            select: {
              processNumber: true,
              action: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting upcoming schedules: ${JSON.stringify(error)}`,
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
      throw new BadRequestException(
        `Erro ao buscar próximos compromissos: ${errorMessage}`,
      );
    }
  }

  /**
   * Verificar conflitos de horário
   * Verifica conflitos para todos os eventos do escritório (tenantId)
   */
  async checkConflicts(
    startDate: string,
    endDate: string,
    tenantId: number,
    excludeScheduleId?: number,
    allDay?: boolean,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const where: Prisma.ScheduleWhereInput = {
      deletedAt: null,
      tenantId,
      AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
    };

    // Filtrar conflitos baseado em allDay:
    // - Se o evento sendo verificado é de dia inteiro, ignorar eventos específicos
    // - Se o evento sendo verificado é específico, ignorar eventos de dia inteiro
    if (allDay === true) {
      // Evento de dia inteiro: ignorar eventos específicos
      where.allDay = true;
    } else if (allDay === false) {
      // Evento específico: ignorar eventos de dia inteiro
      where.allDay = false;
    }
    // Se allDay não for fornecido, verificar todos os tipos

    if (excludeScheduleId) {
      where.id = { not: excludeScheduleId };
    }

    return await this.prisma.schedule.findMany({
      where,
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        eventType: true,
        allDay: true,
      },
    });
  }

  /**
   * Atualizar status
   */
  async updateStatus(id: number, status: ScheduleStatus, req: CustomRequest) {
    this.logger.log(`Updating schedule ${id} status to ${status}`);

    try {
      const schedule = await this.findOne(id, req);

      const updatedSchedule = await this.prisma.schedule.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      // Log de auditoria
      await this.auditLogService.logChange({
        tableName: 'schedules',
        recordId: schedule.id,
        action: 'UPDATE' as any,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: {
          status: {
            before: schedule.status,
            after: status,
          },
        },
      });

      return updatedSchedule;
    } catch (error) {
      this.logger.error(
        `Error updating schedule status: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar status do compromisso: ${errorMessage}`,
      );
    }
  }

  /**
   * Estatísticas
   */
  async getStats(req: CustomRequest, startDate?: string, endDate?: string) {
    this.logger.log(`Getting schedule stats`);

    try {
      const where: Prisma.ScheduleWhereInput = {
        tenantId: req.tenantId,
        deletedAt: null,
      };

      if (startDate) {
        where.startDate = { gte: new Date(startDate) };
      }
      if (endDate) {
        where.endDate = { lte: new Date(endDate) };
      }

      const [
        total,
        byStatus,
        byEventType,
        byPriority,
        upcomingThisWeek,
        overdue,
      ] = await Promise.all([
        this.prisma.schedule.count({ where }),
        this.prisma.schedule.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        this.prisma.schedule.groupBy({
          by: ['eventType'],
          where,
          _count: true,
        }),
        this.prisma.schedule.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
        this.prisma.schedule.count({
          where: {
            ...where,
            startDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.schedule.count({
          where: {
            ...where,
            endDate: { lt: new Date() },
            status: {
              notIn: [ScheduleStatus.COMPLETED, ScheduleStatus.CANCELLED],
            },
          },
        }),
      ]);

      return {
        total,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        byEventType: Object.fromEntries(
          byEventType.map((e) => [e.eventType, e._count]),
        ),
        byPriority: Object.fromEntries(
          byPriority.map((p) => [p.priority, p._count]),
        ),
        upcomingThisWeek,
        overdueCount: overdue,
      };
    } catch (error) {
      this.logger.error(
        `Error getting stats: ${JSON.stringify(error)}`,
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
      throw new BadRequestException(
        `Erro ao buscar estatísticas: ${errorMessage}`,
      );
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  private validateDates(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      throw new BadRequestException(
        'Data de término deve ser posterior à data de início',
      );
    }
  }

  private calculateReminderTime(startDate: Date, minutesBefore: number): Date {
    const reminderTime = new Date(startDate);
    reminderTime.setMinutes(reminderTime.getMinutes() - minutesBefore);
    return reminderTime;
  }

  private async getUserRole(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    return user?.profile?.name || 'USER';
  }

  /**
   * Atualizar participantes de um compromisso
   */
  async updateParticipants(
    scheduleId: number,
    dto: UpdateParticipantsDto,
    req: CustomRequest,
  ) {
    this.logger.log(`Updating participants for schedule ${scheduleId}`);

    try {
      // Verificar se o compromisso existe e o usuário tem permissão
      const schedule = await this.findOne(scheduleId, req);

      // Atualizar participantes em transação
      const updatedSchedule = await this.prisma.$transaction(async (tx) => {
        // Remover participantes existentes
        await tx.scheduleParticipant.deleteMany({ where: { scheduleId } });

        // Adicionar novos participantes (incluindo o criador como organizador se não estiver na lista)
        const participantUserIds = dto.participants.map((p) => p.userId);
        if (!participantUserIds.includes(req.userId)) {
          participantUserIds.push(req.userId);
        }

        if (participantUserIds.length > 0) {
          await tx.scheduleParticipant.createMany({
            data: participantUserIds.map((participantId) => {
              const participantDto = dto.participants.find(
                (p) => p.userId === participantId,
              );
              return {
                scheduleId,
                userId: participantId,
                role:
                  participantId === req.userId
                    ? ParticipantRole.ORGANIZER
                    : participantDto?.role || ParticipantRole.PARTICIPANT,
                status:
                  participantId === req.userId
                    ? ParticipantStatus.ACCEPTED
                    : ParticipantStatus.PENDING,
              };
            }),
          });
        }

        // Retornar compromisso atualizado
        return await tx.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            participants: { include: { user: true } },
          },
        });
      });

      if (!updatedSchedule) {
        throw new NotFoundException(
          'Compromisso não encontrado após atualização',
        );
      }

      return {
        message: 'Participantes atualizados',
        participants: updatedSchedule.participants,
      };
    } catch (error) {
      this.logger.error(
        `Error updating participants: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar participantes: ${errorMessage}`,
      );
    }
  }

  /**
   * Atualizar lembretes de um compromisso
   */
  async updateReminders(
    scheduleId: number,
    dto: UpdateRemindersDto,
    req: CustomRequest,
  ) {
    this.logger.log(`Updating reminders for schedule ${scheduleId}`);

    try {
      // Verificar se o compromisso existe e o usuário tem permissão
      const schedule = await this.findOne(scheduleId, req);

      // Atualizar lembretes em transação
      const updatedSchedule = await this.prisma.$transaction(async (tx) => {
        // Remover lembretes existentes
        await tx.scheduleReminder.deleteMany({ where: { scheduleId } });

        // Adicionar novos lembretes
        if (dto.reminders && dto.reminders.length > 0) {
          await tx.scheduleReminder.createMany({
            data: dto.reminders.map((reminder) => ({
              scheduleId,
              reminderTime: this.calculateReminderTime(
                schedule.startDate,
                reminder.minutesBefore,
              ),
              reminderType: reminder.reminderType,
              minutesBefore: reminder.minutesBefore,
              wasSent: false,
            })),
          });
        }

        // Retornar compromisso atualizado
        return await tx.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            reminders: true,
          },
        });
      });

      if (!updatedSchedule) {
        throw new NotFoundException(
          'Compromisso não encontrado após atualização',
        );
      }

      return {
        message: 'Lembretes atualizados',
        reminders: updatedSchedule.reminders,
      };
    } catch (error) {
      this.logger.error(
        `Error updating reminders: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar lembretes: ${errorMessage}`,
      );
    }
  }

  /**
   * Atualizar status de participação
   */
  async updateParticipantStatus(
    scheduleId: number,
    userId: number,
    status: ParticipantStatus,
    req: CustomRequest,
  ) {
    this.logger.log(
      `Updating participant status for schedule ${scheduleId}, user ${userId}`,
    );

    try {
      // Verificar se o compromisso existe e o usuário tem permissão
      const schedule = await this.findOne(scheduleId, req);

      // Verificar se o participante existe
      const participant = await this.prisma.scheduleParticipant.findUnique({
        where: {
          scheduleId_userId: {
            scheduleId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new NotFoundException(
          'Participante não encontrado neste compromisso',
        );
      }

      // Atualizar status
      const updatedParticipant = await this.prisma.scheduleParticipant.update({
        where: {
          scheduleId_userId: {
            scheduleId,
            userId,
          },
        },
        data: {
          status,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return updatedParticipant;
    } catch (error) {
      this.logger.error(
        `Error updating participant status: ${JSON.stringify(error)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar status de participação: ${errorMessage}`,
      );
    }
  }

  private async checkPermission(schedule: any, req: CustomRequest) {
    // Verificar apenas se o evento pertence ao mesmo tenantId
    // Todos os usuários do mesmo escritório têm acesso aos eventos do escritório
    if (schedule.tenantId !== req.tenantId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este compromisso',
      );
    }

    return true;
  }
}
