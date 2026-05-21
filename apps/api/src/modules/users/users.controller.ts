import { UsersService } from './users.service';
import {
  Body,
  Controller,
  Post,
  Delete,
  Param,
  BadRequestException,
  Get,
  UseGuards,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseUserDto } from './dto/response-user.dto';
import { AuthGuard } from '../auth/auth.guard';
import { FilterDto } from '../../common/dtos/filter.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';

@Controller('users')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageUsers')
@ApiBearerAuth()
@ApiTags('Users')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os usuários' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários encontrada com sucesso.',
    type: ResponseUserDto,
  })
  async findAll(@Query() query: FilterDto, @Req() req: CustomRequest) {
    return this.usersService.findAll(query, req);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Busca um usuário pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado com sucesso.',
    type: ResponseUserDto,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async getUserById(
    @Param('userId') userId: string,
    @Req() req: CustomRequest,
  ) {
    const id = Number(userId);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid userId');
    }
    return await this.usersService.getById(userId, req);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso.',
    type: ResponseUserDto,
  })
  async createUser(@Body() user: CreateUserDto, @Req() req: CustomRequest) {
    return this.usersService.create(user, req, req.userId);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Atualiza um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado com sucesso.' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() user: UpdateUserDto,
    @Req() req: CustomRequest,
  ) {
    return this.usersService.updateUser(user, userId, req, req.userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário removido com sucesso.' })
  async deleteUser(@Param('userId') userId: string, @Req() req: CustomRequest) {
    return this.usersService.delete(userId, req, req.userId);
  }
}
