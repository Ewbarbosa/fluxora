import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';
import { CustomRequest } from 'src/common/types/request.interface';
import { FinanceService } from './finance.service';
import { CreateFinancialCategoryDto } from './dto/create-financial-category.dto';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { FinancialTransactionFilterDto } from './dto/financial-transaction-filter.dto';
import { MarkTransactionPaidDto } from './dto/mark-transaction-paid.dto';
import { UpdateFinancialCategoryDto } from './dto/update-financial-category.dto';
import {
  FinancialTransactionUpdateScope,
  UpdateFinancialTransactionDto,
} from './dto/update-financial-transaction.dto';
import { FinancialTransactionType } from '@prisma/client';

@Controller('finance')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageFinance')
@ApiBearerAuth()
@ApiTags('Finance')
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden' })
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('categories')
  @ApiOperation({ summary: 'Criar categoria financeira' })
  async createCategory(
    @Body() data: CreateFinancialCategoryDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.createCategory(data, req);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorias financeiras' })
  @ApiQuery({ name: 'type', required: false, enum: FinancialTransactionType })
  async getCategories(
    @Req() req: CustomRequest,
    @Query('type') type?: FinancialTransactionType,
  ) {
    return this.financeService.getCategories(req, type);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Atualizar categoria financeira' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateFinancialCategoryDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.updateCategory(id, data, req);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Excluir categoria financeira (soft delete)' })
  async deleteCategory(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.deleteCategory(id, req);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Criar lançamento financeiro' })
  async createTransaction(
    @Body() data: CreateFinancialTransactionDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.createTransaction(data, req);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Listar lançamentos financeiros com filtros' })
  async getTransactions(
    @Query() filters: FinancialTransactionFilterDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.getTransactions(filters, req);
  }

  @Patch('transactions/:id/pay')
  @ApiOperation({ summary: 'Marcar lançamento como pago' })
  async markTransactionAsPaid(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MarkTransactionPaidDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.markTransactionAsPaid(id, req, body);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Atualizar lançamento financeiro' })
  async updateTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateFinancialTransactionDto,
    @Req() req: CustomRequest,
  ) {
    return this.financeService.updateTransaction(id, data, req);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Excluir lançamento financeiro (soft delete)' })
  async cancelTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CustomRequest,
    @Query('deleteScope') deleteScope?: FinancialTransactionUpdateScope,
  ) {
    return this.financeService.cancelTransaction(id, req, deleteScope);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro do período' })
  async getSummary(
    @Req() req: CustomRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getSummary(req, startDate, endDate);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Alertas operacionais de financeiro' })
  async getNotifications(@Req() req: CustomRequest) {
    return this.financeService.getNotifications(req);
  }
}
