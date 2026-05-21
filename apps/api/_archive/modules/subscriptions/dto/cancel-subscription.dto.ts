import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiProperty({
    description: 'Motivo do cancelamento',
    example: 'Não atende mais às necessidades',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
