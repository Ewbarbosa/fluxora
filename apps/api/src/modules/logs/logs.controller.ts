import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilterDto } from '../../common/dtos/filter.dto';
import { LoginLogService } from './login-log.service';
import {
  ResponseLoginLogDto,
  ResponseLoginLogListDto,
} from './dto/response-login-log.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { AuditLogService } from './audit-log.service';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';
import {
  ResponseAuditLogDto,
  ResponseAuditLogListDto,
} from './dto/response-audit-log.dto';

@Controller('logs')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canViewReports')
@ApiBearerAuth()
@ApiTags('Logs')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class LogsController {
  constructor(
    private readonly loginLogService: LoginLogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('login')
  @ApiOperation({ summary: 'Lista todos os logs de login paginados' })
  @ApiResponse({
    status: 200,
    description: 'List of login logs found successfully.',
    type: ResponseLoginLogListDto,
  })
  async findAllLoginLogs(@Query() query: FilterDto, @Req() req: CustomRequest) {
    return this.loginLogService.findAll(query, req.tenantId);
  }

  @Get('login/:id')
  @ApiOperation({ summary: 'Busca um log de login pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Login log found successfully.',
    type: ResponseLoginLogDto,
  })
  @ApiResponse({ status: 404, description: 'Login log not found' })
  async findLoginLogById(@Param('id') id: string, @Req() req: CustomRequest) {
    const logId = Number(id);
    if (isNaN(logId)) {
      throw new BadRequestException('Invalid ID');
    }
    return this.loginLogService.findById(logId, req.tenantId);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Lista todos os logs de auditoria paginados' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs found successfully.',
    type: ResponseAuditLogListDto,
  })
  async findAllAuditLogs(@Query() query: FilterDto, @Req() req: CustomRequest) {
    return this.auditLogService.findAll(query, req.tenantId);
  }

  @Get('audit/:id')
  @ApiOperation({ summary: 'Busca um log de auditoria pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Audit log found successfully.',
    type: ResponseAuditLogDto,
  })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findAuditLogById(@Param('id') id: string, @Req() req: CustomRequest) {
    const logId = Number(id);
    if (isNaN(logId)) {
      throw new BadRequestException('Invalid ID');
    }
    return this.auditLogService.findById(logId, req.tenantId);
  }
}
