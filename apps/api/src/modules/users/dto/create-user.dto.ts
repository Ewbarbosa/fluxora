import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Ewerton',
    required: true,
  })
  @IsNotEmpty({ message: 'O campo name é obrigatório' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'ewertonb@live.com',
    required: true,
  })
  @IsNotEmpty({ message: 'O campo email é obrigatório' })
  @IsEmail({}, { message: 'O campo email deve ser um email válido' })
  email: string;

  @ApiProperty({ example: 'Aa123456!' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/(?=.*[a-z])/, {
    message: 'A senha deve conter pelo menos uma letra minúscula',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'A senha deve conter pelo menos uma letra maiúscula',
  })
  @Matches(/(?=.*\d)/, { message: 'A senha deve conter pelo menos um número' })
  @Matches(/(?=.*[@$!%*?&])/, {
    message: 'A senha deve conter pelo menos um caractere especial',
  })
  password: string;

  @ApiProperty({ example: 1 })
  @IsNumber({}, { message: 'O campo profileId deve ser um número válido' })
  profileId: number;

  @ApiProperty({ example: 1 })
  @IsNumber({}, { message: 'O campo tenantId deve ser um número válido' })
  tenantId: number;

  @IsOptional()
  createdById?: number;
}
