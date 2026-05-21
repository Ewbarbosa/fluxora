import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class FilterDto {
  @ApiPropertyOptional({ name: 'currentPage', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  currentPage?: number = 1;

  @ApiPropertyOptional({ name: 'pageSize', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({ name: 'search', example: 'John Doe' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ name: 'order', example: 'asc' })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ name: 'orderBy', example: 'createdAt' })
  @IsOptional()
  @IsString()
  orderBy?: string = 'createdAt';
}
