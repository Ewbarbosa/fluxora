import { ApiPropertyOptional, ApiResponseProperty } from '@nestjs/swagger';

import { IsOptional, IsNumber, IsString, IsArray } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProcessDto {
  @ApiPropertyOptional({ example: 'forum-1234' })
  @IsOptional()
  @IsString()
  forum: string | null;

  @ApiProperty({ example: 'process-1234' })
  @IsNotEmpty()
  @IsString()
  processNumber: string;

  @ApiPropertyOptional({ example: 'court-division-1234' })
  @IsOptional()
  @IsString()
  courtDivision: string | null;

  @ApiPropertyOptional({ example: 'action-1234' })
  @IsOptional()
  @IsString()
  action: string | null;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : null))
  distributedAt: Date | null;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  causeValue: number | null;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status: string | null;

  @ApiPropertyOptional({ example: 'observation-1234' })
  @IsOptional()
  @IsString()
  observation: string | null;

  @ApiProperty({ example: [{ contactId: 1, role: 'AUTOR' }] })
  @IsNotEmpty()
  @IsArray()
  contacts: {
    contactId: number;
    role: string;
  }[];
}
