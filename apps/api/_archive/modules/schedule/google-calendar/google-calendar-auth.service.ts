import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from 'src/database/database.service';
import { GoogleCalendarEncryptionService } from './google-calendar-encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class GoogleCalendarAuthService {
  private readonly logger = new Logger(GoogleCalendarAuthService.name);
  private oauth2Client: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: GoogleCalendarEncryptionService,
  ) {
    this.initializeOAuth2Client();
  }

  /**
   * Inicializa o cliente OAuth2 do Google
   */
  private initializeOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn('Credenciais do Google OAuth não configuradas');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  /**
   * Gera URL de autorização OAuth
   */
  getAuthUrl(
    userId: number,
    tenantId: number,
  ): { authUrl: string; state: string } {
    if (!this.oauth2Client) {
      throw new BadRequestException('Google OAuth não configurado');
    }

    // Gerar state para validação de segurança
    const state = crypto.randomBytes(32).toString('hex');

    // Armazenar state temporariamente (em produção, usar Redis ou similar)
    // Por enquanto, vamos incluir userId e tenantId no state de forma segura
    const stateData = JSON.stringify({ userId, tenantId, nonce: state });
    const encodedState = Buffer.from(stateData).toString('base64');

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: encodedState,
      prompt: 'consent', // Força mostrar tela de consentimento para obter refresh token
    });

    return { authUrl, state: encodedState };
  }

  /**
   * Processa callback do Google OAuth
   */
  async handleCallback(code: string, state: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new BadRequestException('Google OAuth não configurado');
    }

    try {
      // Decodificar state
      const stateData = JSON.parse(
        Buffer.from(state, 'base64').toString('utf8'),
      );
      const { userId, tenantId } = stateData;

      if (!userId || !tenantId) {
        throw new BadRequestException('Estado inválido');
      }

      // Trocar código por tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new BadRequestException('Tokens não recebidos do Google');
      }

      // Criptografar tokens antes de salvar
      const encryptedAccessToken = this.encryptionService.encrypt(
        tokens.access_token,
      );
      const encryptedRefreshToken = this.encryptionService.encrypt(
        tokens.refresh_token,
      );

      // Calcular expiração do token (padrão: 1 hora)
      const tokenExpiry = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      // Salvar ou atualizar conexão
      await this.prisma.googleCalendarConnection.upsert({
        where: { userId },
        create: {
          userId,
          tenantId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry,
          syncEnabled: true,
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry,
          syncEnabled: true,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Conexão Google Calendar criada/atualizada para usuário ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Erro ao processar callback OAuth: ${error.message}`);
      throw new BadRequestException('Falha ao processar autorização do Google');
    }
  }

  /**
   * Renova access token usando refresh token
   */
  async refreshToken(connectionId: number): Promise<string> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada');
    }

    try {
      // Descriptografar refresh token
      const refreshToken = this.encryptionService.decrypt(
        connection.refreshToken,
      );

      // Configurar cliente OAuth com refresh token
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Obter novo access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Novo access token não recebido');
      }

      // Criptografar novo token
      const encryptedAccessToken = this.encryptionService.encrypt(
        credentials.access_token,
      );
      const tokenExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      // Atualizar conexão
      await this.prisma.googleCalendarConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: encryptedAccessToken,
          tokenExpiry,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Token renovado para conexão ${connectionId}`);
      return credentials.access_token;
    } catch (error) {
      this.logger.error(`Erro ao renovar token: ${error.message}`);
      throw new BadRequestException('Falha ao renovar token');
    }
  }

  /**
   * Obtém access token válido (renova se necessário)
   */
  async getValidAccessToken(userId: number): Promise<string> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new NotFoundException('Conexão Google Calendar não encontrada');
    }

    // Verificar se o token está expirado ou próximo de expirar (5 minutos de margem)
    const now = new Date();
    const expiryTime = connection.tokenExpiry
      ? new Date(connection.tokenExpiry)
      : new Date(0);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (!connection.tokenExpiry || expiryTime < fiveMinutesFromNow) {
      // Token expirado ou próximo de expirar, renovar
      return await this.refreshToken(connection.id);
    }

    // Token ainda válido, descriptografar e retornar
    return this.encryptionService.decrypt(connection.accessToken);
  }

  /**
   * Revoga conexão e remove tokens
   */
  async revokeConnection(userId: number, tenantId: number): Promise<void> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada');
    }

    if (connection.tenantId !== tenantId) {
      throw new BadRequestException('Conexão não pertence ao tenant');
    }

    try {
      // Tentar revogar token no Google
      try {
        const accessToken = this.encryptionService.decrypt(
          connection.accessToken,
        );
        this.oauth2Client.setCredentials({ access_token: accessToken });
        await this.oauth2Client.revokeCredentials();
      } catch (error) {
        this.logger.warn(`Erro ao revogar token no Google: ${error.message}`);
        // Continuar mesmo se falhar a revogação no Google
      }

      // Remover conexão do banco
      await this.prisma.googleCalendarConnection.delete({
        where: { id: connection.id },
      });

      this.logger.log(
        `Conexão Google Calendar revogada para usuário ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Erro ao revogar conexão: ${error.message}`);
      throw new BadRequestException('Falha ao revogar conexão');
    }
  }

  /**
   * Verifica se usuário tem conexão ativa
   */
  async hasActiveConnection(userId: number): Promise<boolean> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });

    return !!connection && connection.syncEnabled;
  }

  /**
   * Conexão Google de fallback do tenant: prioriza perfil **Administrador** (onboarding),
   * depois o usuário mais antigo do tenant com Google ativo (quem costuma ter criado a conta).
   */
  async findTenantFallbackGoogleUserId(
    tenantId: number,
  ): Promise<number | null> {
    const adminConnection = await this.prisma.googleCalendarConnection.findFirst(
      {
        where: {
          tenantId,
          syncEnabled: true,
          user: {
            deletedAt: null,
            profile: {
              name: 'Administrador',
              deletedAt: null,
              tenantId,
            },
          },
        },
        orderBy: { userId: 'asc' },
        select: { userId: true },
      },
    );
    if (adminConnection) {
      return adminConnection.userId;
    }

    const oldestConnection =
      await this.prisma.googleCalendarConnection.findFirst({
        where: {
          tenantId,
          syncEnabled: true,
          user: { deletedAt: null },
        },
        orderBy: { user: { createdAt: 'asc' } },
        select: { userId: true },
      });
    return oldestConnection?.userId ?? null;
  }

  /**
   * Preferência: conexão ativa do dono do compromisso; senão, fallback do tenant
   * (administrador / usuário mais antigo com Google).
   */
  async resolveGoogleCalendarUserId(
    scheduleOwnerUserId: number,
    tenantId: number,
  ): Promise<number | null> {
    if (await this.hasActiveConnection(scheduleOwnerUserId)) {
      return scheduleOwnerUserId;
    }
    return await this.findTenantFallbackGoogleUserId(tenantId);
  }

  /**
   * Obtém informações da conexão
   */
  async getConnection(userId: number) {
    return await this.prisma.googleCalendarConnection.findUnique({
      where: { userId },
    });
  }
}
