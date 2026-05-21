import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ExternalIdentityProvider,
  Prisma,
  WorkspaceAccessTier,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/database/database.service';
import { ResponseUserDto } from '../users/dto/response-user.dto';
import { AuthService } from './auth.service';
import { TenantLimitsService } from '../limits/tenant-limits.service';

interface OidcClientModule {
  discovery: (
    issuer: URL,
    clientId: string,
    clientSecret?: string,
  ) => Promise<unknown>;
  randomPKCECodeVerifier: () => string;
  calculatePKCECodeChallenge: (codeVerifier: string) => Promise<string>;
  randomState: () => string;
  randomNonce: () => string;
  buildAuthorizationUrl: (
    config: unknown,
    parameters: Record<string, string>,
  ) => URL;
  authorizationCodeGrant: (
    config: unknown,
    currentUrl: URL,
    checks?: {
      pkceCodeVerifier?: string;
      expectedState?: string;
      expectedNonce?: string;
    },
  ) => Promise<{
    access_token?: string;
    claims: () => {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      given_name?: string;
    };
  }>;
  fetchUserInfo: (
    config: unknown,
    accessToken: string,
    expectedSubject: string,
  ) => Promise<{
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
  }>;
}

interface GoogleCallbackResult {
  access_token: string;
  isNewUser: boolean;
  user: ResponseUserDto;
  workspace: {
    id: number;
    name: string;
    accessTier: WorkspaceAccessTier;
    trialStartsAt: Date | null;
    trialEndsAt: Date | null;
  };
  redirectUrl?: string;
}

