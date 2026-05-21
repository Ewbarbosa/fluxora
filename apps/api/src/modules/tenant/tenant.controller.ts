import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';

@Controller('tenant')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Tenant')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'Lista o tenant do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Tenant encontrado com sucesso' })
  async findAll(@Req() req: CustomRequest) {
    return this.tenantService.findAll(req);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Busca um tenant pelo ID (apenas o próprio tenant)',
  })
  @ApiResponse({ status: 200, description: 'Tenant encontrado com sucesso' })
  @ApiResponse({ status: 404, description: 'Tenant não encontrado' })
  async findById(@Param('id') id: string, @Req() req: CustomRequest) {
    const tenantId = Number(id);
    if (isNaN(tenantId)) {
      throw new Error('Invalid tenant ID');
    }
    return this.tenantService.findById(tenantId, req);
  }
}
