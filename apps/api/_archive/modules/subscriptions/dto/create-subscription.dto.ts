import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'ID do plano', example: 1, required: true })
  @IsNotEmpty({ message: 'O campo planId é obrigatório' })
  @IsNumber({}, { message: 'O campo planId deve ser um número válido' })
  planId: number;

  @ApiProperty({
    description: 'Se é uma assinatura de trial',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @ApiProperty({
    description: 'Método de pagamento',
    example: 'credit_card',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({
    description: 'ID externo no gateway de pagamento',
    example: 'sub_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  externalId?: string;
}
