import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsObject,
  IsString,
} from 'class-validator';

export class ResponseProfileDto {
  @ApiProperty({ description: 'ID do perfil', example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Nome do perfil', example: 'Administrador' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Descrição do perfil',
    example: 'Perfil de administrador do sistema',
  })
  @IsString()
  description: string | null;

  @ApiProperty({ description: 'Permissões do perfil', example: { Adm: true } })
  @IsObject()
  permissions: any;

  @ApiProperty({
    description: 'Data de criação do perfil',
    example: '2021-01-01T00:00:00.000Z',
  })
  @IsDateString()
  createdAt: Date;

  @ApiProperty({
    description: 'Data de atualização do perfil',
    example: '2021-01-01T00:00:00.000Z',
  })
  @IsDateString()
  updatedAt: Date;
}

export class ResponseProfileListDto {
  @ApiProperty({ description: 'Lista de perfis', type: [ResponseProfileDto] })
  @IsArray()
  data: ResponseProfileDto[];

  @ApiProperty({ description: 'Total de perfis', example: 10 })
  @IsNumber()
  totalItems: number;

  @ApiProperty({ description: 'Total de páginas', example: 1 })
  @IsNumber()
  totalPages: number;

  @ApiProperty({ description: 'Página atual', example: 1 })
  @IsNumber()
  currentPage: number;

  @ApiProperty({ description: 'Perfil por página', example: 10 })
  @IsNumber()
  pageSize: number;
}
