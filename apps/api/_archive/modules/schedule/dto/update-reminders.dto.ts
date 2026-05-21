import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReminderDto } from './create-reminder.dto';

export class UpdateRemindersDto {
  @ApiProperty({
    description: 'Lista de lembretes',
    type: [CreateReminderDto],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReminderDto)
  reminders: CreateReminderDto[];
}
