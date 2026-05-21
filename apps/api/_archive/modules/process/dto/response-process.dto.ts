import { ApiProperty } from '@nestjs/swagger';

export class ResponseProcessDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'forum-1234' })
  forum: string | null;

  @ApiProperty({ example: 'process-1234' })
  processNumber: string;

  @ApiProperty({ example: 'court-division-1234' })
  courtDivision: string | null;

  @ApiProperty({ example: 'action-1234' })
  action: string | null;

  @ApiProperty({ example: '2021-01-01' })
  distributedAt: Date | null;

  @ApiProperty({ example: 100000 })
  causeValue: number | null;

  @ApiProperty({ example: 'pending' })
  status: string | null;

  @ApiProperty({ example: 'observation-1234' })
  observation: string | null;

  @ApiProperty({ example: '2021-01-01' })
  createdAt: Date;

  @ApiProperty({ example: '2021-01-01' })
  updatedAt: Date;

  @ApiProperty({ example: '2021-01-01' })
  deletedAt: Date | null;

  @ApiProperty({ example: 1 })
  tenantId: number;
}

export class ResponseProcessListDto {
  data: ResponseProcessDto[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
