import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsBoolean } from 'class-validator';
import { Gender, MaritalStatus } from '@prisma/client';

export class ResponseContactDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '12345678901' })
  cpfCnpj: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCompany: boolean;

  @ApiProperty({ example: 'John Doe' })
  fullName: string | null;

  @ApiProperty({ example: '12345678901' })
  rg: string | null;

  @ApiProperty({ example: '1990-01-01' })
  @IsDateString()
  dateOfBirth: Date | null;

  @ApiProperty({ example: 'MALE', enum: Gender })
  gender: Gender | null;

  @ApiProperty({ example: 'SINGLE', enum: MaritalStatus })
  maritalStatus: MaritalStatus | null;

  @ApiProperty({ example: '12345678901' })
  phone: string | null;

  @ApiProperty({ example: 'john@example.com' })
  email: string | null;

  @ApiProperty({ example: 'Administrador' })
  occupation: string | null;

  @ApiProperty({ example: '12345678901' })
  workCard: string | null;

  @ApiProperty({ example: '12345678901' })
  pisNumber: string | null;

  @ApiProperty({ example: 'John Doe' })
  fatherName: string | null;

  @ApiProperty({ example: 'John Doe' })
  motherName: string | null;

  @ApiProperty({ example: 'Dynamic Company' })
  companyName: string | null;

  @ApiProperty({ example: 'Dynamic Company' })
  tradeName: string | null;

  @ApiProperty({ example: '12345678901' })
  stateRegistration: string | null;

  @ApiProperty({ example: '12345678901' })
  municipalRegistration: string | null;

  @ApiProperty({ example: 'John Doe' })
  responsiblePerson: string | null;

  @ApiProperty({ example: '12345678901' })
  responsibleCpf: string | null;

  @ApiProperty({ example: '2021-01-01' })
  @IsDateString()
  createdAt: Date;

  @ApiProperty({ example: '2021-01-01' })
  @IsDateString()
  updatedAt: Date | null;

  @ApiProperty({ example: '2021-01-01' })
  @IsDateString()
  deletedAt: Date | null;

  @ApiProperty({ example: 1 })
  @IsNumber()
  tenantId: number;
}

export class ResponseContactListDto {
  @ApiProperty({ type: [ResponseContactDto] })
  data: ResponseContactDto[];

  @ApiProperty({ example: 1 })
  @IsNumber()
  totalItems: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  totalPages: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  currentPage: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  pageSize: number;
}
