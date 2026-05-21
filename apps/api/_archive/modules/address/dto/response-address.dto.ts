import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '@prisma/client';
import { IsDateString, IsNumber } from 'class-validator';

export class ResponseAddressDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  contactId: number;

  @ApiProperty({ example: 'COMERCIAL', enum: AddressType })
  type: AddressType;

  @ApiProperty({ example: 'Rua Ingu' })
  street: string;

  @ApiProperty({ example: '123' })
  number: string;

  @ApiPropertyOptional({ example: 'Apto 101' })
  complement: string | null;

  @ApiProperty({ example: '03630-040' })
  postalCode: string;

  @ApiProperty({ example: 'Guaiaúna' })
  district: string;

  @ApiProperty({ example: 'São Paulo' })
  city: string;

  @ApiProperty({ example: 'SP' })
  state: string;

  @ApiProperty({ example: '2021-01-01T00:00:00.000Z' })
  @IsDateString()
  createdAt: Date;

  @ApiProperty({ example: '2021-01-01T00:00:00.000Z' })
  @IsDateString()
  updatedAt: Date;

  @ApiPropertyOptional({ example: null })
  @IsDateString()
  deletedAt: Date | null;
}
