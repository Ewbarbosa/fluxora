import { ApiProperty } from '@nestjs/swagger';

export class ResponseLoginLogDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1, nullable: true })
  userId: number | null;

  @ApiProperty({ example: 'João Silva', nullable: true })
  userName?: string;

  @ApiProperty({ example: 'joao@example.com', nullable: true })
  userEmail?: string;

  @ApiProperty({ example: 1, nullable: true })
  tenantId: number | null;

  @ApiProperty({ example: 'Empresa XYZ', nullable: true })
  tenantName?: string;

  @ApiProperty({ example: '192.168.1.100', nullable: true })
  ipAddress: string | null;

  @ApiProperty({
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    nullable: true,
  })
  userAgent: string | null;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2025-09-27T03:30:00.000Z' })
  createdAt: Date;
}

export class ResponseLoginLogListDto {
  @ApiProperty({ type: [ResponseLoginLogDto] })
  data: ResponseLoginLogDto[];

  @ApiProperty({ example: 1 })
  currentPage: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 100 })
  totalRecords: number;

  @ApiProperty({ example: 10 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrevious: boolean;
}
