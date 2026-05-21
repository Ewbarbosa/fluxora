import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FinancialRecurrenceFrequency,
  FinancialTransactionType,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFinancialTransactionDto {
  @ApiProperty({ enum: FinancialTransactionType, example: 'EXPENSE' })
  @IsEnum(FinancialTransactionType)
  type: FinancialTransactionType;

  @ApiProperty({ example: 'Pagamento de fornecedor X' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 1500.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: '2026-04-28T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  competenceDate?: string;

  @ApiPropertyOptional({ example: '2026-05-05T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-05-05T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Pagamento via PIX' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId: number;

  @ApiPropertyOptional({
    enum: FinancialRecurrenceFrequency,
    example: 'MONTHLY',
  })
  @IsOptional()
  @IsEnum(FinancialRecurrenceFrequency)
  recurrenceFrequency?: FinancialRecurrenceFrequency;

  @ApiPropertyOptional({ example: 1, description: 'Intervalo da recorrência' })
  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceInterval?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Quantidade de ocorrências da série',
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  recurrenceCount?: number;

  @ApiPropertyOptional({ example: 3, description: 'Quantidade de parcelas' })
  @IsOptional()
  @IsInt()
  @Min(2)
  installmentCount?: number;
}
