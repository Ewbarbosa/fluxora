import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GoogleCalendarConnectionStatusDto {
  @ApiProperty({
    description: 'Indica se o usuário está conectado ao Google Calendar',
  })
  isConnected: boolean;

  @ApiProperty({ description: 'ID da conexão', required: false })
  connectionId?: number;

  @ApiProperty({ description: 'ID do calendário do Google', required: false })
  calendarId?: string;

  @ApiProperty({
    description: 'Indica se a sincronização está habilitada',
    required: false,
  })
  syncEnabled?: boolean;

  @ApiProperty({ description: 'Data da última sincronização', required: false })
  lastSyncAt?: Date;
}

export class GoogleCalendarAuthUrlDto {
  @ApiProperty({ description: 'URL de autorização OAuth do Google' })
  authUrl: string;

  @ApiProperty({ description: 'Estado para validação do callback' })
  state: string;
}

export class GoogleCalendarSyncResponseDto {
  @ApiProperty({ description: 'Número total de eventos sincronizados' })
  syncedCount: number;

  @ApiProperty({ description: 'Número de eventos criados do Google' })
  createdCount: number;

  @ApiProperty({ description: 'Número de eventos atualizados do Google' })
  updatedCount: number;

  @ApiProperty({ description: 'Número de eventos deletados do Google' })
  deletedCount: number;

  @ApiProperty({
    description: 'Número de eventos enviados para o Google Calendar',
  })
  sentToGoogle: number;

  @ApiProperty({
    description: 'Total de eventos encontrados no Google Calendar',
  })
  totalGoogleEvents: number;

  @ApiProperty({ description: 'Data da sincronização' })
  syncedAt: Date;
}

export class UpdateSyncSettingsDto {
  @ApiProperty({
    description: 'Habilitar ou desabilitar sincronização',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  syncEnabled?: boolean;

  @ApiProperty({ description: 'ID do calendário do Google', required: false })
  @IsString()
  @IsOptional()
  calendarId?: string;
}
