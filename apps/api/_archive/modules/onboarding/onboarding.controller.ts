import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('register')
  @ApiOperation({ summary: 'Criar conta e iniciar onboarding com verificação de e-mail' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.onboardingService.register(registerDto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Confirmar e-mail da conta criada no onboarding' })
  @ApiQuery({ name: 'token', required: true, type: String })
  async verifyEmail(@Query('token') token: string) {
    const dto: VerifyEmailDto = { token };
    return this.onboardingService.verifyEmail(dto);
  }
}
