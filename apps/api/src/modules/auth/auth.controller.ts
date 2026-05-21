import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Request, Response } from 'express';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GenericAuthMessageDto } from './dto/generic-auth-message.dto';
import { SignInResponseDto } from './dto/signin-response.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaSetupConfirmDto } from './dto/mfa-setup-confirm.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { MfaRegenerateRecoveryDto } from './dto/mfa-regenerate-recovery.dto';
import { MfaStatusDto } from './dto/mfa-status.dto';
import { MfaSetupInitResponseDto } from './dto/mfa-setup-init-response.dto';
import { MfaRecoveryCodesResponseDto } from './dto/mfa-recovery-codes-response.dto';
import { AuthGuard } from './auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';
import { MfaService } from './mfa.service';
import { SsoService } from './sso.service';

@Controller('auth')
@ApiTags('Autenticação')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly ssoService: SsoService,
  ) {}

  @Post('signin')
  @ApiOperation({ summary: 'Realiza o login do usuário' })
  @ApiBody({ type: AuthDto })
  @ApiResponse({
    type: SignInResponseDto,
    status: 200,
    description:
      'Retorna access_token ou, com 2FA ativo, mfaRequired e mfaToken para POST /auth/mfa/verify.',
  })
  async validateUser(@Body() authDto: AuthDto, @Req() request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    const ip = forwardedFor?.split(',')[0]?.trim() || request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    return this.authService.validate(authDto, ip, userAgent);
  }

  @Post('mfa/verify')
  @ApiOperation({
    summary: 'Conclui o login com código TOTP ou de recuperação',
  })
  @ApiBody({ type: MfaVerifyDto })
  @ApiResponse({ type: AuthResponseDto, status: 200 })
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'] as string;
    const ip = forwardedFor?.split(',')[0]?.trim() || request.ip;
    const userAgent = request.headers['user-agent'] || 'unknown';

    return this.authService.verifyMfa(dto.mfaToken, dto.code, ip, userAgent);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('mfa/status')
  @ApiOperation({ summary: 'Status da autenticação em duas etapas' })
  @ApiResponse({ type: MfaStatusDto, status: 200 })
  async mfaStatus(@Req() req: CustomRequest) {
    return this.mfaService.getStatus(req.userId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('mfa/setup/init')
  @ApiOperation({ summary: 'Inicia configuração do 2FA (URI para QR code)' })
  @ApiResponse({ type: MfaSetupInitResponseDto, status: 200 })
  async mfaSetupInit(@Req() req: CustomRequest) {
    const user = await this.authService.getUserEmailForMfa(req.userId);
    return this.mfaService.initSetup(req.userId, user.email);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('mfa/setup/confirm')
  @ApiOperation({ summary: 'Confirma o 2FA com um código TOTP válido' })
  @ApiBody({ type: MfaSetupConfirmDto })
  @ApiResponse({ type: MfaRecoveryCodesResponseDto, status: 200 })
  async mfaSetupConfirm(
    @Body() dto: MfaSetupConfirmDto,
    @Req() req: CustomRequest,
  ) {
    return this.mfaService.confirmSetup(req.userId, dto.code);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('mfa/disable')
  @ApiOperation({
    summary: 'Desativa o 2FA (senha + código TOTP ou recuperação)',
  })
  @ApiBody({ type: MfaDisableDto })
  @ApiResponse({ type: GenericAuthMessageDto, status: 200 })
  async mfaDisable(@Body() dto: MfaDisableDto, @Req() req: CustomRequest) {
    return this.mfaService.disable(req.userId, dto.password, dto.code);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('mfa/recovery/regenerate')
  @ApiOperation({ summary: 'Gera novos códigos de recuperação (exige TOTP)' })
  @ApiBody({ type: MfaRegenerateRecoveryDto })
  @ApiResponse({ type: MfaRecoveryCodesResponseDto, status: 200 })
  async mfaRegenerateRecovery(
    @Body() dto: MfaRegenerateRecoveryDto,
    @Req() req: CustomRequest,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.mfaService.regenerateRecoveryCodes(req.userId, dto.code);
  }

  @Get('sso/google')
  @ApiOperation({
    summary:
      'Inicia login com Google via OpenID Connect (Authorization Code + PKCE)',
  })
  async googleSsoStart(@Req() request: Request, @Res() response: Response) {
    const authorizationUrl =
      await this.ssoService.buildGoogleAuthorizationUrl(request);
    return response.redirect(authorizationUrl);
  }

  @Get('sso/google/callback')
  @ApiOperation({ summary: 'Callback do Google OpenID Connect' })
  async googleSsoCallback(@Req() request: Request, @Res() response: Response) {
    const result = await this.ssoService.handleGoogleCallback(request);

    if (result.redirectUrl) {
      return response.redirect(result.redirectUrl);
    }

    return response.json(result);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicita a redefinição de senha' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    type: GenericAuthMessageDto,
    status: 200,
    description: 'Solicitação de redefinição processada.',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Redefine a senha do usuário' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    type: GenericAuthMessageDto,
    status: 200,
    description: 'Senha redefinida com sucesso.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
