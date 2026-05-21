import { PartialType } from '@nestjs/swagger';
import { FinancialTransactionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateFinancialTransactionDto } from './create-financial-transaction.dto';

export enum FinancialTransactionUpdateScope {
  SINGLE = 'SINGLE',
  ALL = 'ALL',
}

export class UpdateFinancialTransactionDto extends PartialType(
  CreateFinancialTransactionDto,
) {
  @IsOptional()
  @IsEnum(FinancialTransactionStatus)
  status?: FinancialTransactionStatus;

  @IsOptional()
  @IsEnum(FinancialTransactionUpdateScope)
  updateScope?: FinancialTransactionUpdateScope;
}
