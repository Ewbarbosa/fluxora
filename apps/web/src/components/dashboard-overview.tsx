"use client"

import type { CSSProperties, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  ListOrderedIcon,
  RefreshCcwIcon,
  SirenIcon,
  TrendingUpIcon,
  WalletCardsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getStoredToken } from "@/lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Change = {
  delta: number
  percent: number
}

type SummarySnapshot = {
  totalIncome: number
  totalExpense: number
  balance: number
  overdueCount: number
}

type MonthlyFlowItem = {
  label: string
  income: number
  expense: number
  balance: number
}

type CategoryItem = {
  name: string
  amount: number
  count: number
  percentage: number
}

type StatusItem = {
  status: "PAID" | "PENDING" | "OVERDUE"
  label: string
  count: number
}

type Alerts = {
  dueTodayCount: number
  overdueCounts: {
    oneDay: number
    threeDays: number
    sevenDays: number
  }
  items: Array<{
    id: number
    description: string
    amount: number
    dueDate: string | null
    daysOverdue: number
    installmentLabel: string | null
  }>
}

type DashboardOverviewResponse = {
  period: {
    currentMonth: string
    previousMonth: string
  }
  summary: {
    current: SummarySnapshot
    previous: SummarySnapshot
    changes: {
      income: Change
      expense: Change
      balance: Change
      overdueCount: Change
    }
  }
  charts: {
    monthlyFlow: MonthlyFlowItem[]
    expenseByCategory: CategoryItem[]
    statusBreakdown: StatusItem[]
  }
  alerts: Alerts
  upcoming: Array<{
    id: number
    description: string
    amount: number
    dueDate: string | null
    category: string
    status: string
  }>
  recentTransactions: Array<{
    id: number
    description: string
    amount: number
    type: "INCOME" | "EXPENSE"
    status: string
    dueDate: string | null
    category: string
  }>
}

