import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'Status do compromisso',
    enum: ScheduleStatus,
    required: true,
  })
  @IsEnum(ScheduleStatus)
  @IsNotEmpty({ message: 'Status é obrigatório' })
  status: ScheduleStatus;
}
