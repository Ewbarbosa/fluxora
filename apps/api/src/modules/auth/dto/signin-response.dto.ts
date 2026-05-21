import { ApiPropertyOptional } from '@nestjs/swagger';

export class SignInResponseDto {
  @ApiPropertyOptional({
    description: 'Presente quando o login é concluído sem segunda etapa.',
  })
  access_token?: string;

  @ApiPropertyOptional({
    description: 'Indica que é necessário validar o segundo fator.',
  })
  mfaRequired?: boolean;

  @ApiPropertyOptional({
    description:
      'JWT de curta duração para concluir o login em POST /auth/mfa/verify.',
  })
  mfaToken?: string;
}
