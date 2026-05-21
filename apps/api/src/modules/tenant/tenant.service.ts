import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { CustomRequest } from 'src/common/types/request.interface';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(req?: CustomRequest) {
    // Se receber request, retorna apenas o tenant do usuário autenticado
    if (req?.tenantId) {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          id: req.tenantId,
          deletedAt: null,
        },
      });

      if (!tenant) {
        throw new NotFoundException('Tenant não encontrado');
      }

      return [tenant];
    }

    // Se não receber request (endpoint administrativo), retorna todos
    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
      },
    });
  }

  async findById(id: number, req: CustomRequest) {
    // Garantir que o usuário só pode ver seu próprio tenant
    if (id !== req.tenantId) {
      throw new NotFoundException('Tenant não encontrado');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant;
  }
}
