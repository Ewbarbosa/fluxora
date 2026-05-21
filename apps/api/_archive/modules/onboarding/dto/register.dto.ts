import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Silva & Associados' })
  @IsString()
  @IsNotEmpty()
  officeName: string;

  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: 'joao@exemplo.com' })
  @IsEmail()
  ownerEmail: string;

  @ApiProperty({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: true, description: 'Aceite dos Termos de Uso e Política de Privacidade' })
  @IsBoolean()
  acceptTerms: boolean;
}
