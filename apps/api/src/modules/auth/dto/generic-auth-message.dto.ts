import { ApiProperty } from '@nestjs/swagger';

export class GenericAuthMessageDto {
  @ApiProperty({
    example:
      'Se existir uma conta com este e-mail, enviaremos um link para redefinição de senha.',
  })
  message: string;
}
