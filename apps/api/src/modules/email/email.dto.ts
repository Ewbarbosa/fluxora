import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({
    description: 'Email do destinatário',
    example: 'ewertonb@live.com',
  })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Assunto do email', example: 'Teste de email' })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Corpo do email',
    example: 'Olá, este é um email de teste',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Corpo HTML opcional do email',
    example: '<p>Olá, este é um email de teste</p>',
    required: false,
  })
  @IsOptional()
  @IsString()
  html?: string;
}
