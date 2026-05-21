import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/database.service';
import { ResponseUserDto, ResponseUserListDto } from './dto/response-user.dto';
import { ResponseDto } from 'src/common/dtos/response.dto';
import { FilterDto } from '../../common/dtos/filter.dto';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditLogService } from '../logs/audit-log.service';
import { CustomRequest } from 'src/common/types/request.interface';
import { TenantLimitsService } from '../limits/tenant-limits.service';
import { EmailService } from '../email/email.service';
import { buildVerificationEmailTemplate } from '../email/verification-email.template';

type UserWithRelations = Omit<ResponseUserDto, 'tenantName' | 'tenantCnpj'> & {
  password?: string;
  tenant?: {
    legalName?: string | null;
    name?: string | null;
    cnpj?: string | null;
  } | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly tenantLimitsService: TenantLimitsService,
    private readonly emailService: EmailService,
  ) {}

  private getErrorDetails(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack };
    }

    return { message: 'Erro desconhecido' };
  }

  async findAll(
    filters: FilterDto,
    req: CustomRequest,
  ): Promise<ResponseUserListDto> {
    this.logger.log(`Finding all users: ${JSON.stringify(filters)}`);
    try {
      const {
        currentPage = 1,
        pageSize = 10,
        search,
        order = 'asc',
        orderBy = 'createdAt',
      } = filters;

      const where: Prisma.UserWhereInput = {
        tenantId: req.tenantId,
        deletedAt: null,
        ...(search && {
          OR: [
            {
              name: {
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
          ],
        }),
      };

      const users = await this.prisma.user.findMany({
        where,
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
        orderBy: { [orderBy]: order },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      });

      const total = await this.prisma.user.count({ where });

      const mappedUsers = users.map((user) => this.mapUserResponse(user));

      return {
        data: mappedUsers,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        currentPage,
        pageSize,
      };
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error finding all users: ${JSON.stringify(filters)}`,
        errorDetails.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error find users: ${errorDetails.message}`,
      );
    }
  }

  async getById(
    userId: string,
    req: CustomRequest,
  ): Promise<ResponseDto<ResponseUserDto>> {
    this.logger.log(`Getting user by id: ${JSON.stringify(userId)}`);
    try {
      const id = Number(userId);
      if (isNaN(id)) {
        throw new BadRequestException('Invalid userId');
      }
      const user = await this.prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenantId,
          deletedAt: null,
        },
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
      });
      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      return {
        message: 'Usuário encontrado com sucesso',
        data: this.mapUserResponse(user),
      };
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error getting user by id: ${JSON.stringify(userId)}`,
        errorDetails.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error find user: ${errorDetails.message}`);
    }
  }

  async getByEmail(email: string, tenantId?: number): Promise<ResponseUserDto> {
    this.logger.log(`Getting user by email: ${JSON.stringify(email)}`);
    try {
      const where: Prisma.UserWhereInput = tenantId
        ? { email, tenantId, deletedAt: null }
        : { email, deletedAt: null };

      const user = await this.prisma.user.findFirst({
        where,
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      return this.mapUserResponse(user);
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error getting user by email: ${JSON.stringify(email)}`,
        errorDetails.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error find user: ${errorDetails.message}`);
    }
  }

  async create(
    userData: CreateUserDto,
    req: CustomRequest,
    actorUserId?: number,
  ): Promise<ResponseUserDto> {
    this.logger.log(`Creating user: ${JSON.stringify(userData)}`);
    try {
      const { email, password, tenantId } = userData;

      // Garantir que o usuário só pode criar usuários no próprio tenant
      if (tenantId !== req.tenantId) {
        throw new ForbiddenException(
          'Não é permitido criar usuários em outro tenant',
        );
      }

      // Verificar limite de usuários
      await this.tenantLimitsService.checkLimit(req.tenantId, 'users', 1);

      // Verificar se o email já existe no mesmo tenant
      const userExists = await this.prisma.user.findFirst({
        where: {
          email,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (userExists) {
        throw new BadRequestException(
          'Usuário com este email já existe neste tenant',
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const profile = await this.prisma.profile.findFirst({
        where: {
          id: userData.profileId,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!profile) {
        throw new BadRequestException('Perfil inválido para este tenant');
      }

      const user = await this.prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          tenantId: req.tenantId,
          isEmailVerified: false,
          verificationTokens: {
            create: {
              token: verificationToken,
              expiresAt: verificationExpiresAt,
            },
          },
        },
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
              name: true,
            },
          },
          profile: true,
        },
      });

      // Incrementar contador de usuários
      await this.tenantLimitsService.incrementCounter(req.tenantId, 'users', 1);

      const response = this.mapUserResponse(user);
      const workspaceName =
        user.tenant?.legalName || user.tenant?.name || 'seu workspace';
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      const emailContent = buildVerificationEmailTemplate({
        ownerName: user.name,
        workspaceName,
        verifyUrl,
      });

      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Confirme seu acesso ao Fluxora',
        text: emailContent.text,
        html: emailContent.html,
      });

      await this.auditLogService.logChange({
        tableName: 'users',
        recordId: user.id,
        action: AuditAction.CREATE,
        tenantId: user.tenantId,
        performedById: actorUserId,
        changes: this.auditLogService.buildSnapshot(response, {
          ignoreFields: ['tenantName', 'tenantCnpj', 'profile'],
        }),
      });

      return response;
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error creating user: ${JSON.stringify(userData)}`,
        errorDetails.stack,
      );
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error create user: ${errorDetails.message}`,
      );
    }
  }

  private mapUserResponse(user: UserWithRelations): ResponseUserDto {
    const { password: _, tenant, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      tenantName: tenant?.legalName || tenant?.name || '',
      tenantCnpj: tenant?.cnpj || '',
    };
  }

  async updateUser(
    userData: UpdateUserDto,
    userId: string,
    req: CustomRequest,
    actorUserId?: number,
  ): Promise<ResponseUserDto> {
    this.logger.log(`Updating user: ${JSON.stringify(userId)}`);
    try {
      const id = Number(userId);
      if (isNaN(id)) throw new BadRequestException('Invalid userId');

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      // Verificar se o usuário existe e pertence ao tenant
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenantId,
          deletedAt: null,
        },
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // Se estiver tentando atualizar o email, verificar se não existe outro usuário com o mesmo email no tenant
      if (userData.email && userData.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findFirst({
          where: {
            email: userData.email,
            tenantId: req.tenantId,
            deletedAt: null,
            id: { not: id },
          },
        });

        if (emailExists) {
          throw new BadRequestException(
            'Já existe um usuário com este email neste tenant',
          );
        }
      }

      // Garantir que não é possível alterar o tenantId
      const { tenantId, ...updateData }: UpdateUserDto = userData;
      if (tenantId && tenantId !== req.tenantId) {
        throw new ForbiddenException(
          'Não é permitido alterar o tenant de um usuário',
        );
      }

      if (updateData.profileId) {
        const profile = await this.prisma.profile.findFirst({
          where: {
            id: updateData.profileId,
            tenantId: req.tenantId,
            deletedAt: null,
          },
        });

        if (!profile) {
          throw new BadRequestException('Perfil inválido para este tenant');
        }
      }

      const previousState = this.mapUserResponse(existingUser);

      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          tenant: {
            select: {
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
      });

      const updatedUser = this.mapUserResponse(user);

      const changes = this.auditLogService.buildDiff(
        previousState,
        updatedUser,
        {
          ignoreFields: ['tenantName', 'tenantCnpj', 'profile'],
        },
      );

      if (this.auditLogService.hasChanges(changes)) {
        await this.auditLogService.logChange({
          tableName: 'users',
          recordId: user.id,
          action: AuditAction.UPDATE,
          tenantId: user.tenantId,
          performedById: actorUserId,
          changes,
        });
      }

      return updatedUser;
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error updating user: ${JSON.stringify(userId)}`,
        errorDetails.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error update user: ${errorDetails.message}`,
      );
    }
  }

  async delete(userId: string, req: CustomRequest, actorUserId?: number) {
    this.logger.log(`Deleting user: ${JSON.stringify(userId)}`);
    try {
      const id = Number(userId);
      if (isNaN(id)) {
        throw new BadRequestException('Invalid userId');
      }

      // Verificar se o usuário existe e pertence ao tenant
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // Impedir que o usuário delete a si mesmo
      if (id === req.userId) {
        throw new BadRequestException(
          'Não é permitido deletar seu próprio usuário',
        );
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const deletedAt = updatedUser.deletedAt ?? new Date();

      // Decrementar contador de usuários
      await this.tenantLimitsService.decrementCounter(req.tenantId, 'users', 1);

      await this.auditLogService.logChange({
        tableName: 'users',
        recordId: id,
        action: AuditAction.DELETE,
        tenantId: existingUser.tenantId,
        performedById: actorUserId,
        changes: {
          deletedAt: {
            before: existingUser.deletedAt,
            after: deletedAt,
          },
        },
      });

      return { message: 'Usuário deletado com sucesso' };
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error deleting user: ${JSON.stringify(userId)}`,
        errorDetails.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error delete user: ${errorDetails.message}`,
      );
    }
  }

  async findActiveUserForAuth(
    userId: number,
    tenantId: number,
  ): Promise<ResponseUserDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
      },
      include: {
        tenant: {
          select: {
            name: true,
            cnpj: true,
            legalName: true,
          },
        },
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { password: _, tenant, profile, ...userData } = user;
    return {
      ...userData,
      profile: profile || null,
      tenantName: tenant?.legalName || tenant?.name || '',
      tenantCnpj: tenant?.cnpj || '',
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<ResponseUserDto> {
    this.logger.log(`Validating user: ${JSON.stringify(email)}`);
    // Usar findFirst porque email não é mais único sozinho (é único por tenant)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        tenant: {
          select: {
            name: true,
            cnpj: true,
            legalName: true,
          },
        },
        profile: true,
      },
    });

    if (!user) {
      this.logger.error(`User not found: ${JSON.stringify(email)}`);
      throw new NotFoundException('Usuário não encontrado');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.error(`Invalid credentials: ${JSON.stringify(email)}`);
      throw new UnauthorizedException('Usuário ou senha incorretos');
    }

    if (!user.isEmailVerified) {
      this.logger.error(`Email not verified: ${JSON.stringify(email)}`);
      throw new UnauthorizedException(
        'E-mail não verificado. Por favor, confirme seu e-mail antes de acessar o sistema.',
      );
    }

    const { password: _, tenant, profile, ...userData } = user;
    this.logger.log(`User validated: ${JSON.stringify(email)}`);
    return {
      ...userData,
      profile: profile || null,
      tenantName: tenant?.legalName || tenant?.name || '',
      tenantCnpj: tenant?.cnpj || '',
    };
  }
}
