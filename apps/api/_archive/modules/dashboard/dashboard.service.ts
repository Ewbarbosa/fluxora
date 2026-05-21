import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/database.service';
import { CustomRequest } from 'src/common/types/request.interface';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(req: CustomRequest) {
    const tenantId = req.tenantId;

    // Total de contatos
    const totalContacts = await this.prisma.contact.count({
      where: {
        deletedAt: null,
        tenantId,
      },
    });

    // Total de processos
    const totalProcesses = await this.prisma.process.count({
      where: {
        deletedAt: null,
        tenantId,
      },
    });

    // Processos ativos (em andamento + aguardando + suspensos + recursos)
    const activeProcesses = await this.prisma.process.count({
      where: {
        deletedAt: null,
        tenantId,
        status: {
          in: ['Em andamento', 'Aguardando julgamento', 'Suspenso', 'Recurso'],
        },
      },
    });

    // Novos contatos por mês (últimos 6 meses)
    const newContactsByMonth = await this.getNewContactsByMonth(tenantId);

    // Novos processos por mês (últimos 6 meses)
    const newProcessesByMonth = await this.getNewProcessesByMonth(tenantId);

    // Status dos processos
    const processStatusDistribution =
      await this.getProcessStatusDistribution(tenantId);

    // Resumo da agenda (dia, próximos, semana, mês e total)
    const agendaSummary = await this.getAgendaSummary(tenantId);

    return {
      totalContacts,
      totalProcesses,
      activeProcesses,
      newContactsByMonth,
      newProcessesByMonth,
      processStatusDistribution,
      agendaSummary,
    };
  }

  private async getAgendaSummary(tenantId: number) {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const baseWhere = {
      tenantId,
      deletedAt: null,
    };

    const activeScheduleStatuses = {
      in: [ScheduleStatus.PENDING, ScheduleStatus.CONFIRMED],
    };

    const [today, upcoming, week, month, total] = await Promise.all([
      this.prisma.schedule.count({
        where: {
          ...baseWhere,
          startDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          status: activeScheduleStatuses,
        },
      }),
      this.prisma.schedule.count({
        where: {
          ...baseWhere,
        },
      }),
      this.prisma.schedule.count({
        where: {
          ...baseWhere,
          startDate: {
            gte: startOfWeek,
            lte: endOfWeek,
          },
          status: activeScheduleStatuses,
        },
      }),
      this.prisma.schedule.count({
        where: {
          ...baseWhere,
          startDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: activeScheduleStatuses,
        },
      }),
      this.prisma.schedule.count({
        where: {
          ...baseWhere,
          status: activeScheduleStatuses,
        },
      }),
    ]);

    return {
      today,
      upcoming,
      week,
      month,
      total,
    };
  }

  private async getNewContactsByMonth(tenantId: number) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1); // Primeiro dia do mês

    const contacts = await this.prisma.contact.findMany({
      where: {
        deletedAt: null,
        tenantId,
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Agrupar por mês
    const monthlyData = {};
    contacts.forEach((contact) => {
      const monthKey = contact.createdAt.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    // Gerar array com os últimos 6 meses
    const months: { month: string; count: number }[] = [];
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7);
      const monthName = monthNames[date.getMonth()];

      months.push({
        month: monthName,
        count: monthlyData[monthKey] || 0,
      });
    }

    return months;
  }

  private async getNewProcessesByMonth(tenantId: number) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1); // Primeiro dia do mês

    const processes = await this.prisma.process.findMany({
      where: {
        deletedAt: null,
        tenantId,
        createdAt: {
          gte: sixMonthsAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Agrupar por mês
    const monthlyData = {};
    processes.forEach((process) => {
      const monthKey = process.createdAt.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    // Gerar array com os últimos 6 meses
    const months: { month: string; count: number }[] = [];
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7);
      const monthName = monthNames[date.getMonth()];

      months.push({
        month: monthName,
        count: monthlyData[monthKey] || 0,
      });
    }

    return months;
  }

  private async getProcessStatusDistribution(tenantId: number) {
    const processes = await this.prisma.process.findMany({
      where: {
        deletedAt: null,
        tenantId,
      },
      select: {
        status: true,
      },
    });

    const total = processes.length;
    const distribution = {
      emAndamento: 0,
      aguardando: 0,
      suspensos: 0,
      recursos: 0,
      finalizados: 0,
    };

    processes.forEach((process) => {
      const status = process.status;

      // Status finalizados
      if (status === 'Finalizado' || status === 'Arquivado') {
        distribution.finalizados++;
      }
      // Status em andamento
      else if (status === 'Em andamento') {
        distribution.emAndamento++;
      }
      // Status aguardando julgamento
      else if (status === 'Aguardando julgamento') {
        distribution.aguardando++;
      }
      // Status suspensos
      else if (status === 'Suspenso') {
        distribution.suspensos++;
      }
      // Status recursos
      else if (status === 'Recurso') {
        distribution.recursos++;
      }
    });

    return {
      total,
      emAndamento: {
        count: distribution.emAndamento,
        percentage:
          total > 0
            ? ((distribution.emAndamento / total) * 100).toFixed(1)
            : '0.0',
      },
      aguardando: {
        count: distribution.aguardando,
        percentage:
          total > 0
            ? ((distribution.aguardando / total) * 100).toFixed(1)
            : '0.0',
      },
      suspensos: {
        count: distribution.suspensos,
        percentage:
          total > 0
            ? ((distribution.suspensos / total) * 100).toFixed(1)
            : '0.0',
      },
      recursos: {
        count: distribution.recursos,
        percentage:
          total > 0
            ? ((distribution.recursos / total) * 100).toFixed(1)
            : '0.0',
      },
      finalizados: {
        count: distribution.finalizados,
        percentage:
          total > 0
            ? ((distribution.finalizados / total) * 100).toFixed(1)
            : '0.0',
      },
    };
  }
}
