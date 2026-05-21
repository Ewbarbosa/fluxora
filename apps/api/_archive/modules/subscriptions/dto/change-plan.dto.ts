import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ description: 'ID do novo plano', example: 2, required: true })
  @IsNotEmpty({ message: 'O campo newPlanId é obrigatório' })
  @IsNumber({}, { message: 'O campo newPlanId deve ser um número válido' })
  newPlanId: number;

  @ApiProperty({
    description: 'Data efetiva da mudança',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}
