import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { FilterDto } from '../../common/dtos/filter.dto';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditLogService } from '../logs/audit-log.service';
import {
  ResponseContactDto,
  ResponseContactListDto,
} from './dto/response-contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CustomRequest } from 'src/common/types/request.interface';
import { TenantLimitsService } from '../limits/tenant-limits.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  async findAll(
    filters: FilterDto,
    req: CustomRequest,
  ): Promise<ResponseContactListDto> {
    this.logger.log(`Finding all contacts: ${JSON.stringify(filters)}`);
    try {
      const {
        currentPage = 1,
        pageSize = 10,
        search,
        order = 'asc',
        orderBy = 'createdAt',
      } = filters;

      const where: Prisma.ContactWhereInput = {
        deletedAt: null,
        tenantId: req.tenantId,
        ...(search && {
          OR: [
            {
              cpfCnpj: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              fullName: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              email: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              companyName: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              tradeName: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }),
      };

      const contacts = await this.prisma.contact.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: {
          Address: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      const total = await this.prisma.contact.count({ where });

      return {
        data: contacts,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        currentPage,
        pageSize,
      };
    } catch (error) {
      this.logger.error(
        `Error finding all contacts: ${JSON.stringify(filters)}`,
        error?.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`Error find contact: ${errorMessage}`);
    }
  }

  async create(
    contact: CreateContactDto,
    req: CustomRequest,
  ): Promise<ResponseContactDto> {
    this.logger.log(`Creating contact: ${JSON.stringify(contact)}`);
    try {
      // Verificar limite de contatos
      await this.tenantLimitsService.checkLimit(req.tenantId, 'contacts', 1);

      // Validar CPF/CNPJ
      this.validateCpfCnpj(contact.cpfCnpj, contact.isCompany);

      // Validar regras de negócio
      this.validateContactBusinessRules(contact);

      const existingContact = await this.prisma.contact.findFirst({
        where: {
          cpfCnpj: contact.cpfCnpj,
          deletedAt: null,
          tenantId: req.tenantId,
        },
      });

      if (existingContact) {
        throw new BadRequestException('CPF/CNPJ já cadastrado');
      }

      const { addresses, ...contactData } = contact;

      const createdContact = await this.prisma.contact.create({
        data: {
          ...contactData,
          dateOfBirth: contactData.dateOfBirth
            ? new Date(contactData.dateOfBirth)
            : null,
          tenantId: req.tenantId,
        },
        include: {
          Address: true,
        },
      });

      if (addresses && addresses.length > 0) {
        await this.prisma.address.createMany({
          data: addresses.map((address) => ({
            ...address,
            contactId: createdContact.id,
          })),
        });
      }

      // Incrementar contador de contatos
      await this.tenantLimitsService.incrementCounter(
        req.tenantId,
        'contacts',
        1,
      );

      await this.auditLogService.logChange({
        tableName: 'contacts',
        recordId: createdContact.id,
        action: AuditAction.CREATE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: this.auditLogService.buildSnapshot(createdContact, {
          ignoreFields: ['Address'],
        }),
      });

      return createdContact;
    } catch (error) {
      this.logger.error(
        `Error creating contact: ${JSON.stringify(contact)}`,
        error?.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Erro desconhecido';
      throw new BadRequestException(`Error create contact: ${errorMessage}`);
    }
  }

  async findById(id: string, req: CustomRequest): Promise<ResponseContactDto> {
    this.logger.log(`Finding contact by id: ${JSON.stringify(id)}`);
    try {
      const contact = await this.prisma.contact.findFirst({
        where: {
          id: parseInt(id),
          deletedAt: null,
          tenantId: req.tenantId,
        },
        include: {
          Address: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (!contact) {
        throw new NotFoundException('Contato não encontrado');
      }

      return contact;
    } catch (error) {
      this.logger.error(
        `Error finding contact by id: ${JSON.stringify(id)}`,
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
      throw new BadRequestException(`Error find contact: ${errorMessage}`);
    }
  }

  async update(
    id: string,
    contact: UpdateContactDto,
    req: CustomRequest,
  ): Promise<ResponseContactDto> {
    this.logger.log(`Updating contact: ${JSON.stringify(id)}`);
    try {
      const existingContact = await this.prisma.contact.findFirst({
        where: {
          id: parseInt(id),
          deletedAt: null,
          tenantId: req.tenantId,
        },
      });

      if (!existingContact) {
        throw new NotFoundException('Contato não encontrado');
      }

      const { addresses, ...contactData } = contact;

      // Validar regras de negócio se há mudanças relevantes
      if (contactData.cpfCnpj || contactData.isCompany !== undefined) {
        const cpfCnpj = contactData.cpfCnpj || existingContact.cpfCnpj;
        const isCompany =
          contactData.isCompany !== undefined
            ? contactData.isCompany
            : existingContact.isCompany;
        this.validateCpfCnpj(cpfCnpj, isCompany);

        // Verificar se CPF/CNPJ não está sendo usado por outro contato
        if (
          contactData.cpfCnpj &&
          contactData.cpfCnpj !== existingContact.cpfCnpj
        ) {
          const duplicateContact = await this.prisma.contact.findFirst({
            where: {
              cpfCnpj: contactData.cpfCnpj,
              deletedAt: null,
              tenantId: req.tenantId,
              id: { not: parseInt(id) },
            },
          });

          if (duplicateContact) {
            throw new BadRequestException(
              'CPF/CNPJ já está sendo usado por outro contato',
            );
          }
        }
      }

      // Validar outras regras de negócio para campos sendo atualizados
      if (
        contactData.isCompany !== undefined ||
        contactData.companyName !== undefined ||
        contactData.fullName !== undefined
      ) {
        const isCompany =
          contactData.isCompany !== undefined
            ? contactData.isCompany
            : existingContact.isCompany;
        const companyName =
          contactData.companyName !== undefined
            ? contactData.companyName
            : existingContact.companyName;
        const fullName =
          contactData.fullName !== undefined
            ? contactData.fullName
            : existingContact.fullName;

        if (isCompany && !companyName) {
          throw new BadRequestException(
            'Nome da empresa é obrigatório para pessoa jurídica',
          );
        }
        if (!isCompany && !fullName) {
          throw new BadRequestException(
            'Nome completo é obrigatório para pessoa física',
          );
        }
      }

      // Validar email se está sendo atualizado
      if (
        contactData.email !== undefined &&
        contactData.email &&
        !this.isValidEmail(contactData.email)
      ) {
        throw new BadRequestException('Email inválido');
      }

      // Limpar dados undefined
      Object.keys(contactData).forEach((key) => {
        if (contactData[key] === undefined) {
          delete contactData[key];
        }
      });

      // Usar transação para garantir consistência
      const result = await this.prisma.$transaction(async (prisma) => {
        // Atualizar dados básicos do contato
        const updatedContact = await prisma.contact.update({
          where: { id: parseInt(id) },
          data: {
            ...contactData,
            ...(contactData.dateOfBirth && {
              dateOfBirth: new Date(contactData.dateOfBirth),
            }),
            updatedAt: new Date(),
          },
        });

        // Processar endereços - se undefined ou array vazio, excluir todos
        if (addresses === undefined || addresses.length === 0) {
          // Se addresses não foi enviado ou é um array vazio, excluir todos os endereços existentes (soft delete)
          await prisma.address.updateMany({
            where: {
              contactId: parseInt(id),
              deletedAt: null,
            },
            data: {
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          // Separar operações de update e create
          const addressesToUpdate = addresses.filter((addr) => addr.id);
          const addressesToCreate = addresses.filter((addr) => !addr.id);

          // Operações de update em lote
          if (addressesToUpdate.length > 0) {
            const updatePromises = addressesToUpdate.map((address) => {
              const { id: addressId, ...addressData } = address;
              return prisma.address.update({
                where: {
                  id: addressId!,
                  contactId: parseInt(id),
                  deletedAt: null,
                },
                data: {
                  ...addressData,
                  updatedAt: new Date(),
                },
              });
            });

            await Promise.all(updatePromises);
          }

          // Operações de create em lote
          if (addressesToCreate.length > 0) {
            const createData = addressesToCreate.map((address) => {
              const { id: _, ...addressData } = address;

              // Validar campos obrigatórios
              if (
                !addressData.type ||
                !addressData.street ||
                !addressData.number ||
                !addressData.postalCode ||
                !addressData.district ||
                !addressData.city ||
                !addressData.state
              ) {
                throw new BadRequestException(
                  'Campos obrigatórios do endereço não informados',
                );
              }

              return {
                type: addressData.type,
                street: addressData.street,
                number: addressData.number,
                complement: addressData.complement,
                postalCode: addressData.postalCode,
                district: addressData.district,
                city: addressData.city,
                state: addressData.state,
                contactId: parseInt(id),
              };
            });

            await prisma.address.createMany({
              data: createData,
            });
          }
        }

        return updatedContact;
      });

      // Buscar o contato atualizado com os endereços
      const finalContact = await this.prisma.contact.findUnique({
        where: { id: parseInt(id) },
        include: {
          Address: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (!finalContact) {
        throw new NotFoundException('Contato não encontrado após atualização');
      }

      const changes = this.auditLogService.buildDiff(
        existingContact,
        finalContact,
        {
          ignoreFields: ['Address', 'updatedAt'],
        },
      );

      if (this.auditLogService.hasChanges(changes)) {
        await this.auditLogService.logChange({
          tableName: 'contacts',
          recordId: finalContact.id,
          action: AuditAction.UPDATE,
          tenantId: req.tenantId,
          performedById: req.userId,
          changes,
        });
      }

      return finalContact;
    } catch (error) {
      this.logger.error(
        `Error updating contact: ${JSON.stringify(id)}`,
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
      throw new BadRequestException(`Error update contact: ${errorMessage}`);
    }
  }

  async delete(id: string, req: CustomRequest): Promise<void> {
    this.logger.log(`Deleting contact: ${JSON.stringify(id)}`);
    try {
      const existingContact = await this.prisma.contact.findFirst({
        where: {
          id: parseInt(id),
          deletedAt: null,
          tenantId: req.tenantId,
        },
      });

      if (!existingContact) {
        throw new NotFoundException('Contato não encontrado');
      }

      const now = new Date();

      // Soft delete de endereços relacionados
      await this.prisma.address.updateMany({
        where: {
          contactId: parseInt(id),
          deletedAt: null,
        },
        data: {
          deletedAt: now,
          updatedAt: now,
        },
      });

      // Soft delete de contas bancárias relacionadas
      await this.prisma.bankAccount.updateMany({
        where: {
          contactId: parseInt(id),
          deletedAt: null,
        },
        data: {
          deletedAt: now,
          updatedAt: now,
        },
      });

      // Soft delete do contato
      await this.prisma.contact.update({
        where: { id: parseInt(id) },
        data: {
          deletedAt: now,
          updatedAt: now,
        },
      });

      // Decrementar contador de contatos
      await this.tenantLimitsService.decrementCounter(
        req.tenantId,
        'contacts',
        1,
      );

      await this.auditLogService.logChange({
        tableName: 'contacts',
        recordId: existingContact.id,
        action: AuditAction.DELETE,
        tenantId: req.tenantId,
        performedById: req.userId,
        changes: {
          deletedAt: {
            before: existingContact.deletedAt,
            after: now.toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting contact: ${JSON.stringify(id)}`,
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
      throw new BadRequestException(`Error delete contact: ${errorMessage}`);
    }
  }

  private validateCpfCnpj(cpfCnpj: string, isCompany: boolean): void {
    this.logger.log(`Validating CPF/CNPJ: ${JSON.stringify(cpfCnpj)}`);
    // Remover caracteres especiais
    const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');

    if (isCompany) {
      // Validar CNPJ (14 dígitos)
      if (cleanCpfCnpj.length !== 14) {
        throw new BadRequestException('CNPJ deve ter 14 dígitos');
      }
      if (!this.isValidCNPJ(cleanCpfCnpj)) {
        throw new BadRequestException('CNPJ inválido');
      }
    } else {
      // Validar CPF (11 dígitos)
      if (cleanCpfCnpj.length !== 11) {
        throw new BadRequestException('CPF deve ter 11 dígitos');
      }
      if (!this.isValidCPF(cleanCpfCnpj)) {
        throw new BadRequestException('CPF inválido');
      }
    }
  }

  private isValidCPF(cpf: string): boolean {
    this.logger.log(`Validating CPF: ${JSON.stringify(cpf)}`);
    // Verificar se não é uma sequência de números iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Calcular primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let firstDigit = 11 - (sum % 11);
    if (firstDigit >= 10) firstDigit = 0;

    // Calcular segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    let secondDigit = 11 - (sum % 11);
    if (secondDigit >= 10) secondDigit = 0;

    // Verificar se os dígitos calculados conferem
    return (
      firstDigit === parseInt(cpf.charAt(9)) &&
      secondDigit === parseInt(cpf.charAt(10))
    );
  }

  private isValidCNPJ(cnpj: string): boolean {
    this.logger.log(`Validating CNPJ: ${JSON.stringify(cnpj)}`);
    // Verificar se não é uma sequência de números iguais
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    // Calcular primeiro dígito verificador
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights1[i];
    }
    let firstDigit = sum % 11;
    firstDigit = firstDigit < 2 ? 0 : 11 - firstDigit;

    // Calcular segundo dígito verificador
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj.charAt(i)) * weights2[i];
    }
    let secondDigit = sum % 11;
    secondDigit = secondDigit < 2 ? 0 : 11 - secondDigit;

    // Verificar se os dígitos calculados conferem
    return (
      firstDigit === parseInt(cnpj.charAt(12)) &&
      secondDigit === parseInt(cnpj.charAt(13))
    );
  }

  private validateContactBusinessRules(
    contact: CreateContactDto | UpdateContactDto,
  ): void {
    this.logger.log(
      `Validating contact business rules: ${JSON.stringify(contact)}`,
    );
    // Validar se dados de pessoa física ou jurídica estão consistentes
    if (contact.isCompany) {
      if (!contact.companyName) {
        throw new BadRequestException(
          'Nome da empresa é obrigatório para pessoa jurídica',
        );
      }
    } else {
      if (!contact.fullName) {
        throw new BadRequestException(
          'Nome completo é obrigatório para pessoa física',
        );
      }
    }

    // Validar email se fornecido
    if (contact.email && !this.isValidEmail(contact.email)) {
      throw new BadRequestException('Email inválido');
    }
  }

  private isValidEmail(email: string): boolean {
    this.logger.log(`Validating email: ${JSON.stringify(email)}`);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
