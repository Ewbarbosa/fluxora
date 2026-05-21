import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantLimitsService } from './tenant-limits.service';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';

@Controller('limits')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Limits')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class LimitsController {
  constructor(private readonly tenantLimitsService: TenantLimitsService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Obtém o uso atual dos recursos do tenant' })
  @ApiResponse({ status: 200, description: 'Uso obtido com sucesso' })
  @ApiResponse({
    status: 404,
    description: 'Limites do tenant não encontrados',
  })
  async getUsage(@Req() req: CustomRequest) {
    return this.tenantLimitsService.getUsage(req.tenantId);
  }

  @Get('sync')
  @ApiOperation({
    summary: 'Sincroniza os contadores com os dados reais do banco',
  })
  @ApiResponse({
    status: 200,
    description: 'Contadores sincronizados com sucesso',
  })
  async syncCounters(@Req() req: CustomRequest) {
    await this.tenantLimitsService.syncCounters(req.tenantId);
    return { message: 'Contadores sincronizados com sucesso' };
  }
}
