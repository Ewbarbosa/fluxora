import { ApiProperty } from '@nestjs/swagger';
import { FinancialTransactionType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateFinancialCategoryDto {
  @ApiProperty({ example: 'Honorários' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: FinancialTransactionType, example: 'INCOME' })
  @IsEnum(FinancialTransactionType)
  type: FinancialTransactionType;

  @ApiProperty({ example: '#E11D48', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'A cor deve estar no formato hexadecimal, como #E11D48.',
  })
  color?: string;
}
