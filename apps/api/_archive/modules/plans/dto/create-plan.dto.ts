import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  IsIn,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({
    description: 'Nome do plano',
    example: 'Plano Básico',
    required: true,
  })
  @IsNotEmpty({ message: 'O campo name é obrigatório' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Descrição do plano',
    example: 'Plano ideal para pequenos escritórios',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Preço do plano', example: 99.9, required: true })
  @IsNotEmpty({ message: 'O campo price é obrigatório' })
  @IsNumber({}, { message: 'O campo price deve ser um número válido' })
  @Min(0, { message: 'O preço deve ser maior ou igual a zero' })
  price: number;

  @ApiProperty({
    description: 'Ciclo de cobrança',
    example: 'monthly',
    enum: ['monthly', 'yearly'],
    required: false,
  })
  @IsOptional()
  @IsIn(['monthly', 'yearly'], {
    message: 'O billingCycle deve ser "monthly" ou "yearly"',
  })
  billingCycle?: string;

  @ApiProperty({
    description: 'Stripe Price ID para cobrança mensal',
    example: 'price_1RabcDEFgh123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  stripePriceIdMonthly?: string;

  @ApiProperty({
    description: 'Limites do plano',
    example: {
      maxUsers: 10,
      maxContacts: 100,
      maxProcesses: 50,
      maxStorageMB: 1024,
    },
    required: true,
  })
  @IsNotEmpty({ message: 'O campo limits é obrigatório' })
  @IsObject()
  limits: {
    maxUsers?: number;
    maxContacts?: number;
    maxProcesses?: number;
    maxStorageMB?: number;
  };

  @ApiProperty({
    description: 'Features do plano',
    example: { customFields: true, apiAccess: false, prioritySupport: false },
    required: false,
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiProperty({
    description: 'Se o plano está ativo',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Se o plano é visível no catálogo',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
