import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { ResponseAddressDto } from './dto/response-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AuditLogService } from '../logs/audit-log.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    address: CreateAddressDto,
    req: CustomRequest,
  ): Promise<ResponseAddressDto> {
    this.logger.log(`Creating address: ${JSON.stringify(address)}`);
    try {
      const contact = await this.prisma.contact.findFirst({
        where: {
          id: address.contactId,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!contact) {
        this.logger.error(
          `Contact not found: ${JSON.stringify(address.contactId)}`,
        );
        throw new NotFoundException(
          'Contato não encontrado ou não pertence ao seu tenant',
        );
      }

      const createdAddress = await this.prisma.address.create({
        data: {
          contactId: address.contactId,
          type: address.type,
          street: address.street,
          number: address.number,
          complement: address.complement,
          postalCode: address.postalCode,
          district: address.district,
          city: address.city,
          state: address.state,
        },
      });

      await this.auditLogService.logChange({
        tableName: 'addresses',
        recordId: createdAddress.id,
        action: AuditAction.CREATE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: this.auditLogService.buildSnapshot(createdAddress, {
          ignoreFields: ['deletedAt'],
        }),
      });

      return createdAddress;
    } catch (error) {
      this.logger.error(
        `Error creating address: ${JSON.stringify(address)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`Erro ao criar endereço: ${errorMessage}`);
    }
  }

  async findAllByContact(
    contactId: number,
    req: CustomRequest,
  ): Promise<ResponseAddressDto[]> {
    this.logger.log(
      `Finding all addresses by contact: ${JSON.stringify(contactId)}`,
    );
    try {
      const contact = await this.prisma.contact.findFirst({
        where: {
          id: contactId,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!contact) {
        this.logger.error(`Contact not found: ${JSON.stringify(contactId)}`);
        throw new NotFoundException(
          'Contato não encontrado ou não pertence ao seu tenant',
        );
      }

      return this.prisma.address.findMany({
        where: {
          contactId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(
        `Error finding addresses: ${JSON.stringify(contactId)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao buscar endereços: ${errorMessage}`,
      );
    }
  }

  async findById(id: number, req: CustomRequest): Promise<ResponseAddressDto> {
    this.logger.log(`Finding address by id: ${JSON.stringify(id)}`);
    try {
      const address = await this.prisma.address.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          contact: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (!address || address.contact.tenantId !== req.tenantId) {
        this.logger.error(`Address not found: ${JSON.stringify(id)}`);
        throw new NotFoundException(
          'Endereço não encontrado ou não pertence ao seu tenant',
        );
      }

      const { contact, ...addressData } = address;
      return addressData as ResponseAddressDto;
    } catch (error) {
      this.logger.error(
        `Error finding address: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`Erro ao buscar endereço: ${errorMessage}`);
    }
  }

  async update(
    id: number,
    address: UpdateAddressDto,
    req: CustomRequest,
  ): Promise<ResponseAddressDto> {
    this.logger.log(`Updating address: ${JSON.stringify(id)}`);
    try {
      const existingAddress = await this.prisma.address.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          contact: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (
        !existingAddress ||
        existingAddress.contact.tenantId !== req.tenantId
      ) {
        this.logger.error(`Address not found: ${JSON.stringify(id)}`);
        throw new NotFoundException(
          'Endereço não encontrado ou não pertence ao seu tenant',
        );
      }

      Object.keys(address).forEach((key) => {
        if (address[key] === undefined) {
          delete address[key];
        }
      });

      const updatedAddress = await this.prisma.address.update({
        where: { id },
        data: {
          ...address,
          updatedAt: new Date(),
        },
      });

      const changes = this.auditLogService.buildDiff(
        existingAddress,
        updatedAddress,
        {
          ignoreFields: ['contact', 'updatedAt', 'deletedAt'],
        },
      );

      if (this.auditLogService.hasChanges(changes)) {
        await this.auditLogService.logChange({
          tableName: 'addresses',
          recordId: updatedAddress.id,
          action: AuditAction.UPDATE,
          tenantId: req.tenantId,
          performedById: req.userId,
          changes,
        });
      }

      return updatedAddress;
    } catch (error) {
      this.logger.error(
        `Error updating address: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao atualizar endereço: ${errorMessage}`,
      );
    }
  }

  async delete(id: number, req: CustomRequest): Promise<void> {
    this.logger.log(`Deleting address: ${JSON.stringify(id)}`);
    try {
      const existingAddress = await this.prisma.address.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          contact: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (
        !existingAddress ||
        existingAddress.contact.tenantId !== req.tenantId
      ) {
        this.logger.error(`Address not found: ${JSON.stringify(id)}`);
        throw new NotFoundException(
          'Endereço não encontrado ou não pertence ao seu tenant',
        );
      }

      const updatedAddress = await this.prisma.address.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.auditLogService.logChange({
        tableName: 'addresses',
        recordId: updatedAddress.id,
        action: AuditAction.DELETE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: {
          deletedAt: {
            before: existingAddress.deletedAt,
            after: updatedAddress.deletedAt,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting address: ${JSON.stringify(id)}`,
        error?.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(
        `Erro ao excluir endereço: ${errorMessage}`,
      );
    }
  }

  async validateAddressBusinessRules(
    contactId: number,
    type: any,
    excludeAddressId?: number,
  ): Promise<void> {
    this.logger.log(
      `Validating address business rules: ${JSON.stringify(contactId)}`,
    );
    const existingAddress = await this.prisma.address.findFirst({
      where: {
        contactId,
        type: type,
        deletedAt: null,
        ...(excludeAddressId && { id: { not: excludeAddressId } }),
      },
    });

    if (existingAddress) {
      this.logger.error(
        `Existing address found: ${JSON.stringify(existingAddress)}`,
      );
      throw new BadRequestException(
        `Já existe um endereço do tipo ${type} para este contato`,
      );
    }
  }
}
