import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { ResponseProfileListDto } from './dto/response-profile.dto';
import { FilterProfileDto } from './dto/filter-profile.dto';
import { Prisma } from '@prisma/client';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CustomRequest } from 'src/common/types/request.interface';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  constructor(private prisma: PrismaService) {}

  private getErrorDetails(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack };
    }

    return { message: 'Erro desconhecido' };
  }

  async findAll(
    filters: FilterProfileDto,
    req: CustomRequest,
  ): Promise<ResponseProfileListDto> {
    try {
      const {
        currentPage = 1,
        pageSize = 10,
        search,
        order = 'asc',
        orderBy = 'createdAt',
      } = filters;

      const where: Prisma.ProfileWhereInput = {
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
              description: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }),
      };

      const profiles = await this.prisma.profile.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      });

      const total = await this.prisma.profile.count({ where });

      return {
        data: profiles,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        currentPage,
        pageSize,
      };
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error finding all profiles: ${JSON.stringify(filters)}`,
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
        `Error find profile: ${errorDetails.message}`,
      );
    }
  }

  async findById(id: string, req: CustomRequest) {
    try {
      const profile = await this.prisma.profile.findFirst({
        where: {
          id: Number(id),
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!profile) {
        throw new NotFoundException('Profile not found');
      }

      return profile;
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error finding profile by id: ${JSON.stringify(id)}`,
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
        `Error find profile: ${errorDetails.message}`,
      );
    }
  }

  async create(profile: CreateProfileDto, req: CustomRequest) {
    try {
      // Verificar se já existe um perfil com o mesmo nome no tenant atual
      const profileAlreadyExists = await this.prisma.profile.findFirst({
        where: {
          name: profile.name,
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (profileAlreadyExists) {
        throw new BadRequestException('Profile name already exists');
      }

      const createdProfile = await this.prisma.profile.create({
        data: {
          name: profile.name,
          description: profile.description,
          permissions: profile.permissions,
          tenantId: req.tenantId,
        },
      });

      return createdProfile;
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error creating profile: ${JSON.stringify(profile)}`,
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
        `Error create profile: ${errorDetails.message}`,
      );
    }
  }

  async update(id: string, profile: UpdateProfileDto, req: CustomRequest) {
    try {
      const profileExists = await this.prisma.profile.findFirst({
        where: {
          id: Number(id),
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!profileExists) {
        throw new NotFoundException('Profile not found');
      }

      if (profile.name && profile.name !== profileExists.name) {
        const duplicatedName = await this.prisma.profile.findFirst({
          where: {
            tenantId: req.tenantId,
            name: profile.name,
            deletedAt: null,
            id: { not: Number(id) },
          },
        });

        if (duplicatedName) {
          throw new BadRequestException(
            'Profile name already exists in this tenant',
          );
        }
      }

      return this.prisma.profile.update({
        where: { id: Number(id) },
        data: profile,
      });
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error updating profile: ${JSON.stringify(id)}`,
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
        `Error update profile: ${errorDetails.message}`,
      );
    }
  }

  async delete(id: string, req: CustomRequest) {
    try {
      const profileExists = await this.prisma.profile.findFirst({
        where: {
          id: Number(id),
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (!profileExists) {
        throw new NotFoundException('Profile not found');
      }

      // Verifica se há usuários ativos do tenant vinculados a este perfil
      const usersCount = await this.prisma.user.count({
        where: {
          profileId: Number(id),
          tenantId: req.tenantId,
          deletedAt: null,
        },
      });

      if (usersCount > 0) {
        throw new BadRequestException(
          `Cannot delete profile. There are ${usersCount} active user(s) in your tenant associated with this profile.`,
        );
      }

      // Soft delete - apenas marca como deletado
      return this.prisma.profile.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      const errorDetails = this.getErrorDetails(error);
      this.logger.error(
        `Error deleting profile: ${JSON.stringify(id)}`,
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
        `Error delete profile: ${errorDetails.message}`,
      );
    }
  }
}
