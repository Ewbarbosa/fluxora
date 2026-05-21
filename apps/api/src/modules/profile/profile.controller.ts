import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import {
  ResponseProfileDto,
  ResponseProfileListDto,
} from './dto/response-profile.dto';
import { FilterProfileDto } from './dto/filter-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';

@Controller('profile')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageUsers')
@ApiBearerAuth()
@ApiTags('Profile')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os perfis do tenant' })
  @ApiResponse({
    status: 200,
    description: 'Lista de perfis encontrada com sucesso.',
    type: ResponseProfileListDto,
  })
  async findAll(@Query() query: FilterProfileDto, @Req() req: CustomRequest) {
    return this.profileService.findAll(query, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um perfil pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Perfil encontrado com sucesso.',
    type: ResponseProfileDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Perfil não encontrado ou não pertence ao tenant',
  })
  async findById(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.profileService.findById(id, req);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo perfil' })
  @ApiResponse({
    status: 201,
    description: 'Perfil criado com sucesso.',
    type: ResponseProfileDto,
  })
  async create(@Body() profile: CreateProfileDto, @Req() req: CustomRequest) {
    return this.profileService.create(profile, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um perfil' })
  @ApiResponse({
    status: 200,
    description: 'Perfil atualizado com sucesso.',
    type: ResponseProfileDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Perfil não encontrado ou não pertence ao tenant',
  })
  async update(
    @Param('id') id: string,
    @Body() profile: UpdateProfileDto,
    @Req() req: CustomRequest,
  ) {
    return this.profileService.update(id, profile, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deleta um perfil' })
  @ApiResponse({ status: 200, description: 'Perfil deletado com sucesso.' })
  @ApiResponse({
    status: 404,
    description: 'Perfil não encontrado ou não pertence ao tenant',
  })
  async delete(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.profileService.delete(id, req);
  }
}
