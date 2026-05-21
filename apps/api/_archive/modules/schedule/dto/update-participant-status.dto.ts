import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ParticipantStatus } from '@prisma/client';

export class UpdateParticipantStatusDto {
  @ApiProperty({
    description: 'Status de participação',
    enum: ParticipantStatus,
    required: true,
  })
  @IsEnum(ParticipantStatus)
  @IsNotEmpty({ message: 'Status é obrigatório' })
  status: ParticipantStatus;
}
