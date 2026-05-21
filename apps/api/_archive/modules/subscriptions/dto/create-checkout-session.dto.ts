import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'ID do plano que será contratado no checkout Stripe',
    example: 1,
  })
  @IsInt()
  @Min(1)
  planId: number;
}
