import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/database/database.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

@Injectable()
export class GoogleCalendarSyncJobService {
  private readonly logger = new Logger(GoogleCalendarSyncJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  /**
   * Sincronização automática a cada hora
   * Cron: 0 * * * * (todo dia, toda hora, no minuto 0)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async syncAllConnections() {
    this.logger.log('Iniciando sincronização automática do Google Calendar...');

    try {
      // Buscar todas as conexões ativas
      const connections = await this.prisma.googleCalendarConnection.findMany({
        where: {
          syncEnabled: true,
        },
        select: {
          userId: true,
          tenantId: true,
          lastSyncAt: true,
        },
      });

      this.logger.log(
        `Encontradas ${connections.length} conexões ativas para sincronizar`,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const connection of connections) {
        try {
          // Sincronizar do Google para o sistema
          await this.syncService.syncFromGoogle(
            connection.userId,
            connection.tenantId,
          );
          successCount++;
          this.logger.debug(
            `Sincronização concluída para usuário ${connection.userId}, tenant ${connection.tenantId}`,
          );
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Erro ao sincronizar usuário ${connection.userId}, tenant ${connection.tenantId}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Sincronização automática concluída: ${successCount} sucessos, ${errorCount} erros`,
      );
    } catch (error) {
      this.logger.error(`Erro na sincronização automática: ${error.message}`);
    }
  }

  /**
   * Sincronização diária completa (bidirecional)
   * Cron: 0 2 * * * (todo dia às 2h da manhã)
   */
  @Cron('0 2 * * *')
  async fullSyncAllConnections() {
    this.logger.log(
      'Iniciando sincronização completa bidirecional do Google Calendar...',
    );

    try {
      const connections = await this.prisma.googleCalendarConnection.findMany({
        where: {
          syncEnabled: true,
        },
        select: {
          userId: true,
          tenantId: true,
        },
      });

      this.logger.log(
        `Encontradas ${connections.length} conexões para sincronização completa`,
      );

      for (const connection of connections) {
        try {
          await this.syncService.syncAll(
            connection.userId,
            connection.tenantId,
          );
          this.logger.debug(
            `Sincronização completa concluída para usuário ${connection.userId}`,
          );
        } catch (error) {
          this.logger.error(
            `Erro na sincronização completa para usuário ${connection.userId}: ${error.message}`,
          );
        }
      }

      this.logger.log('Sincronização completa bidirecional concluída');
    } catch (error) {
      this.logger.error(`Erro na sincronização completa: ${error.message}`);
    }
  }
}
