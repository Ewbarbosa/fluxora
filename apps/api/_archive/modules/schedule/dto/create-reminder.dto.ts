import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsEnum, Min } from 'class-validator';
import { ReminderType } from '@prisma/client';

export class CreateReminderDto {
  @ApiProperty({
    description: 'Minutos antes do evento',
    example: 30,
    required: true,
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty({ message: 'minutesBefore é obrigatório' })
  minutesBefore: number;

  @ApiProperty({
    description: 'Tipo de lembrete',
    enum: ReminderType,
    required: true,
  })
  @IsEnum(ReminderType)
  @IsNotEmpty({ message: 'reminderType é obrigatório' })
  reminderType: ReminderType;
}
