import { ApiProperty } from '@nestjs/swagger';
import { FinancialTransactionType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFinancialCategoryDto {
  @ApiProperty({ example: 'Honorários' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: FinancialTransactionType, example: 'INCOME' })
  @IsEnum(FinancialTransactionType)
  type: FinancialTransactionType;
}
