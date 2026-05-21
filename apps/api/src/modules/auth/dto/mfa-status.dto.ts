import { ApiProperty } from '@nestjs/swagger';

export class MfaStatusDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({
    description: 'Há configuração iniciada aguardando confirmação com TOTP.',
  })
  pendingSetup: boolean;
}
