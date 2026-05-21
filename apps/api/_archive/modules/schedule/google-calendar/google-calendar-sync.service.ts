import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from 'src/database/database.service';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { ScheduleStatus, EventType, Priority } from '@prisma/client';

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  attendees?: Array<{ email: string }>;
  reminders?: { useDefault: boolean };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface LawmanagerGoogleEventMetadata {
  source: string | null;
  scheduleId: number | null;
  tenantId: number | null;
}

@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  // Constantes de configuração para throttling e retry
  private readonly THROTTLE_DELAY_MS = 100000; // Delay entre requisições (10 segundos = 6 req/minuto)
  private readonly MAX_RETRIES = 3; // Máximo de tentativas para retry
  private readonly INITIAL_RETRY_DELAY_MS = 5000; // Delay inicial para retry (5s)

  // Constantes para processamento em lotes
  private readonly BATCH_SIZE = 5; // Número de eventos por lote
  private readonly BATCH_DELAY_MS = 60000; // Delay entre lotes (60 segundos = 2 req/minuto = 120 req/hora)

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: GoogleCalendarAuthService,
  ) {}

  /**
   * Função utilitária para delay (throttling)
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtém cliente do Google Calendar autenticado
   */
  private async getCalendarClient(userId: number) {
    const accessToken = await this.authService.getValidAccessToken(userId);
    const connection = await this.authService.getConnection(userId);

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = connection?.calendarId || 'primary';

    return { calendar, calendarId };
  }

  private buildLawmanagerEventMetadata(schedule: {
    id: number;
    tenantId: number;
  }): NonNullable<GoogleCalendarEvent['extendedProperties']> {
    return {
      private: {
        source: 'lawmanager',
        scheduleId: String(schedule.id),
        tenantId: String(schedule.tenantId),
      },
    };
  }

  private extractLawmanagerEventMetadata(
    event: any,
  ): LawmanagerGoogleEventMetadata {
    const privateProps = event?.extendedProperties?.private ?? {};

    const parsedScheduleId = Number(privateProps.scheduleId);
    const parsedTenantId = Number(privateProps.tenantId);

    return {
      source:
        typeof privateProps.source === 'string' ? privateProps.source : null,
      scheduleId: Number.isInteger(parsedScheduleId) ? parsedScheduleId : null,
      tenantId: Number.isInteger(parsedTenantId) ? parsedTenantId : null,
    };
  }

  /**
   * Usuário cuja credencial OAuth deve ser usada para este compromisso.
   * Mantém `googleSyncedByUserId` quando ainda válido (updates/deletes no calendário correto).
   */
  private async resolveGoogleActorUserId(schedule: {
    userId: number;
    tenantId: number;
    googleSyncedByUserId?: number | null;
  }): Promise<number | null> {
    const stored = schedule.googleSyncedByUserId ?? null;
    if (stored != null) {
      const active = await this.authService.hasActiveConnection(stored);
      if (active) {
        return stored;
      }
      this.logger.warn(
        `Credencial Google (usuário ${stored}) inativa para o compromisso; recalculando via tenant`,
      );
    }
    return this.authService.resolveGoogleCalendarUserId(
      schedule.userId,
      schedule.tenantId,
    );
  }

  /**
   * Converte Schedule para Google Calendar Event
   */
  private scheduleToGoogleEvent(schedule: any): GoogleCalendarEvent {
    // Configurar data/hora primeiro (propriedades obrigatórias)
    let start: { dateTime?: string; date?: string; timeZone?: string };
    let end: { dateTime?: string; date?: string; timeZone?: string };

    if (schedule.allDay) {
      const dateStr = schedule.startDate.toISOString().split('T')[0];
      start = { date: dateStr };
      end = { date: dateStr };
    } else {
      start = {
        dateTime: schedule.startDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
      end = {
        dateTime: schedule.endDate.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
    }

    const event: GoogleCalendarEvent = {
      summary: schedule.title,
      description: schedule.description || '',
      location: schedule.location || undefined,
      start,
      end,
      extendedProperties: this.buildLawmanagerEventMetadata(schedule),
    };

    // Adicionar participantes como attendees
    if (schedule.participants && schedule.participants.length > 0) {
      event.attendees = schedule.participants
        .map((p: any) => p.user?.email)
        .filter((email: string) => email)
        .map((email: string) => ({ email }));
    }

    // Configurar lembretes
    if (schedule.reminders && schedule.reminders.length > 0) {
      event.reminders = { useDefault: false };
    }

    return event;
  }

  /**
   * Converte Google Calendar Event para Schedule
   */
  private googleEventToSchedule(event: any, userId: number, tenantId: number) {
    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : new Date(event.start.date + 'T00:00:00');

    const endDate = event.end.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end.date + 'T23:59:59');

    return {
      title: event.summary || 'Evento sem título',
      description: event.description || null,
      startDate,
      endDate,
      allDay: !event.start.dateTime,
      eventType: EventType.OUTRO,
      status: ScheduleStatus.PENDING,
      priority: Priority.MEDIUM,
      location: event.location || null,
      isOnline: false,
      meetingLink: event.hangoutLink || null,
      userId,
      tenantId,
      googleCalendarEventId: event.id,
      googleSyncedByUserId: userId,
    };
  }

  private async reconcileLawmanagerOwnedGoogleEvent(
    googleEvent: any,
    tenantId: number,
    syncingUserId: number,
    existingScheduleByGoogleEventId?: {
      id: number;
      deletedAt: Date | null;
    } | null,
  ): Promise<'updated' | 'ignored' | 'no-match'> {
    const metadata = this.extractLawmanagerEventMetadata(googleEvent);

    if (metadata.source !== 'lawmanager' || !metadata.scheduleId) {
      return 'no-match';
    }

    if (metadata.tenantId !== null && metadata.tenantId !== tenantId) {
      this.logger.warn(
        `Evento Google ${googleEvent.id} marcado como Lawmanager, mas com tenant ${metadata.tenantId} diferente do tenant sincronizado ${tenantId}. Ignorando importação.`,
      );
      return 'ignored';
    }

    const canonicalSchedule = await this.prisma.schedule.findUnique({
      where: { id: metadata.scheduleId },
    });

    if (!canonicalSchedule || canonicalSchedule.tenantId !== tenantId) {
      this.logger.warn(
        `Evento Google ${googleEvent.id} referencia schedule ${metadata.scheduleId} inexistente no tenant ${tenantId}. Ignorando para evitar duplicidade.`,
      );
      return 'ignored';
    }

    if (canonicalSchedule.deletedAt) {
      this.logger.warn(
        `Evento Google ${googleEvent.id} referencia schedule ${canonicalSchedule.id} já deletado internamente. Ignorando para não ressuscitar compromisso.`,
      );
      return 'ignored';
    }

    if (
      existingScheduleByGoogleEventId &&
      existingScheduleByGoogleEventId.id !== canonicalSchedule.id &&
      !existingScheduleByGoogleEventId.deletedAt
    ) {
      await this.prisma.schedule.update({
        where: { id: existingScheduleByGoogleEventId.id },
        data: { deletedAt: new Date() },
      });

      this.logger.warn(
        `Schedule duplicado ${existingScheduleByGoogleEventId.id} para evento Google ${googleEvent.id} foi marcado como deletado em favor do schedule ${canonicalSchedule.id}.`,
      );
    }

    const scheduleData = this.googleEventToSchedule(
      googleEvent,
      canonicalSchedule.userId,
      tenantId,
    );

    await this.prisma.schedule.update({
      where: { id: canonicalSchedule.id },
      data: {
        title: scheduleData.title,
        description: scheduleData.description,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        allDay: scheduleData.allDay,
        location: scheduleData.location,
        meetingLink: scheduleData.meetingLink,
        googleCalendarEventId: googleEvent.id,
        googleSyncedByUserId: syncingUserId,
        updatedAt: new Date(),
      },
    });

    return 'updated';
  }

  /**
   * Sincroniza evento interno → Google Calendar
   */
  async syncToGoogle(
    scheduleId: number,
    skipGoogleSync = false,
  ): Promise<string | null> {
    if (skipGoogleSync) {
      return null;
    }

    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          participants: {
            include: { user: true },
          },
          reminders: true,
        },
      });

      if (!schedule) {
        throw new NotFoundException('Compromisso não encontrado');
      }

      const googleUserId = await this.resolveGoogleActorUserId(schedule);
      if (!googleUserId) {
        this.logger.debug(
          `Nenhuma conexão Google Calendar ativa para o tenant ${schedule.tenantId} (dono do evento ${schedule.userId})`,
        );
        return null;
      }

      if (googleUserId !== schedule.userId) {
        this.logger.debug(
          `Sync do schedule ${scheduleId} via usuário ${googleUserId} (fallback do tenant; dono ${schedule.userId})`,
        );
      }

      const { calendar, calendarId } =
        await this.getCalendarClient(googleUserId);
      const googleEvent = this.scheduleToGoogleEvent(schedule);

      let googleEventId: string;

      if (schedule.googleCalendarEventId) {
        // Atualizar evento existente
        const response = await calendar.events.update({
          calendarId,
          eventId: schedule.googleCalendarEventId,
          requestBody: googleEvent,
        });
        googleEventId = response.data.id!;
        this.logger.log(
          `Evento ${scheduleId} atualizado no Google Calendar: ${googleEventId}`,
        );
        await this.prisma.schedule.update({
          where: { id: scheduleId },
          data: { googleSyncedByUserId: googleUserId },
        });
      } else {
        // Criar novo evento
        const response = await calendar.events.insert({
          calendarId,
          requestBody: googleEvent,
        });
        googleEventId = response.data.id!;

        // Atualizar schedule com googleCalendarEventId
        await this.prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            googleCalendarEventId: googleEventId,
            googleSyncedByUserId: googleUserId,
          },
        });

        this.logger.log(
          `Evento ${scheduleId} criado no Google Calendar: ${googleEventId}`,
        );
      }

      return googleEventId;
    } catch (error: any) {
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      const statusCode = error?.code || error?.response?.status;

      // Detectar rate limit (código 429 ou mensagem contendo "Rate Limit")
      const isRateLimit =
        statusCode === 429 ||
        errorMessage.includes('Rate Limit') ||
        errorMessage.includes('rateLimitExceeded') ||
        errorMessage.includes('quotaExceeded');

      if (isRateLimit) {
        // Não logar aqui - o retry vai logar com WARN
        // Lançar erro para que possa ser tratado com retry
        throw new Error(`Rate Limit Exceeded: ${errorMessage}`);
      }

      this.logger.error(
        `Erro ao sincronizar evento ${scheduleId} para Google: ${errorMessage}`,
      );
      // Para outros erros, não lançar para não quebrar o fluxo principal
      return null;
    }
  }

  /**
   * Sincroniza evento para Google Calendar com retry e backoff exponencial
   */
  private async syncToGoogleWithRetry(
    scheduleId: number,
    retries = 0,
  ): Promise<string | null> {
    try {
      return await this.syncToGoogle(scheduleId);
    } catch (error: any) {
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      const isRateLimit = errorMessage.includes('Rate Limit Exceeded');

      if (isRateLimit && retries < this.MAX_RETRIES) {
        const delayMs = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
        this.logger.warn(
          `Rate limit detectado para evento ${scheduleId}, tentando novamente em ${delayMs}ms (tentativa ${retries + 1}/${this.MAX_RETRIES})`,
        );
        await this.delay(delayMs);
        return await this.syncToGoogleWithRetry(scheduleId, retries + 1);
      }

      // Se não é rate limit ou excedeu tentativas, lançar erro
      throw error;
    }
  }

  /**
   * Sincroniza eventos do Google Calendar → sistema interno
   */
  async syncFromGoogle(
    userId: number,
    tenantId: number,
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    totalEvents: number;
  }> {
    try {
      const hasConnection = await this.authService.hasActiveConnection(userId);
      if (!hasConnection) {
        return { created: 0, updated: 0, deleted: 0, totalEvents: 0 };
      }

      const { calendar, calendarId } = await this.getCalendarClient(userId);
      const connection = await this.authService.getConnection(userId);

      // Buscar eventos do Google Calendar (últimos 365 dias e próximos 365 dias)
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 365);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 365);

      // Buscar todos os eventos com paginação
      const googleEvents: any[] = [];
      let pageToken: string | undefined = undefined;
      let totalFetched = 0;

      do {
        const response = await calendar.events.list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          maxResults: 2500,
          singleEvents: true,
          orderBy: 'startTime',
          pageToken,
        });

        const items = response.data.items || [];
        googleEvents.push(...items);
        totalFetched += items.length;
        pageToken = response.data.nextPageToken;

        this.logger.debug(
          `Buscando eventos do Google Calendar: ${totalFetched} eventos encontrados${pageToken ? ' (mais páginas disponíveis)' : ''}`,
        );
      } while (pageToken);

      this.logger.log(
        `Total de eventos encontrados no Google Calendar: ${googleEvents.length}`,
      );

      const stats = { created: 0, updated: 0, deleted: 0 };

      // Buscar eventos internos com googleCalendarEventId
      const existingSchedules = await this.prisma.schedule.findMany({
        where: {
          userId,
          tenantId,
          googleCalendarEventId: { not: null },
          deletedAt: null,
        },
      });

      const googleEventIds = new Set(googleEvents.map((e) => e.id));
      const internalEventIds = new Set(
        existingSchedules
          .map((s) => s.googleCalendarEventId)
          .filter((id) => id !== null),
      );

      // Deletar eventos que não existem mais no Google
      const toDelete = existingSchedules.filter(
        (s) =>
          s.googleCalendarEventId &&
          !googleEventIds.has(s.googleCalendarEventId),
      );

      for (const schedule of toDelete) {
        await this.prisma.schedule.update({
          where: { id: schedule.id },
          data: { deletedAt: new Date() },
        });
        stats.deleted++;
      }

      // Criar ou atualizar eventos
      for (const googleEvent of googleEvents) {
        if (!googleEvent.id) {
          this.logger.warn(
            'Evento do Google Calendar sem ID encontrado, ignorando',
          );
          continue;
        }

        try {
          const existingSchedule = existingSchedules.find(
            (s) => s.googleCalendarEventId === googleEvent.id,
          );

          const reconciledLawmanagerEvent =
            await this.reconcileLawmanagerOwnedGoogleEvent(
              googleEvent,
              tenantId,
              userId,
              existingSchedule,
            );

          if (reconciledLawmanagerEvent === 'updated') {
            stats.updated++;
            continue;
          }

          if (reconciledLawmanagerEvent === 'ignored') {
            continue;
          }

          const scheduleData = this.googleEventToSchedule(
            googleEvent,
            userId,
            tenantId,
          );

          if (existingSchedule) {
            // Atualizar evento existente
            await this.prisma.schedule.update({
              where: { id: existingSchedule.id },
              data: {
                ...scheduleData,
                updatedAt: new Date(),
              },
            });
            stats.updated++;
          } else {
            // Criar novo evento
            await this.prisma.schedule.create({
              data: scheduleData,
            });
            stats.created++;
          }
        } catch (error) {
          this.logger.error(
            `Erro ao processar evento do Google Calendar ${googleEvent.id}: ${error.message}`,
          );
          // Continuar processando outros eventos mesmo se um falhar
        }
      }

      // Atualizar lastSyncAt
      await this.prisma.googleCalendarConnection.update({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });

      this.logger.log(
        `Sincronização do Google concluída para usuário ${userId}: ${stats.created} criados, ${stats.updated} atualizados, ${stats.deleted} deletados (total: ${googleEvents.length} eventos)`,
      );

      return {
        ...stats,
        totalEvents: googleEvents.length,
      };
    } catch (error) {
      this.logger.error(`Erro ao sincronizar do Google: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincronização completa bidirecional
   */
  async syncAll(
    userId: number,
    tenantId: number,
  ): Promise<{
    toGoogle: number;
    fromGoogle: {
      created: number;
      updated: number;
      deleted: number;
      totalEvents: number;
    };
  }> {
    // Primeiro sincronizar do Google para o sistema
    const fromGoogle = await this.syncFromGoogle(userId, tenantId);

    // Depois sincronizar eventos internos para o Google
    const schedules = await this.prisma.schedule.findMany({
      where: {
        userId,
        tenantId,
        deletedAt: null,
      },
    });

    this.logger.log(
      `Sincronizando ${schedules.length} eventos internos para o Google Calendar em lotes de ${this.BATCH_SIZE} eventos`,
    );

    let toGoogleCount = 0;
    let failedCount = 0;
    const totalBatches = Math.ceil(schedules.length / this.BATCH_SIZE);

    // Processar eventos em lotes
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * this.BATCH_SIZE;
      const endIndex = Math.min(startIndex + this.BATCH_SIZE, schedules.length);
      const batch = schedules.slice(startIndex, endIndex);
      const batchNumber = batchIndex + 1;

      this.logger.log(
        `Processando lote ${batchNumber}/${totalBatches} (eventos ${startIndex + 1}-${endIndex} de ${schedules.length})`,
      );

      // Processar cada evento do lote
      for (let i = 0; i < batch.length; i++) {
        const schedule = batch[i];

        try {
          const googleEventId = await this.syncToGoogleWithRetry(schedule.id);
          if (googleEventId) {
            toGoogleCount++;
          }

          // Throttling: delay entre requisições dentro do lote (exceto na última do lote)
          if (i < batch.length - 1) {
            await this.delay(this.THROTTLE_DELAY_MS);
          }
        } catch (error: any) {
          failedCount++;
          const errorMessage =
            error?.message || error?.toString() || 'Erro desconhecido';
          const isRateLimit = errorMessage.includes('Rate Limit Exceeded');

          if (isRateLimit) {
            this.logger.error(
              `Erro permanente ao sincronizar schedule ${schedule.id} após ${this.MAX_RETRIES} tentativas: ${errorMessage}`,
            );
            // Aguardar mais tempo antes de continuar para não agravar o rate limit
            await this.delay(this.INITIAL_RETRY_DELAY_MS * 2); // 10 segundos
          } else {
            this.logger.error(
              `Erro permanente ao sincronizar schedule ${schedule.id}: ${errorMessage}`,
            );
          }
        }
      }

      // Log de progresso do lote
      this.logger.log(
        `Lote ${batchNumber}/${totalBatches} concluído: ${toGoogleCount} sucessos, ${failedCount} falhas até agora`,
      );

      // Delay entre lotes (exceto no último lote)
      if (batchIndex < totalBatches - 1) {
        this.logger.log(
          `Aguardando ${this.BATCH_DELAY_MS / 1000} segundos antes do próximo lote...`,
        );
        await this.delay(this.BATCH_DELAY_MS);
      }
    }

    if (failedCount > 0) {
      this.logger.warn(
        `${failedCount} eventos falharam permanentemente ao sincronizar para o Google Calendar`,
      );
    }

    this.logger.log(
      `Sincronização completa concluída: ${toGoogleCount} sucessos, ${failedCount} falhas permanentes. Total: ${fromGoogle.totalEvents} eventos encontrados no Google`,
    );

    return {
      toGoogle: toGoogleCount,
      fromGoogle,
    };
  }

  /**
   * Deleta evento do Google Calendar
   */
  async deleteFromGoogle(scheduleId: number): Promise<void> {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule || !schedule.googleCalendarEventId) {
        return; // Não há evento no Google para deletar
      }

      const googleUserId = await this.resolveGoogleActorUserId(schedule);
      if (!googleUserId) {
        return;
      }

      const { calendar, calendarId } =
        await this.getCalendarClient(googleUserId);

      await calendar.events.delete({
        calendarId,
        eventId: schedule.googleCalendarEventId,
      });

      this.logger.log(`Evento ${scheduleId} deletado do Google Calendar`);
    } catch (error) {
      this.logger.error(
        `Erro ao deletar evento ${scheduleId} do Google: ${error.message}`,
      );
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  /**
   * Atualiza evento no Google Calendar
   */
  async updateInGoogle(scheduleId: number): Promise<string | null> {
    return await this.syncToGoogle(scheduleId);
  }
}
