import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard, Public } from 'src/modules/auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { PrismaService } from 'src/database/database.service';
import {
  GoogleCalendarConnectionStatusDto,
  GoogleCalendarAuthUrlDto,
  GoogleCalendarSyncResponseDto,
  UpdateSyncSettingsDto,
} from './dto/google-calendar-connection.dto';

@Controller('schedule/google')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Google Calendar')
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class GoogleCalendarController {
  constructor(
    private readonly authService: GoogleCalendarAuthService,
    private readonly syncService: GoogleCalendarSyncService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('connect')
  @ApiOperation({
    summary: 'Obter URL de autorização OAuth do Google Calendar',
  })
  @ApiResponse({
    status: 200,
    description: 'URL de autorização gerada com sucesso',
    type: GoogleCalendarAuthUrlDto,
  })
  async getConnectUrl(
    @Req() req: CustomRequest,
  ): Promise<GoogleCalendarAuthUrlDto> {
    const { authUrl, state } = this.authService.getAuthUrl(
      req.userId,
      req.tenantId,
    );
    return { authUrl, state };
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Processar callback do Google OAuth' })
  @ApiQuery({ name: 'code', description: 'Código de autorização do Google' })
  @ApiQuery({ name: 'state', description: 'Estado para validação' })
  @ApiResponse({
    status: 200,
    description: 'Autorização processada com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Código ou estado inválido' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<{ message: string }> {
    if (!code || !state) {
      throw new BadRequestException('Código e estado são obrigatórios');
    }

    await this.authService.handleCallback(code, state);
    return { message: 'Conexão com Google Calendar estabelecida com sucesso' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Verificar status da conexão com Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Status da conexão',
    type: GoogleCalendarConnectionStatusDto,
  })
  async getStatus(
    @Req() req: CustomRequest,
  ): Promise<GoogleCalendarConnectionStatusDto> {
    const connection = await this.authService.getConnection(req.userId);

    if (!connection) {
      return {
        isConnected: false,
      };
    }

    return {
      isConnected: true,
      connectionId: connection.id,
      calendarId: connection.calendarId || undefined,
      syncEnabled: connection.syncEnabled,
      lastSyncAt: connection.lastSyncAt || undefined,
    };
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Desconectar conta do Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Conta desconectada com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Conexão não encontrada' })
  async disconnect(@Req() req: CustomRequest): Promise<{ message: string }> {
    await this.authService.revokeConnection(req.userId, req.tenantId);
    return { message: 'Conexão com Google Calendar revogada com sucesso' };
  }

  @Post('sync')
  @ApiOperation({ summary: 'Forçar sincronização manual com Google Calendar' })
  @ApiResponse({
    status: 200,
    description: 'Sincronização concluída',
    type: GoogleCalendarSyncResponseDto,
  })
  async sync(
    @Req() req: CustomRequest,
  ): Promise<GoogleCalendarSyncResponseDto> {
    const result = await this.syncService.syncAll(req.userId, req.tenantId);

    return {
      syncedCount:
        result.toGoogle +
        result.fromGoogle.created +
        result.fromGoogle.updated +
        result.fromGoogle.deleted,
      createdCount: result.fromGoogle.created,
      updatedCount: result.fromGoogle.updated,
      deletedCount: result.fromGoogle.deleted,
      sentToGoogle: result.toGoogle,
      totalGoogleEvents: result.fromGoogle.totalEvents,
      syncedAt: new Date(),
    };
  }

  @Post('settings')
  @ApiOperation({ summary: 'Atualizar configurações de sincronização' })
  @ApiResponse({
    status: 200,
    description: 'Configurações atualizadas com sucesso',
  })
  async updateSettings(
    @Req() req: CustomRequest,
    @Body() dto: UpdateSyncSettingsDto,
  ): Promise<{ message: string }> {
    const connection = await this.authService.getConnection(req.userId);

    if (!connection) {
      throw new BadRequestException('Conexão Google Calendar não encontrada');
    }

    await this.prisma.googleCalendarConnection.update({
      where: { userId: req.userId },
      data: {
        syncEnabled:
          dto.syncEnabled !== undefined
            ? dto.syncEnabled
            : connection.syncEnabled,
        calendarId:
          dto.calendarId !== undefined ? dto.calendarId : connection.calendarId,
        updatedAt: new Date(),
      },
    });

    return { message: 'Configurações atualizadas com sucesso' };
  }
}
