import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('plans')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Plans')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class PlansController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os planos disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Lista de planos encontrada com sucesso',
  })
  async findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um plano pelo ID' })
  @ApiResponse({ status: 200, description: 'Plano encontrado com sucesso' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async findById(@Param('id') id: string) {
    const planId = Number(id);
    if (isNaN(planId)) {
      throw new BadRequestException('Invalid plan ID');
    }
    return this.planService.findById(planId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo plano' })
  @ApiResponse({ status: 201, description: 'Plano criado com sucesso' })
  async create(@Body() planData: CreatePlanDto) {
    return this.planService.create(planData);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um plano' })
  @ApiResponse({ status: 200, description: 'Plano atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async update(@Param('id') id: string, @Body() planData: UpdatePlanDto) {
    const planId = Number(id);
    if (isNaN(planId)) {
      throw new BadRequestException('Invalid plan ID');
    }
    return this.planService.update(planId, planData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um plano (soft delete)' })
  @ApiResponse({ status: 200, description: 'Plano removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  @ApiResponse({
    status: 400,
    description: 'Não é possível deletar plano com assinaturas ativas',
  })
  async delete(@Param('id') id: string) {
    const planId = Number(id);
    if (isNaN(planId)) {
      throw new BadRequestException('Invalid plan ID');
    }
    return this.planService.delete(planId);
  }
}
