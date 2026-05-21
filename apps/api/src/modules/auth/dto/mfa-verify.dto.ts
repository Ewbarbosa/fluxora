import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({
    description: 'JWT retornado no login quando mfaRequired for true.',
  })
  @IsString()
  @IsNotEmpty()
  mfaToken: string;

  @ApiProperty({
    description: 'Código TOTP de 6 dígitos ou código de recuperação.',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(64)
  code: string;
}
