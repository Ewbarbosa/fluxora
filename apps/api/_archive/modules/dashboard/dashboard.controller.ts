import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardDto } from './dto/dashboard.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';

@Controller('dashboard')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna as informações do dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard found successfully.',
    type: DashboardDto,
  })
  async getDashboard(@Req() req: CustomRequest) {
    return this.dashboardService.getDashboard(req);
  }
}
