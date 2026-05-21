import { ApiProperty } from '@nestjs/swagger';

class MonthlyDataDto {
  @ApiProperty({ example: 'Jan' })
  month: string;

  @ApiProperty({ example: 12 })
  count: number;
}

class ProcessStatusCountDto {
  @ApiProperty({ example: 18 })
  count: number;

  @ApiProperty({ example: '45.0' })
  percentage: string;
}

class ProcessStatusDistributionDto {
  @ApiProperty({ example: 40 })
  total: number;

  @ApiProperty({ type: ProcessStatusCountDto })
  emAndamento: ProcessStatusCountDto;

  @ApiProperty({ type: ProcessStatusCountDto })
  aguardando: ProcessStatusCountDto;

  @ApiProperty({ type: ProcessStatusCountDto })
  suspensos: ProcessStatusCountDto;

  @ApiProperty({ type: ProcessStatusCountDto })
  recursos: ProcessStatusCountDto;

  @ApiProperty({ type: ProcessStatusCountDto })
  finalizados: ProcessStatusCountDto;
}

class AgendaSummaryDto {
  @ApiProperty({ example: 3, description: 'Compromissos ativos do dia' })
  today: number;

  @ApiProperty({
    example: 9,
    description: 'Compromissos ativos dos próximos 7 dias',
  })
  upcoming: number;

  @ApiProperty({ example: 11, description: 'Compromissos ativos da semana' })
  week: number;

  @ApiProperty({ example: 28, description: 'Compromissos ativos do mês' })
  month: number;

  @ApiProperty({
    example: 52,
    description: 'Total de compromissos ativos',
  })
  total: number;
}

export class DashboardDto {
  @ApiProperty({ example: 125 })
  totalContacts: number;

  @ApiProperty({ example: 62 })
  totalProcesses: number;

  @ApiProperty({ example: 37 })
  activeProcesses: number;

  @ApiProperty({ type: [MonthlyDataDto] })
  newContactsByMonth: MonthlyDataDto[];

  @ApiProperty({ type: [MonthlyDataDto] })
  newProcessesByMonth: MonthlyDataDto[];

  @ApiProperty({ type: ProcessStatusDistributionDto })
  processStatusDistribution: ProcessStatusDistributionDto;

  @ApiProperty({ type: AgendaSummaryDto })
  agendaSummary: AgendaSummaryDto;
}
