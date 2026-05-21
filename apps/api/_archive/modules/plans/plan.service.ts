import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todos os planos disponíveis
   */
  async findAll() {
    return this.prisma.plan.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: {
        price: 'asc',
      },
    });
  }

  /**
   * Busca um plano por ID
   */
  async findById(id: number) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  /**
   * Cria um novo plano
   */
  async create(planData: CreatePlanDto) {
    // Verificar se já existe plano com mesmo nome
    const existingPlan = await this.prisma.plan.findUnique({
      where: { name: planData.name },
    });

    if (existingPlan) {
      throw new BadRequestException('Já existe um plano com este nome');
    }

    return this.prisma.plan.create({
      data: {
        name: planData.name,
        description: planData.description,
        price: planData.price,
        billingCycle: planData.billingCycle || 'monthly',
        stripePriceIdMonthly: planData.stripePriceIdMonthly,
        limits: planData.limits,
        features: planData.features || {},
        isActive: planData.isActive !== undefined ? planData.isActive : true,
        isVisible: planData.isVisible !== undefined ? planData.isVisible : true,
      },
    });
  }

  /**
   * Atualiza um plano
   */
  async update(id: number, planData: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    // Verificar se mudou o nome e se já existe outro com esse nome
    if (planData.name && planData.name !== plan.name) {
      const existingPlan = await this.prisma.plan.findUnique({
        where: { name: planData.name },
      });

      if (existingPlan) {
        throw new BadRequestException('Já existe um plano com este nome');
      }
    }

    // Preparar dados para atualização, tratando campos JSON opcionais
    const updateData: any = { ...planData };
    if (updateData.features === undefined) {
      delete updateData.features;
    }
    if (updateData.limits === undefined) {
      delete updateData.limits;
    }

    return this.prisma.plan.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Deleta um plano (soft delete - marca como inativo)
   */
  async delete(id: number) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: {
            status: {
              in: ['ACTIVE', 'TRIAL'],
            },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    // Verificar se há assinaturas ativas usando este plano
    if (plan.subscriptions.length > 0) {
      throw new BadRequestException(
        `Não é possível deletar o plano. Existem ${plan.subscriptions.length} assinatura(s) ativa(s) usando este plano.`,
      );
    }

    // Marcar como inativo ao invés de deletar
    return this.prisma.plan.update({
      where: { id },
      data: {
        isActive: false,
        isVisible: false,
      },
    });
  }
}
