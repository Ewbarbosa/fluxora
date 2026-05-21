import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { FilterDto } from 'src/common/dtos/filter.dto';

export class ProcessFilterDto extends FilterDto {
  @ApiPropertyOptional({
    name: 'searchId',
    example: 123,
    description:
      'ID extraído automaticamente de search quando o termo for numérico',
  })
  @IsOptional()
  @Transform(({ obj }) => {
    const rawSearch = obj?.search;
    if (typeof rawSearch !== 'string') return undefined;

    const trimmedSearch = rawSearch.trim();
    if (!/^\d+$/.test(trimmedSearch)) return undefined;

    return Number.parseInt(trimmedSearch, 10);
  })
  @IsNumber()
  searchId?: number;
}
