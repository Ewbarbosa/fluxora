import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  UpdateStatusDto,
  ScheduleFiltersDto,
  CheckConflictsDto,
  UpdateParticipantsDto,
  UpdateParticipantStatusDto,
  UpdateRemindersDto,
} from './dto';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';

@Controller('schedule')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageSchedules')
@ApiBearerAuth()
@ApiTags('Schedule')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo compromisso' })
  @ApiResponse({ status: 201, description: 'Compromisso criado com sucesso' })
  @ApiResponse({ status: 409, description: 'Conflito de horário detectado' })
  create(@Body() dto: CreateScheduleDto, @Req() req: CustomRequest) {
    return this.scheduleService.create(dto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Lista compromissos com filtros e paginação' })
  @ApiResponse({
    status: 200,
    description: 'Lista de compromissos encontrada com sucesso',
  })
  findAll(@Query() filters: ScheduleFiltersDto, @Req() req: CustomRequest) {
    return this.scheduleService.findAll(filters, req);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Busca eventos do calendário para um período' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Data de início (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'Data de fim (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Eventos do calendário encontrados',
  })
  getCalendarEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: CustomRequest,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate e endDate são obrigatórios');
    }
    return this.scheduleService.getCalendarEvents(startDate, endDate, req);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Busca próximos compromissos' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Próximos X dias (padrão: 7)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Máximo de resultados (padrão: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Próximos compromissos encontrados',
  })
  getUpcoming(
    @Req() req: CustomRequest,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.scheduleService.getUpcoming(req, daysNum, limitNum);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtém estatísticas de compromissos' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Data de início do período',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Data de fim do período',
  })
  @ApiResponse({ status: 200, description: 'Estatísticas obtidas com sucesso' })
  getStats(
    @Req() req: CustomRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.scheduleService.getStats(req, startDate, endDate);
  }

  @Post('check-conflicts')
  @ApiOperation({ summary: 'Verifica conflitos de horário' })
  @ApiResponse({
    status: 200,
    description: 'Verificação de conflitos realizada',
  })
  checkConflicts(@Body() dto: CheckConflictsDto, @Req() req: CustomRequest) {
    return this.scheduleService.checkConflicts(
      dto.startDate,
      dto.endDate,
      req.tenantId,
      dto.excludeScheduleId,
      dto.allDay,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um compromisso por ID' })
  @ApiResponse({
    status: 200,
    description: 'Compromisso encontrado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  findOne(@Param('id') id: string, @Req() req: CustomRequest) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.findOne(scheduleId, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um compromisso' })
  @ApiResponse({
    status: 200,
    description: 'Compromisso atualizado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  @ApiResponse({ status: 409, description: 'Conflito de horário detectado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: CustomRequest,
  ) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.update(scheduleId, dto, req);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de um compromisso' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: CustomRequest,
  ) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.updateStatus(scheduleId, dto.status, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui um compromisso' })
  @ApiQuery({
    name: 'deleteType',
    required: false,
    enum: ['single', 'thisAndFuture', 'all'],
    description: 'Tipo de exclusão',
  })
  @ApiResponse({ status: 200, description: 'Compromisso excluído com sucesso' })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  remove(
    @Req() req: CustomRequest,
    @Param('id') id: string,
    @Query('deleteType') deleteType?: string,
  ) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.remove(scheduleId, req, deleteType || 'single');
  }

  @Patch(':id/participants')
  @ApiOperation({
    summary: 'Adiciona/Atualiza participantes de um compromisso',
  })
  @ApiResponse({
    status: 200,
    description: 'Participantes atualizados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  updateParticipants(
    @Param('id') id: string,
    @Body() dto: UpdateParticipantsDto,
    @Req() req: CustomRequest,
  ) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.updateParticipants(scheduleId, dto, req);
  }

  @Patch(':scheduleId/participants/:userId/status')
  @ApiOperation({ summary: 'Atualiza o status de participação de um usuário' })
  @ApiResponse({
    status: 200,
    description: 'Status de participação atualizado',
  })
  @ApiResponse({ status: 404, description: 'Participante não encontrado' })
  updateParticipantStatus(
    @Param('scheduleId') scheduleId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateParticipantStatusDto,
    @Req() req: CustomRequest,
  ) {
    const scheduleIdNum = Number(scheduleId);
    const userIdNum = Number(userId);
    if (isNaN(scheduleIdNum) || isNaN(userIdNum)) {
      throw new BadRequestException('Invalid schedule or user ID');
    }
    return this.scheduleService.updateParticipantStatus(
      scheduleIdNum,
      userIdNum,
      dto.status,
      req,
    );
  }

  @Patch(':id/reminders')
  @ApiOperation({ summary: 'Adiciona/Atualiza lembretes de um compromisso' })
  @ApiResponse({
    status: 200,
    description: 'Lembretes atualizados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Compromisso não encontrado' })
  updateReminders(
    @Param('id') id: string,
    @Body() dto: UpdateRemindersDto,
    @Req() req: CustomRequest,
  ) {
    const scheduleId = Number(id);
    if (isNaN(scheduleId)) {
      throw new BadRequestException('Invalid schedule ID');
    }
    return this.scheduleService.updateReminders(scheduleId, dto, req);
  }
}
