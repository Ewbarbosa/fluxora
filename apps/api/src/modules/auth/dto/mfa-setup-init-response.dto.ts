import { ApiProperty } from '@nestjs/swagger';

export class MfaSetupInitResponseDto {
  @ApiProperty({
    description: 'URI otpauth para gerar QR code no cliente.',
  })
  otpauthUrl: string;
}
