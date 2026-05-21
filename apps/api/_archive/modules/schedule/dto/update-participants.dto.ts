import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsInt,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ParticipantRole } from '@prisma/client';

export class ParticipantDto {
  @ApiProperty({ description: 'ID do usuário', example: 2, required: true })
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    description: 'Papel do participante',
    enum: ParticipantRole,
    required: false,
  })
  @IsEnum(ParticipantRole)
  @IsOptional()
  role?: ParticipantRole = ParticipantRole.PARTICIPANT;
}

export class UpdateParticipantsDto {
  @ApiProperty({
    description: 'Lista de participantes',
    type: [ParticipantDto],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];
}
