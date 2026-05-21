import {
  Controller,
  Get,
  Query,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProcessService } from './process.service';
import {
  ResponseProcessDto,
  ResponseProcessListDto,
} from './dto/response-process.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';

@Controller('process')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageProcesses')
@ApiBearerAuth()
@ApiTags('Process')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os processos' })
  @ApiResponse({
    status: 200,
    description: 'List of processes found successfully.',
    type: ResponseProcessListDto,
  })
  async findAll(@Query() query: ProcessFilterDto, @Req() req: CustomRequest) {
    return this.processService.findAll(query, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um processo pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Process found successfully.',
    type: ResponseProcessDto,
  })
  async findById(@Param('id') id: number, @Req() req: CustomRequest) {
    return this.processService.findById(id, req);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo processo' })
  @ApiResponse({
    status: 201,
    description: 'Process created successfully.',
    type: ResponseProcessDto,
  })
  async create(@Body() data: CreateProcessDto, @Req() req: CustomRequest) {
    return this.processService.create(data, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um processo existente' })
  @ApiResponse({
    status: 200,
    description: 'Process updated successfully.',
    type: ResponseProcessDto,
  })
  async update(
    @Param('id') id: number,
    @Body() data: UpdateProcessDto,
    @Req() req: CustomRequest,
  ) {
    console.log('update', id, data);
    return this.processService.update(id, data, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui um processo' })
  @ApiResponse({ status: 200, description: 'Process deleted successfully.' })
  async delete(@Param('id') id: number, @Req() req: CustomRequest) {
    return this.processService.delete(id, req);
  }
}
