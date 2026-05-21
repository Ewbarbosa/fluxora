import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { TenantLimitsService } from '../limits/tenant-limits.service';
const Stripe = require('stripe');

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripeClient?: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  private getStripeClient(): any {
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

  /**
   * Obtém a assinatura de um tenant
   */
  async getTenantSubscription(tenantId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Tenant não possui assinatura');
    }

    return subscription;
  }

  /**
   * Cria uma nova assinatura para um tenant
   */
  async createSubscription(
    tenantId: number,
    planId: number,
    isTrial: boolean = false,
    paymentMethod?: string,
    externalId?: string,
  ) {
    // Verificar se já existe assinatura
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (existingSubscription) {
      throw new BadRequestException('Tenant já possui uma assinatura ativa');
    }

    // Verificar se o plano existe e está ativo
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plano não encontrado ou não está ativo');
    }

    const trialEndDate = isTrial
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias
      : null;

    // Criar assinatura
    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        planId,
        status: isTrial ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        trialEndDate,
        paymentMethod,
        externalId,
      },
      include: {
        plan: true,
      },
    });

    // Criar limites baseados no plano
    const limits = plan.limits as {
      maxUsers?: number;
      maxContacts?: number;
      maxProcesses?: number;
      maxStorageMB?: number;
    };

    await this.tenantLimitsService.createLimits(tenantId, {
      maxUsers: limits.maxUsers ?? 10,
      maxContacts: limits.maxContacts ?? 100,
      maxProcesses: limits.maxProcesses ?? 50,
      maxStorageMB: limits.maxStorageMB ?? 1024,
    });

    // Sincronizar contadores com dados reais
    await this.tenantLimitsService.syncCounters(tenantId);

    this.logger.log(
      `Created subscription for tenant ${tenantId} with plan ${plan.name}`,
    );

    return subscription;
  }

  async createCheckoutSession(tenantId: number, planId: number) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plano não encontrado ou não está ativo');
    }

    if (!plan.stripePriceIdMonthly) {
      throw new BadRequestException(
        'Plano não possui stripePriceIdMonthly configurado.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      select: {
        stripeCustomerId: true,
      },
    });

    const stripe = this.getStripeClient();
    const successUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;

    if (!successUrl || !cancelUrl) {
      throw new BadRequestException(
        'STRIPE_CHECKOUT_SUCCESS_URL e STRIPE_CHECKOUT_CANCEL_URL são obrigatórias.',
      );
    }

    let stripeCustomerId = existingSubscription?.stripeCustomerId ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: tenant.email ?? undefined,
        name: tenant.name,
        metadata: {
          tenantId: String(tenant.id),
        },
      });

      stripeCustomerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: stripeCustomerId,
      line_items: [
        {
          price: plan.stripePriceIdMonthly,
          quantity: 1,
        },
      ],
      metadata: {
        tenantId: String(tenant.id),
        planId: String(plan.id),
      },
      subscription_data: {
        metadata: {
          tenantId: String(tenant.id),
          planId: String(plan.id),
        },
      },
    });

    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        status: SubscriptionStatus.PENDING,
        paymentMethod: 'stripe',
        stripeCustomerId,
        stripeCheckoutSessionId: session.id,
      },
      update: {
        planId: plan.id,
        paymentMethod: 'stripe',
        stripeCustomerId,
        stripeCheckoutSessionId: session.id,
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe checkout URL não retornada.');
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  async processStripeEvent(
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const existingEvent = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.warn(`Stripe event ${eventId} já processado. Ignorando.`);
      return { processed: false, reason: 'already_processed' };
    }

    await this.prisma.stripeWebhookEvent.create({
      data: {
        eventId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    return { processed: true };
  }

  async handleCheckoutSessionCompleted(session: any) {
    const tenantId = Number(session.metadata?.tenantId);
    const planId = Number(session.metadata?.planId);
    const stripeCustomerId = session.customer as string | null;
    const stripeSubscriptionId = session.subscription as string | null;

    if (isNaN(tenantId) || isNaN(planId)) {
      this.logger.error(
        `checkout.session.completed sem metadata válida: ${session.id}`,
      );
      return;
    }

    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: 'stripe',
        externalId: stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        stripeCheckoutSessionId: session.id,
        trialEndDate: null,
      },
      update: {
        planId,
        status: SubscriptionStatus.ACTIVE,
        paymentMethod: 'stripe',
        externalId: stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        stripeCheckoutSessionId: session.id,
        trialEndDate: null,
      },
    });
  }

  async handleInvoicePaymentSucceeded(invoice: any) {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }

  async handleInvoicePaymentFailed(invoice: any) {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: {
        status: SubscriptionStatus.SUSPENDED,
      },
    });
  }

  async handleSubscriptionUpdated(stripeSubscription: any) {
    const tenantId = Number(stripeSubscription.metadata?.tenantId);
    const planId = Number(stripeSubscription.metadata?.planId);
    const stripeCustomerId =
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : null;

    if (isNaN(tenantId) || isNaN(planId)) {
      return;
    }

    const mappedStatus =
      stripeSubscription.status === 'active'
        ? SubscriptionStatus.ACTIVE
        : stripeSubscription.status === 'past_due' ||
            stripeSubscription.status === 'unpaid'
          ? SubscriptionStatus.SUSPENDED
          : stripeSubscription.status === 'canceled'
            ? SubscriptionStatus.CANCELLED
            : stripeSubscription.status === 'trialing'
              ? SubscriptionStatus.TRIAL
              : SubscriptionStatus.PENDING;

    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        status: mappedStatus,
        paymentMethod: 'stripe',
        externalId: stripeSubscription.id,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscription.id,
      },
      update: {
        planId,
        status: mappedStatus,
        paymentMethod: 'stripe',
        externalId: stripeSubscription.id,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscription.id,
      },
    });
  }

  async handleSubscriptionDeleted(stripeSubscription: any) {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Muda o plano de um tenant (upgrade/downgrade)
   */
  async changePlan(tenantId: number, newPlanId: number, effectiveDate?: Date) {
    const currentSubscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!currentSubscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    const newPlan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan || !newPlan.isActive) {
      throw new NotFoundException('Plano não encontrado ou não está ativo');
    }

    // Verificar se é upgrade ou downgrade
    const isUpgrade = newPlan.price > currentSubscription.plan.price;
    const changeType = isUpgrade ? 'upgrade' : 'downgrade';

    // Registrar histórico
    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: currentSubscription.id,
        oldPlanId: currentSubscription.planId,
        newPlanId: newPlanId,
        changeType,
      },
    });

    // Atualizar assinatura
    const updatedSubscription = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        planId: newPlanId,
        updatedAt: effectiveDate || new Date(),
      },
      include: { plan: true },
    });

    // Atualizar limites (mas não reduzir se já estiver acima)
    const newLimits = newPlan.limits as {
      maxUsers?: number;
      maxContacts?: number;
      maxProcesses?: number;
      maxStorageMB?: number;
    };

    await this.tenantLimitsService.updateLimits(tenantId, {
      maxUsers: newLimits.maxUsers,
      maxContacts: newLimits.maxContacts,
      maxProcesses: newLimits.maxProcesses,
      maxStorageMB: newLimits.maxStorageMB,
    });

    this.logger.log(
      `Changed plan for tenant ${tenantId} from ${currentSubscription.plan.name} to ${newPlan.name}`,
    );

    return updatedSubscription;
  }

  /**
   * Cancela uma assinatura
   */
  async cancelSubscription(tenantId: number, reason?: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    // Registrar histórico
    await this.prisma.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        oldPlanId: subscription.planId,
        newPlanId: subscription.planId,
        changeType: 'cancellation',
        reason,
      },
    });

    // Atualizar status
    const updatedSubscription = await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });

    this.logger.log(`Cancelled subscription for tenant ${tenantId}`);

    return updatedSubscription;
  }

  /**
   * Renova uma assinatura (após pagamento)
   */
  async renewSubscription(tenantId: number, endDate?: Date) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    // Calcular nova data de término (1 mês ou 1 ano após startDate)
    const plan = await this.prisma.plan.findUnique({
      where: { id: subscription.planId },
    });

    const billingMonths = plan?.billingCycle === 'yearly' ? 12 : 1;
    const newEndDate = endDate || new Date();
    newEndDate.setMonth(newEndDate.getMonth() + billingMonths);

    return this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        endDate: newEndDate,
        trialEndDate: null, // Remove trial se ainda estiver ativo
      },
      include: { plan: true },
    });
  }

  /**
   * Suspende uma assinatura (falha no pagamento)
   */
  async suspendSubscription(tenantId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    return this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: SubscriptionStatus.SUSPENDED,
      },
      include: { plan: true },
    });
  }

  /**
   * Verifica se tenant pode usar uma feature
   */
  async canUseFeature(tenantId: number, feature: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    const features = subscription.plan.features as Record<string, boolean>;
    return features[feature] === true;
  }

  /**
   * Verifica se assinatura está ativa
   */
  async isSubscriptionActive(tenantId: number): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      return false;
    }

    return (
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.TRIAL
    );
  }
}
