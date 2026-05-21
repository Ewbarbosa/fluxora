import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { ResponseAddressDto } from './dto/response-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('address')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Address')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 404, description: 'Not found' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo endereço' })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully.',
    type: ResponseAddressDto,
  })
  async create(@Body() address: CreateAddressDto, @Req() req: CustomRequest) {
    return this.addressService.create(address, req);
  }

  @Get('contact/:contactId')
  @ApiOperation({ summary: 'Lista todos os endereços de um contato' })
  @ApiResponse({
    status: 200,
    description: 'Addresses found successfully.',
    type: [ResponseAddressDto],
  })
  async findAllByContact(
    @Param('contactId') contactId: string,
    @Req() req: CustomRequest,
  ) {
    return this.addressService.findAllByContact(Number(contactId), req);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um endereço pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Address found successfully.',
    type: ResponseAddressDto,
  })
  async findById(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.addressService.findById(Number(id), req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um endereço pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully.',
    type: ResponseAddressDto,
  })
  async update(
    @Param('id') id: string,
    @Body() address: UpdateAddressDto,
    @Req() req: CustomRequest,
  ) {
    return this.addressService.update(Number(id), address, req);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deleta um endereço pelo ID (soft delete)' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully.' })
  async delete(@Param('id') id: string, @Req() req: CustomRequest) {
    return this.addressService.delete(Number(id), req);
  }
}
