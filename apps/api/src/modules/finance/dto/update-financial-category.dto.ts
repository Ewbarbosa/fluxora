import { PartialType } from '@nestjs/swagger';
import { CreateFinancialCategoryDto } from './create-financial-category.dto';

export class UpdateFinancialCategoryDto extends PartialType(
  CreateFinancialCategoryDto,
) {}
