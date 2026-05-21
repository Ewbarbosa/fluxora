import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Param,
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
import { FilterDto } from '../../common/dtos/filter.dto';
import { ContactService } from './contact.service';
import {
  ResponseContactDto,
  ResponseContactListDto,
} from './dto/response-contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermission } from 'src/common/decorators/require-permission.decorator';

@Controller('contact')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('canManageContacts')
@ApiBearerAuth()
@ApiTags('Contact')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os contatos' })
  @ApiResponse({
    status: 200,
    description: 'List of contacts found successfully.',
    type: ResponseContactListDto,
  })
  async findAll(@Query() query: FilterDto, @Req() req: CustomRequest) {
    return this.contactService.findAll(query, req);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo contato' })
  @ApiResponse({
    status: 201,
    description: 'Contact created successfully.',
    type: ResponseContactDto,
  })
  async create(@Body() contact: CreateContactDto, @Req() req: CustomRequest) {
    return this.contactService.create(contact, req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um contato pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Contact found successfully.',
    type: ResponseContactDto,
  })
  async findById(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.contactService.findById(id, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um contato pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Contact updated successfully.',
    type: ResponseContactDto,
  })
  async update(
    @Param('id') id: string,
    @Body() contact: UpdateContactDto,
    @Req() req: CustomRequest,
  ) {
    return this.contactService.update(id, contact, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui um contato pelo ID' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully.' })
  async delete(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.contactService.delete(id, req);
  }
}
