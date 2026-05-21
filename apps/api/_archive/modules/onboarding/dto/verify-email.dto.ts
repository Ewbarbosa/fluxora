import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'token-de-verificacao' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
