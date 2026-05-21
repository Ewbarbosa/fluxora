import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CustomRequest } from 'src/common/types/request.interface';

@Controller('subscriptions')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@ApiTags('Subscriptions')
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 500, description: 'Internal server error' })
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtém a assinatura do tenant autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Assinatura encontrada com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Tenant não possui assinatura' })
  async getTenantSubscription(@Req() req: CustomRequest) {
    return this.subscriptionService.getTenantSubscription(req.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova assinatura para o tenant' })
  @ApiResponse({ status: 201, description: 'Assinatura criada com sucesso' })
  @ApiResponse({
    status: 400,
    description: 'Tenant já possui uma assinatura ativa',
  })
  async createSubscription(
    @Body() subscriptionData: CreateSubscriptionDto,
    @Req() req: CustomRequest,
  ) {
    return this.subscriptionService.createSubscription(
      req.tenantId,
      subscriptionData.planId,
      subscriptionData.isTrial || false,
      subscriptionData.paymentMethod,
      subscriptionData.externalId,
    );
  }

  @Post('checkout-session')
  @ApiOperation({
    summary: 'Cria sessão de checkout Stripe para assinatura do tenant',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session criada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Plano inválido ou configuração Stripe ausente',
  })
  async createCheckoutSession(
    @Body() data: CreateCheckoutSessionDto,
    @Req() req: CustomRequest,
  ) {
    return this.subscriptionService.createCheckoutSession(
      req.tenantId,
      data.planId,
    );
  }

  @Patch('change-plan')
  @ApiOperation({ summary: 'Muda o plano da assinatura (upgrade/downgrade)' })
  @ApiResponse({ status: 200, description: 'Plano alterado com sucesso' })
  @ApiResponse({
    status: 404,
    description: 'Assinatura ou plano não encontrado',
  })
  async changePlan(
    @Body() changePlanData: ChangePlanDto,
    @Req() req: CustomRequest,
  ) {
    const effectiveDate = changePlanData.effectiveDate
      ? new Date(changePlanData.effectiveDate)
      : undefined;
    return this.subscriptionService.changePlan(
      req.tenantId,
      changePlanData.newPlanId,
      effectiveDate,
    );
  }

  @Patch('cancel')
  @ApiOperation({ summary: 'Cancela a assinatura do tenant' })
  @ApiResponse({ status: 200, description: 'Assinatura cancelada com sucesso' })
  @ApiResponse({ status: 404, description: 'Assinatura não encontrada' })
  async cancelSubscription(
    @Body() cancelData: CancelSubscriptionDto,
    @Req() req: CustomRequest,
  ) {
    return this.subscriptionService.cancelSubscription(
      req.tenantId,
      cancelData.reason,
    );
  }

  @Patch('renew')
  @ApiOperation({ summary: 'Renova uma assinatura (após pagamento)' })
  @ApiResponse({ status: 200, description: 'Assinatura renovada com sucesso' })
  @ApiResponse({ status: 404, description: 'Assinatura não encontrada' })
  async renewSubscription(@Req() req: CustomRequest) {
    return this.subscriptionService.renewSubscription(req.tenantId);
  }

  @Patch('suspend')
  @ApiOperation({ summary: 'Suspende uma assinatura (falha no pagamento)' })
  @ApiResponse({ status: 200, description: 'Assinatura suspensa com sucesso' })
  @ApiResponse({ status: 404, description: 'Assinatura não encontrada' })
  async suspendSubscription(@Req() req: CustomRequest) {
    return this.subscriptionService.suspendSubscription(req.tenantId);
  }
}
