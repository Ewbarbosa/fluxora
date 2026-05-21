import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, ScheduleStatus, Priority } from '@prisma/client';
import { CreateReminderDto } from './create-reminder.dto';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Título do compromisso',
    example: 'Audiência Trabalhista',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Título é obrigatório' })
  title: string;

  @ApiProperty({
    description: 'Descrição do compromisso',
    example: 'Audiência inicial processo 123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Data de início',
    example: '2025-11-10T10:00:00.000Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty({ message: 'Data de início é obrigatória' })
  startDate: string;

  @ApiProperty({
    description: 'Data de término',
    example: '2025-11-10T11:00:00.000Z',
    required: true,
  })
  @IsDateString()
  @IsNotEmpty({ message: 'Data de término é obrigatória' })
  endDate: string;

  @ApiProperty({
    description: 'Evento de dia inteiro',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allDay?: boolean = false;

  @ApiProperty({
    description: 'Tipo de evento',
    enum: EventType,
    required: true,
  })
  @IsEnum(EventType)
  @IsNotEmpty({ message: 'Tipo de evento é obrigatório' })
  eventType: EventType;

  @ApiProperty({
    description: 'Status do compromisso',
    enum: ScheduleStatus,
    required: false,
  })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus = ScheduleStatus.PENDING;

  @ApiProperty({ description: 'Prioridade', enum: Priority, required: false })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority = Priority.MEDIUM;

  @ApiProperty({
    description: 'Localização',
    example: 'Fórum Trabalhista - Sala 3',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'É evento online',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isOnline?: boolean = false;

  @ApiProperty({
    description: 'Link da reunião',
    example: 'https://meet.google.com/abc-defg-hij',
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingLink?: string;

  @ApiProperty({ description: 'É recorrente', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean = false;

  @ApiProperty({
    description: 'Regra de recorrência (RRule)',
    example: 'FREQ=WEEKLY;BYDAY=MO',
    required: false,
  })
  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @ApiProperty({
    description: 'Data final da recorrência',
    example: '2025-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  recurrenceEndDate?: string;

  @ApiProperty({
    description: 'ID do processo relacionado',
    example: 5,
    required: false,
  })
  @IsInt()
  @IsOptional()
  processId?: number;

  @ApiProperty({
    description: 'IDs dos contatos',
    example: [10, 15],
    required: false,
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  contactIds?: number[] = [];

  @ApiProperty({
    description: 'IDs dos participantes',
    example: [2, 3],
    required: false,
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  participantIds?: number[] = [];

  @ApiProperty({
    description: 'Lembretes',
    type: [CreateReminderDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReminderDto)
  @IsOptional()
  reminders?: CreateReminderDto[] = [];
}
