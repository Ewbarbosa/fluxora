import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class MfaRegenerateRecoveryDto {
  @ApiProperty({ description: 'Código TOTP atual (6 dígitos).' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos.' })
  code: string;
}
