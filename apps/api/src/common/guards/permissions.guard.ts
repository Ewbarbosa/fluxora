import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/database/database.service';
import {
  ProfilePermissions,
  CustomRequest,
} from 'src/common/types/request.interface';
import { PERMISSION_KEY } from 'src/common/decorators/require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<
      keyof ProfilePermissions | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CustomRequest>();
    const { userId, tenantId } = request;

    const profile = await this.prisma.profile.findFirst({
      where: {
        users: { some: { id: userId, tenantId, deletedAt: null } },
        tenantId,
        deletedAt: null,
      },
      select: { permissions: true },
    });

    const permissions = (profile?.permissions ?? {}) as ProfilePermissions;

    if (permissions.canManageAll === true) {
      return true;
    }

    if (permissions[requiredPermission] !== true) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar esta ação.',
      );
    }

    return true;
  }
}
