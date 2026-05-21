import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, ScheduleStatus, Priority } from '@prisma/client';

export class ScheduleFiltersDto {
  @ApiProperty({ description: 'Página atual', example: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  currentPage?: number = 1;

  @ApiProperty({
    description: 'Itens por página',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;

  @ApiProperty({
    description: 'Data de início do filtro',
    example: '2025-11-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Data de fim do filtro',
    example: '2025-11-30T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Tipo de evento',
    enum: EventType,
    required: false,
  })
  @IsEnum(EventType)
  @IsOptional()
  eventType?: EventType;

  @ApiProperty({ description: 'Status', enum: ScheduleStatus, required: false })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;

  @ApiProperty({ description: 'Prioridade', enum: Priority, required: false })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({
    description: 'Busca por título/descrição',
    example: 'Audiência',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'ID do processo', example: 5, required: false })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  processId?: number;

  @ApiProperty({ description: 'ID do contato', example: 10, required: false })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  contactId?: number;

  @ApiProperty({ description: 'ID do usuário', example: 1, required: false })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  @ApiProperty({
    description: 'Filtrar recorrentes',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Campo para ordenação',
    example: 'startDate',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'startDate';

  @ApiProperty({
    description: 'Ordem de classificação',
    enum: ['ASC', 'DESC'],
    required: false,
  })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