type DashboardState = {
  overview: DashboardOverviewResponse | null
  loading: boolean
  error: string | null
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "" : ""}${value.toFixed(1)}%`
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

function normalizeMonthLabel(value: string) {
  if (!value) return "—"
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

function getChangeTone(delta: number, inverse = false) {
  if (delta === 0) return "text-muted-foreground"
  if (inverse) {
    return delta > 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"
  }
  return delta > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
}

function SummaryCard({
  title,
  value,
  change,
  inverse,
  icon,
}: {
  title: string
  value: string
  change: Change
  inverse?: boolean
  icon: ReactNode
}) {
  return (
    <div className="rounded-[1.1rem] border p-4 backdrop-blur [border-color:var(--app-hero-border)] [background-color:var(--app-hero-panel)]">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm [color:var(--app-hero-muted)]">{title}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="rounded-full p-2 [background-color:var(--app-hero-panel-strong)]">{icon}</div>
      </div>
      <p className={`mt-3 text-xs font-medium ${getChangeTone(change.delta, inverse)}`}>
        {formatPercent(change.percent)} vs mês anterior
      </p>
    </div>
  )
}

function BalanceSparkline({ data }: { data: MonthlyFlowItem[] }) {
  if (!data.length) {
    return (
      <div className="rounded-[1rem] border p-3 [border-color:var(--app-hero-border)] [background-color:var(--app-hero-panel-strong)]">
        <p className="text-sm [color:var(--app-hero-muted)]">Trajetória do saldo</p>
        <p className="mt-6 text-sm text-muted-foreground">Carregando série mensal...</p>
      </div>
    )
  }

  const balances = data.map((item) => item.balance)
  const max = Math.max(...balances, 0)
  const min = Math.min(...balances, 0)
  const range = max - min || 1

  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100
      const y = 100 - ((item.balance - min) / range) * 100
      return `${x},${y}`
    })
    .join(" ")

  const areaPoints = `0,100 ${points} 100,100`

  return (
    <div className="rounded-[1rem] border p-3 [border-color:var(--app-hero-border)] [background-color:var(--app-hero-panel-strong)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm [color:var(--app-hero-muted)]">Trajetória do saldo</p>
          <p className="text-xs [color:var(--app-hero-muted)]">Últimos 6 meses</p>
        </div>
        <TrendingUpIcon className="size-4 [color:var(--app-ink)]" />
      </div>
      <svg viewBox="0 0 100 100" className="h-24 w-full overflow-visible">
        <defs>
          <linearGradient id="balance-area" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polyline
          points="0,80 100,80"
          fill="none"
          stroke="var(--app-hero-border)"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
        <polygon points={areaPoints} fill="url(#balance-area)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[0.7rem] uppercase tracking-[0.18em] [color:var(--app-hero-muted)]">
        {data.map((item) => (
          <span key={item.label}>{normalizeMonthLabel(item.label)}</span>
        ))}
      </div>
    </div>
  )
}

function MonthlyFlowChart({ data }: { data: MonthlyFlowItem[] }) {
  const max = Math.max(...data.flatMap((item) => [item.income, item.expense]), 1)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 text-xs [color:var(--app-hero-muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[var(--chart-1)]" />
          Receitas
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[var(--chart-4)]" />
          Despesas
        </span>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {data.map((item) => {
          const incomeHeight = Math.max((item.income / max) * 100, item.income > 0 ? 10 : 0)
          const expenseHeight = Math.max((item.expense / max) * 100, item.expense > 0 ? 10 : 0)

          return (
            <div key={item.label} className="space-y-3">
              <div className="flex h-48 items-end justify-center gap-2 rounded-[1rem] border px-2 py-3 [border-color:var(--border)] [background-color:var(--app-surface-strong)]">
                <div className="flex h-full w-full items-end justify-center gap-1.5">
                  <div
                    className="w-1/2 rounded-full bg-[var(--chart-1)]"
                    style={{ height: `${incomeHeight}%` }}
                    title={`Receitas: ${formatMoney(item.income)}`}
                  />
                  <div
                    className="w-1/2 rounded-full bg-[var(--chart-4)]"
                    style={{ height: `${expenseHeight}%` }}
                    title={`Despesas: ${formatMoney(item.expense)}`}
                  />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {normalizeMonthLabel(item.label)}
                </p>
                <p className="text-sm font-semibold">{formatCompactMoney(item.balance)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CategoryBreakdownChart({ data }: { data: CategoryItem[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Sem despesas categorizadas neste período.</p>
  }

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const barStyle = {
          width: `${Math.max(item.percentage, 6)}%`,
          background:
            index % 2 === 0
              ? "linear-gradient(90deg, var(--chart-1), color-mix(in srgb, var(--chart-1) 72%, white))"
              : "linear-gradient(90deg, var(--chart-4), color-mix(in srgb, var(--chart-4) 72%, white))",
        } satisfies CSSProperties

        return (
          <div key={item.name} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.count} lançamento(s)</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMoney(item.amount)}</p>
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
              <div className="h-full rounded-full" style={barStyle} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusBreakdown({ data }: { data: StatusItem[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Carregando status dos lançamentos...</p>
  }

  const total = data.reduce((acc, item) => acc + item.count, 0)
  const palette: Record<StatusItem["status"], string> = {
    PAID: "var(--chart-1)",
    PENDING: "var(--chart-2)",
    OVERDUE: "var(--chart-4)",
  }

  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-black/6 dark:bg-white/8">
        {data.map((item) => (
          <div
            key={item.status}
            style={{
              width: `${total ? (item.count / total) * 100 : 0}%`,
              backgroundColor: palette[item.status],
            }}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {data.map((item) => (
          <div key={item.status} className="rounded-[1rem] border p-3 [border-color:var(--border)] [background-color:var(--app-surface-strong)]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: palette[item.status] }} />
              {item.label}
            </div>
            <p className="mt-2 text-2xl font-semibold">{item.count}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardOverview() {
  const [state, setState] = useState<DashboardState>({
    overview: null,
    loading: true,
    error: null,
  })

  const token = useMemo(() => getStoredToken(), [])

  const loadData = useCallback(async () => {
    if (!token) {
      setState({
        overview: null,
        loading: false,
        error: "Sessão não encontrada. Faça login novamente para carregar o dashboard.",
      })
      return
    }

    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const response = await fetch(`${apiBaseUrl}/finance/dashboard/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error =
          response.status === 403
            ? "O dashboard avançado ainda está bloqueado para este workspace/plano."
            : "Não foi possível carregar a visão consolidada do dashboard."

        setState({
          overview: null,
          loading: false,
          error,
        })
        return
      }

      setState({
        overview: (await response.json()) as DashboardOverviewResponse,
        loading: false,
        error: null,
      })
    } catch {
      setState({
        overview: null,
        loading: false,
        error: "Não foi possível conectar com a API para montar o dashboard.",
      })
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const monthlyFlow = state.overview?.charts.monthlyFlow ?? []
  const expenseByCategory = state.overview?.charts.expenseByCategory ?? []
  const statusBreakdown = state.overview?.charts.statusBreakdown ?? []
  const alerts = state.overview?.alerts
  const recentTransactions = state.overview?.recentTransactions ?? []
  const upcoming = state.overview?.upcoming ?? []
  const summary = state.overview?.summary.current
  const changes = state.overview?.summary.changes

  return (
    <div className="flex flex-1 flex-col gap-4 p-1 pt-0 md:p-4 md:pt-0">
      <section className="overflow-hidden rounded-[1.5rem] border shadow-[0_18px_40px_rgba(15,23,32,0.08)] [border-color:var(--app-hero-border)] [background-color:var(--app-hero-bg)] [color:var(--app-hero-foreground)]">
        <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.24em] [background-color:var(--app-hero-chip)] [color:var(--app-hero-muted)]">
                <BriefcaseBusinessIcon className="size-3.5" />
                Cockpit financeiro
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Visão financeira</h1>
                <p className="max-w-2xl text-sm [color:var(--app-hero-muted)]">
                  Dashboard consolidado com leitura mensal, alertas operacionais e gráficos leves para acompanhar caixa, categorias e status.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="rounded-2xl border-0 [background-color:var(--app-hero-button)] [color:var(--primary-foreground)] hover:opacity-90 dark:[color:var(--primary-foreground)]"
              onClick={() => void loadData()}
              disabled={state.loading}
            >
              <RefreshCcwIcon className={state.loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.95fr)]">
            <div className="grid gap-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="rounded-[1.2rem] border p-4 backdrop-blur [border-color:var(--app-hero-border)] [background-color:var(--app-hero-panel)]">
                  <p className="text-sm [color:var(--app-hero-muted)]">Saldo do mês</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {summary ? formatMoney(summary.balance) : "—"}
                  </p>
                  <p className={`mt-3 text-sm font-medium ${changes ? getChangeTone(changes.balance.delta) : "text-muted-foreground"}`}>
                    {changes ? `${formatPercent(changes.balance.percent)} vs mês anterior` : "Carregando variação"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1rem] p-3 [background-color:var(--app-hero-panel-strong)]">
                      <div className="flex items-center gap-2 [color:var(--app-hero-muted)]">
                        <ArrowUpRightIcon className="size-4" />
                        Receitas
                      </div>
                      <p className="mt-2 font-semibold text-emerald-600 dark:text-emerald-300">
                        {summary ? formatMoney(summary.totalIncome) : "—"}
                      </p>
                    </div>
                    <div className="rounded-[1rem] p-3 [background-color:var(--app-hero-panel-strong)]">
                      <div className="flex items-center gap-2 [color:var(--app-hero-muted)]">
                        <ArrowDownRightIcon className="size-4" />
                        Despesas
                      </div>
                      <p className="mt-2 font-semibold text-rose-600 dark:text-rose-300">
                        {summary ? formatMoney(summary.totalExpense) : "—"}
                      </p>
                    </div>
                    <div className="rounded-[1rem] p-3 [background-color:var(--app-hero-panel-strong)]">
                      <div className="flex items-center gap-2 [color:var(--app-hero-muted)]">
                        <SirenIcon className="size-4" />
                        Atrasos
                      </div>
                      <p className="mt-2 font-semibold">{summary?.overdueCount ?? "—"}</p>
                    </div>
                  </div>
                </div>

                <BalanceSparkline data={monthlyFlow} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Receitas"
                  value={summary ? formatMoney(summary.totalIncome) : "—"}
                  change={changes?.income ?? { delta: 0, percent: 0 }}
                  icon={<CircleDollarSignIcon className="size-4 [color:var(--app-ink)]" />}
                />
                <SummaryCard
                  title="Despesas"
                  value={summary ? formatMoney(summary.totalExpense) : "—"}
                  change={changes?.expense ?? { delta: 0, percent: 0 }}
                  inverse
                  icon={<WalletCardsIcon className="size-4 [color:var(--app-ink)]" />}
                />
                <SummaryCard
                  title="Vencem hoje"
                  value={String(alerts?.dueTodayCount ?? "—")}
                  change={{ delta: 0, percent: 0 }}
                  icon={<CalendarClockIcon className="size-4 [color:var(--app-ink)]" />}
                />
                <SummaryCard
                  title="Atrasos"
                  value={String(summary?.overdueCount ?? "—")}
                  change={changes?.overdueCount ?? { delta: 0, percent: 0 }}
                  inverse
                  icon={<AlertTriangleIcon className="size-4 [color:var(--app-ink)]" />}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {state.error ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangleIcon className="mt-0.5 size-4 text-amber-600" />
            <p className="text-sm text-muted-foreground">{state.error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.2rem] border-black/6 bg-[color:var(--app-surface)] shadow-[0_16px_34px_rgba(15,23,32,0.05)]">
          <CardHeader>
            <CardTitle>Fluxo mensal</CardTitle>
            <CardDescription>Receitas x despesas dos últimos seis meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyFlowChart data={monthlyFlow} />
          </CardContent>
        </Card>

        <Card className="rounded-[1.2rem] border-black/6 bg-[color:var(--app-surface)] shadow-[0_16px_34px_rgba(15,23,32,0.05)]">
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
            <CardDescription>Onde o caixa está sendo drenado neste mês.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[1.2rem] border-black/6 bg-[color:var(--app-surface)] shadow-[0_16px_34px_rgba(15,23,32,0.05)]">
          <CardHeader>
            <CardTitle>Radar rápido</CardTitle>
            <CardDescription>Status dos lançamentos e próximos vencimentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <StatusBreakdown data={statusBreakdown} />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ListOrderedIcon className="size-4 [color:var(--app-ink)]" />
                Próximos vencimentos
              </div>
              {upcoming.length ? (
                upcoming.map((item) => (
                  <div key={item.id} className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.category} • {formatDate(item.dueDate)}
                        </p>
                      </div>
                      <p className="font-medium">{formatMoney(item.amount)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {state.loading ? "Carregando..." : "Nenhum vencimento futuro encontrado."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.2rem] border-black/6 bg-[color:var(--app-surface)] shadow-[0_16px_34px_rgba(15,23,32,0.05)]">
          <CardHeader>
            <CardTitle>Alertas operacionais</CardTitle>
            <CardDescription>
              {alerts
                ? `${alerts.items.length} item(ns) atrasado(s) listado(s)`
                : "Carregando alertas reais da API."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3">
                <span className="text-sm text-muted-foreground">Atrasos +1 dia</span>
                <p className="mt-2 text-2xl font-semibold">{alerts?.overdueCounts.oneDay ?? "—"}</p>
              </div>
              <div className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3">
                <span className="text-sm text-muted-foreground">Atrasos +3 dias</span>
                <p className="mt-2 text-2xl font-semibold">{alerts?.overdueCounts.threeDays ?? "—"}</p>
              </div>
              <div className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3">
                <span className="text-sm text-muted-foreground">Atrasos +7 dias</span>
                <p className="mt-2 text-2xl font-semibold">{alerts?.overdueCounts.sevenDays ?? "—"}</p>
              </div>
            </div>

            {alerts?.items.length ? (
              alerts.items.map((item) => (
                <div key={item.id} className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento {formatDate(item.dueDate)}
                        {item.installmentLabel ? ` • Parcela ${item.installmentLabel}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatMoney(item.amount)}</p>
                      <p className="text-xs text-amber-600">{item.daysOverdue} dia(s) em atraso</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.loading ? "Carregando..." : "Nenhum item em atraso retornado pela API."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.2rem] border-black/6 bg-[color:var(--app-surface)] shadow-[0_16px_34px_rgba(15,23,32,0.05)]">
        <CardHeader>
          <CardTitle>Últimos movimentos</CardTitle>
          <CardDescription>Lançamentos mais recentes para leitura rápida.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentTransactions.length ? (
            recentTransactions.map((item) => (
              <div key={item.id} className="rounded-[1rem] border border-black/6 bg-[color:var(--app-surface-strong)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.category} • {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={item.type === "INCOME" ? "font-medium text-emerald-600 dark:text-emerald-300" : "font-medium text-rose-600 dark:text-rose-300"}>
                      {item.type === "INCOME" ? "+" : "-"}
                      {formatMoney(item.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.status}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {state.loading ? "Carregando..." : "Nenhum lançamento recente encontrado."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
