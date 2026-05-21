import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  CustomRequest,
  ProfilePermissions,
} from 'src/common/types/request.interface';
import { Request } from 'express';

interface AuthTokenPayload {
  sub: number | string;
  tenantId: number | string;
  tokenType?: string;
  permissions?: ProfilePermissions;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verificar se o endpoint está marcado como público
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CustomRequest>();
    const authorization = this.extractTokenFromHeader(request);
    if (!authorization) throw new UnauthorizedException('Token is required');

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        authorization,
        {
          secret: process.env.SECRET_KEY,
        },
      );

      const userId = Number(payload.sub);
      const tenantId = Number(payload.tenantId);

      if (isNaN(userId) || isNaN(tenantId)) {
        throw new UnauthorizedException('Invalid user or tenant ID in token');
      }

      if (payload.tokenType === 'mfa_pending') {
        throw new UnauthorizedException(
          'Sessão incompleta: conclua a verificação em duas etapas.',
        );
      }

      request.userId = userId;
      request.tenantId = tenantId;
      request.permissions = payload.permissions ?? {};
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      throw new UnauthorizedException(`Invalid token: ${errorMessage}`);
    }
    return true;
  }

  private extractTokenFromHeader(
    request: CustomRequest | Request,
  ): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') || [];
    return type === 'Bearer' ? token : undefined;
  }
}
