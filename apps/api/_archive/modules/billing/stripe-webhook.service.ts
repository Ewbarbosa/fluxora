import { BadRequestException, Injectable } from '@nestjs/common';
const Stripe = require('stripe');

@Injectable()
export class StripeWebhookService {
  private stripeClient?: any;

  getStripeClient(): any {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException(
        'STRIPE_SECRET_KEY não configurada no ambiente.',
      );
    }

    this.stripeClient = new Stripe(secretKey);
    return this.stripeClient;
  }

  constructEvent(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string,
  ): any {
    const stripe = this.getStripeClient();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
