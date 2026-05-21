import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';
import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '@prisma/client';

// DTO específico para atualização de endereços
export class UpdateAddressInContactDto {
  @ApiPropertyOptional({
    example: 1,
    description:
      'ID do endereço para atualizar. Se não informado, será criado um novo endereço',
  })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional({ enum: AddressType, example: 'RESIDENCIAL' })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({ example: 'Rua das Flores' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: '123' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: 'Apto 101' })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional({ example: '01234-567' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Centro' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;
}

export class UpdateContactDto extends PartialType(
  OmitType(CreateContactDto, ['addresses'] as const),
) {
  // Adicionar o campo addresses customizado para atualização
  @ApiPropertyOptional({
    type: [UpdateAddressInContactDto],
    description:
      'Lista de endereços. Para atualizar, informe o ID. Para criar novo, não informe o ID.',
    example: [
      {
        id: 1,
        type: 'RESIDENCIAL',
        street: 'Rua das Flores',
        number: '123',
        postalCode: '01234-567',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      },
      {
        // Novo endereço (sem ID)
        type: 'COMERCIAL',
        street: 'Av. Comercial',
        number: '456',
        postalCode: '01234-890',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAddressInContactDto)
  addresses?: UpdateAddressInContactDto[];
}
