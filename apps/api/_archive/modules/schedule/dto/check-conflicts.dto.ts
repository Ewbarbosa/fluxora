import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CheckConflictsDto {
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
    description: 'ID do compromisso a excluir da verificação',
    example: 50,
    required: false,
  })
  @IsInt()
  @IsOptional()
  excludeScheduleId?: number;

  @ApiProperty({
    description: 'Evento de dia inteiro',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  allDay?: boolean;
}
