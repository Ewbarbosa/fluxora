import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({ example: 'Administrador' })
  @IsNotEmpty({ message: 'O campo name é obrigatório' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Perfil de administrador do sistema' })
  @IsNotEmpty({ message: 'O campo description é obrigatório' })
  @IsString()
  description: string;

  @ApiProperty({ example: { Adm: true } })
  @IsOptional()
  @IsObject()
  permissions: object;
}
