import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Stripe from 'stripe';
import { Request } from 'express';
import { Public } from '../auth/auth.guard';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { StripeWebhookService } from './stripe-webhook.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@ApiTags('Billing')
@Controller('billing/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('stripe')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Recebe eventos de webhook do Stripe' })
  async handleStripeWebhook(
    @Req() req: RequestWithRawBody,
    @Body() body: Record<string, unknown>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException(
        'STRIPE_WEBHOOK_SECRET não configurada no ambiente.',
      );
    }

    if (!signature) {
      throw new BadRequestException('Cabeçalho stripe-signature ausente.');
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'rawBody indisponível para validar webhook.',
      );
    }

    const event = this.stripeWebhookService.constructEvent(
      req.rawBody,
      signature,
      webhookSecret,
    );

    const eventResult = await this.subscriptionService.processStripeEvent(
      event.id,
      event.type,
      body,
    );

    if (!eventResult.processed) {
      return { received: true, duplicated: true };
    }

    await this.routeStripeEvent(event);

    return { received: true };
  }

  private async routeStripeEvent(event: any) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.subscriptionService.handleCheckoutSessionCompleted(
          event.data.object,
        );
        break;

      case 'invoice.payment_succeeded':
        await this.subscriptionService.handleInvoicePaymentSucceeded(
          event.data.object,
        );
        break;

      case 'invoice.payment_failed':
        await this.subscriptionService.handleInvoicePaymentFailed(
          event.data.object,
        );
        break;

      case 'customer.subscription.updated':
        await this.subscriptionService.handleSubscriptionUpdated(
          event.data.object,
        );
        break;

      case 'customer.subscription.deleted':
        await this.subscriptionService.handleSubscriptionDeleted(
          event.data.object,
        );
        break;

      default:
        this.logger.debug(`Evento Stripe ignorado: ${event.type}`);
    }
  }
}
