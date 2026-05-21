import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

export class ResponseAuditLogDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'financial_transactions' })
  tableName: string;

  @ApiProperty({ example: 42 })
  recordId: number;

  @ApiProperty({ enum: AuditAction, example: 'UPDATE' })
  action: AuditAction;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        before: { type: 'string' }, // ou 'any' se suportado, mas usar string como exemplo
        after: { type: 'string' },
      },
    },
    example: { field1: { before: 'old', after: 'new' } },
    nullable: true,
  })
  changes: Record<string, { before: any; after: any }> | null;

  @ApiProperty({ example: 1, nullable: true })
  performedById: number | null;

  @ApiProperty({ example: 'João Silva', nullable: true })
  performedByName?: string;

  @ApiProperty({ example: 1 })
  tenantId: number;

  @ApiProperty({ example: 'Empresa XYZ' })
  tenantName?: string;

  @ApiProperty({ example: '2025-09-27T03:30:00.000Z' })
  createdAt: Date;
}

export class ResponseAuditLogListDto {
  @ApiProperty({ type: [ResponseAuditLogDto] })
  data: ResponseAuditLogDto[];

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