@Injectable()
export class SsoService {
  private oidcCache: Promise<{
    client: OidcClientModule;
    config: unknown;
  }> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  async buildGoogleAuthorizationUrl(request: Request): Promise<string> {
    const { client, config } = await this.getGoogleOidc();
    const redirectUri = this.getGoogleRedirectUri(request);
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    await this.prisma.ssoAuthorizationSession.create({
      data: {
        provider: ExternalIdentityProvider.GOOGLE,
        state,
        codeVerifier,
        nonce,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      prompt: 'select_account',
    });

    return authorizationUrl.toString();
  }

  async handleGoogleCallback(request: Request): Promise<GoogleCallbackResult> {
    const currentUrl = new URL(
      request.originalUrl || request.url,
      this.getBaseUrl(request),
    );
    const state = currentUrl.searchParams.get('state');

    if (!state) {
      throw new BadRequestException('Callback do Google sem state.');
    }

    const session = await this.prisma.ssoAuthorizationSession.findFirst({
      where: {
        provider: ExternalIdentityProvider.GOOGLE,
        state,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Sessão de autenticação SSO inválida ou expirada.',
      );
    }

    try {
      const { client, config } = await this.getGoogleOidc();
      const tokenResponse = await client.authorizationCodeGrant(
        config,
        currentUrl,
        {
          pkceCodeVerifier: session.codeVerifier,
          expectedState: session.state,
          expectedNonce: session.nonce,
        },
      );

      if (!tokenResponse.access_token) {
        throw new UnauthorizedException('Google não retornou access token.');
      }

      const claims = tokenResponse.claims();
      const userInfo = await client.fetchUserInfo(
        config,
        tokenResponse.access_token,
        claims.sub,
      );

      const email = userInfo.email ?? claims.email;
      const isEmailVerified = userInfo.email_verified ?? claims.email_verified;

      if (!email) {
        throw new BadRequestException(
          'A conta Google não retornou um e-mail utilizável.',
        );
      }

      if (!isEmailVerified) {
        throw new BadRequestException(
          'A conta Google precisa ter e-mail verificado para usar SSO.',
        );
      }

      const safeEmail = email;
      const displayName = userInfo.name ?? claims.name ?? safeEmail;
      const givenName = userInfo.given_name ?? claims.given_name ?? displayName;

      const { user, isNewUser } = await this.findOrCreateGoogleUser({
        providerUserId: claims.sub,
        email: safeEmail,
        displayName,
        givenName,
      });

      const workspace = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          accessTier: true,
          trialStartsAt: true,
          trialEndsAt: true,
        },
      });

      if (!workspace) {
        throw new InternalServerErrorException(
          'Workspace não encontrado após login SSO.',
        );
      }

      const access_token = this.authService.createAccessToken(user);
      const redirectUrl = this.buildSsoSuccessRedirectUrl(
        access_token,
        workspace.id,
      );

      return {
        access_token,
        isNewUser,
        user,
        workspace,
        redirectUrl,
      };
    } finally {
      await this.prisma.ssoAuthorizationSession.deleteMany({
        where: { id: session.id },
      });
    }
  }

  private async findOrCreateGoogleUser(params: {
    providerUserId: string;
    email: string;
    displayName: string;
    givenName: string;
  }): Promise<{ user: ResponseUserDto; isNewUser: boolean }> {
    const existingIdentity = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: ExternalIdentityProvider.GOOGLE,
          providerUserId: params.providerUserId,
        },
      },
      include: {
        user: {
          include: {
            tenant: {
              select: {
                name: true,
                legalName: true,
                cnpj: true,
              },
            },
            profile: true,
          },
        },
      },
    });

    if (existingIdentity?.user && !existingIdentity.user.deletedAt) {
      await this.prisma.externalIdentity.update({
        where: { id: existingIdentity.id },
        data: {
          email: params.email,
          lastLoginAt: new Date(),
        },
      });

      await this.tenantLimitsService.applyFreeTierIfTrialExpired(
        existingIdentity.user.tenantId,
      );

      return {
        user: this.mapUserForAuth(existingIdentity.user),
        isNewUser: false,
      };
    }

    const usersByEmail = await this.prisma.user.findMany({
      where: {
        email: params.email,
        deletedAt: null,
      },
      include: {
        tenant: {
          select: {
            name: true,
            legalName: true,
            cnpj: true,
          },
        },
        profile: true,
      },
    });

    if (usersByEmail.length > 1) {
      throw new ConflictException(
        'Existe mais de um workspace com este e-mail. Vincule manualmente antes de usar SSO.',
      );
    }

    if (usersByEmail.length === 1) {
      const matchedUser = usersByEmail[0];

      await this.prisma.externalIdentity.create({
        data: {
          provider: ExternalIdentityProvider.GOOGLE,
          providerUserId: params.providerUserId,
          email: params.email,
          lastLoginAt: new Date(),
          userId: matchedUser.id,
        },
      });

      await this.tenantLimitsService.applyFreeTierIfTrialExpired(
        matchedUser.tenantId,
      );

      return {
        user: this.mapUserForAuth(matchedUser),
        isNewUser: false,
      };
    }

    const randomPassword = await bcrypt.hash(randomUUID(), 10);
    const workspaceName = `Workspace de ${params.givenName}`;

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: workspaceName,
          legalName: workspaceName,
          email: params.email,
          accessTier: WorkspaceAccessTier.TRIAL,
          trialStartsAt: new Date(),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      const profile = await tx.profile.create({
        data: {
          tenantId: tenant.id,
          name: 'Administrador',
          description: 'Perfil administrativo padrão do workspace',
          permissions: {
            canManageAll: true,
            canManageUsers: true,
            canManageFinance: true,
            canViewReports: true,
          } satisfies Prisma.JsonObject,
        },
      });

      const trialLimits = this.tenantLimitsService.getTrialTierDefaults();

      await tx.tenantLimits.create({
        data: {
          tenantId: tenant.id,
          ...trialLimits,
          currentUsers: 0,
          currentStorageMB: 0,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          profileId: profile.id,
          name: params.displayName,
          email: params.email,
          password: randomPassword,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
        include: {
          tenant: {
            select: {
              name: true,
              legalName: true,
              cnpj: true,
            },
          },
          profile: true,
        },
      });

      await tx.tenantLimits.update({
        where: { tenantId: tenant.id },
        data: {
          currentUsers: { increment: 1 },
        },
      });

      await tx.externalIdentity.create({
        data: {
          provider: ExternalIdentityProvider.GOOGLE,
          providerUserId: params.providerUserId,
          email: params.email,
          lastLoginAt: new Date(),
          userId: user.id,
        },
      });

      return user;
    });

    return {
      user: this.mapUserForAuth(createdUser),
      isNewUser: true,
    };
  }

  private mapUserForAuth(user: {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
    profileId: number;
    tenantId: number;
    profile: unknown;
    tenant?: {
      name?: string | null;
      legalName?: string | null;
      cnpj?: string | null;
    } | null;
  }): ResponseUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileId: user.profileId,
      profile: user.profile as ResponseUserDto['profile'],
      tenantId: user.tenantId,
      tenantName: user.tenant?.legalName || user.tenant?.name || '',
      tenantCnpj: user.tenant?.cnpj || '',
    };
  }

  private async getGoogleOidc(): Promise<{
    client: OidcClientModule;
    config: unknown;
  }> {
    if (!this.oidcCache) {
      this.oidcCache = (async () => {
        const client =
          (await import('openid-client')) as unknown as OidcClientModule;
        const issuer =
          process.env.GOOGLE_OIDC_ISSUER || 'https://accounts.google.com';
        const clientId = process.env.GOOGLE_OIDC_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OIDC_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new InternalServerErrorException(
            'GOOGLE_OIDC_CLIENT_ID e GOOGLE_OIDC_CLIENT_SECRET precisam estar configurados.',
          );
        }

        const config = await client.discovery(
          new URL(issuer),
          clientId,
          clientSecret,
        );
        return { client, config };
      })();
    }

    return this.oidcCache;
  }

  private getGoogleRedirectUri(request: Request): string {
    return (
      process.env.GOOGLE_OIDC_REDIRECT_URI ||
      `${this.getBaseUrl(request)}/auth/sso/google/callback`
    );
  }

  private getBaseUrl(request: Request): string {
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol =
      typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0]
        : request.protocol;
    const host = request.get('host');

    if (!host) {
      throw new InternalServerErrorException(
        'Host da requisição não disponível para montar callback SSO.',
      );
    }

    return `${protocol}://${host}`;
  }

  private buildSsoSuccessRedirectUrl(
    accessToken: string,
    tenantId: number,
  ): string | undefined {
    const base =
      process.env.SSO_SUCCESS_REDIRECT_URL || process.env.FRONTEND_URL;
    if (!base) {
      return undefined;
    }

    const url = new URL(base);
    url.hash = new URLSearchParams({
      access_token: accessToken,
      tenantId: String(tenantId),
    }).toString();
    return url.toString();
  }
}
