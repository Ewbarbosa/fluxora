import { ApiProperty } from '@nestjs/swagger';
import { ResponseProfileDto } from 'src/modules/profile/dto/response-profile.dto';

export class ResponseUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: '2025-04-27T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-04-27T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 1 })
  profileId: number;

  @ApiProperty({ type: ResponseProfileDto })
  profile: ResponseProfileDto;

  @ApiProperty({ example: 1 })
  tenantId: number;

  @ApiProperty({ example: 'Dynamic IT Consulting' })
  tenantName: string;

  @ApiProperty({ example: '57913270000100' })
  tenantCnpj: string;

  // NÃO colocamos password aqui!
}

export class ResponseUserListDto {
  @ApiProperty({ type: [ResponseUserDto] })
  data: ResponseUserDto[];

  @ApiProperty({ example: 1 })
  totalItems: number;

  @ApiProperty({ example: 1 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: 1 })
  pageSize: number;
}
