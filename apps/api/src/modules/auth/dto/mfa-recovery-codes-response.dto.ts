import { ApiProperty } from '@nestjs/swagger';

export class MfaRecoveryCodesResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'Códigos de recuperação em texto claro. Exibidos apenas uma vez; guarde em local seguro.',
  })
  recoveryCodes: string[];
}
