"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BriefcaseBusinessIcon,
  RefreshCcwIcon,
  SirenIcon,
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

type Summary = {
  totalIncome: number
  totalExpense: number
  balance: number
  overdueCount: number
}

type Notifications = {
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

type DashboardState = {
  summary: Summary | null
  notifications: Notifications | null
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

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

export function DashboardOverview() {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    notifications: null,
    loading: true,
    error: null,
  })

  const token = useMemo(() => getStoredToken(), [])

  const loadData = useCallback(async () => {
    if (!token) {
      setState({
        summary: null,
        notifications: null,
        loading: false,
        error: "Sessão não encontrada. Faça login novamente para carregar os dados reais.",
      })
      return
    }

    setState((current) => ({ ...current, loading: true, error: null }))

    const headers = {
      Authorization: `Bearer ${token}`,
    }

    const [summaryResponse, notificationsResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/finance/summary`, { headers }),
      fetch(`${apiBaseUrl}/finance/notifications`, { headers }),
    ])

    const notificationsJson = notificationsResponse.ok
      ? ((await notificationsResponse.json()) as Notifications)
      : null

    let summaryJson: Summary | null = null
    let summaryError: string | null = null

    if (summaryResponse.ok) {
      summaryJson = (await summaryResponse.json()) as Summary
    } else if (summaryResponse.status === 403) {
      summaryError = "Resumo avançado ainda bloqueado para este workspace/plano."
    } else {
      summaryError = "Não foi possível carregar o resumo financeiro."
    }

    if (!notificationsResponse.ok) {
      setState({
        summary: summaryJson,
        notifications: null,
        loading: false,
        error: "Não foi possível carregar os alertas operacionais.",
      })
      return
    }

    setState({
      summary: summaryJson,
      notifications: notificationsJson,
      loading: false,
      error: summaryError,
    })
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  return (
    <div className="flex flex-1 flex-col gap-4 p-1 pt-0 md:p-4 md:pt-0">
      <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--app-hero-border)] bg-[image:var(--app-hero-bg)] text-[color:var(--app-hero-foreground)] shadow-[0_24px_60px_rgba(15,23,32,0.14)]">
        <div className="flex flex-col gap-6 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-hero-surface)] px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[color:var(--app-hero-muted)]">
                <BriefcaseBusinessIcon className="size-3.5" />
                Cockpit financeiro
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Visão financeira</h1>
                <p className="max-w-xl text-sm text-[color:var(--app-hero-muted)]">
                  Resumo real do workspace carregado pela API do Fluxora, já pensado para consulta rápida no celular.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="rounded-2xl border-0 bg-[color:var(--app-hero-button)] text-[color:var(--app-hero-foreground)] hover:bg-[color:var(--app-hero-button-hover)]"
              onClick={() => void loadData()}
              disabled={state.loading}
            >
              <RefreshCcwIcon className={state.loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.5rem] border border-[color:var(--app-hero-border)] bg-[color:var(--app-hero-surface)] p-4 backdrop-blur">
              <p className="text-sm text-[color:var(--app-hero-muted)]">Saldo do período</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {state.summary ? formatMoney(state.summary.balance) : "—"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[color:var(--app-hero-surface-strong)] p-3">
                  <div className="flex items-center gap-2 text-[color:var(--app-hero-muted)]">
                    <ArrowUpRightIcon className="size-4" />
                    Receitas
                  </div>
                  <p className="mt-2 font-semibold text-emerald-100 dark:text-emerald-200">
                    {state.summary ? formatMoney(state.summary.totalIncome) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[color:var(--app-hero-surface-strong)] p-3">
                  <div className="flex items-center gap-2 text-[color:var(--app-hero-muted)]">
                    <ArrowDownRightIcon className="size-4" />
                    Despesas
                  </div>
                  <p className="mt-2 font-semibold text-rose-100 dark:text-rose-200">
                    {state.summary ? formatMoney(state.summary.totalExpense) : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
              <div className="rounded-[1.5rem] border border-[color:var(--app-hero-border)] bg-[color:var(--app-hero-surface)] p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-[color:var(--app-hero-muted)]">
                  <WalletCardsIcon className="size-4" />
                  Vencem hoje
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {state.notifications?.dueTodayCount ?? "—"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-[color:var(--app-hero-border)] bg-[color:var(--app-hero-surface)] p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-[color:var(--app-hero-muted)]">
                  <SirenIcon className="size-4" />
                  Em atraso
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {state.summary?.overdueCount ?? "—"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-[color:var(--app-hero-border)] bg-[color:var(--app-hero-surface)] p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-sm text-[color:var(--app-hero-muted)]">
                  <AlertTriangleIcon className="size-4" />
                  Alertas ativos
                </div>
                <p className="mt-3 text-2xl font-semibold">
                  {state.notifications?.items.length ?? "—"}
                </p>
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

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-[1.5rem] border-[color:var(--app-shell-border)] bg-[color:var(--app-surface-strong)] shadow-[var(--app-card-shadow)]">
          <CardHeader>
            <CardTitle>Alertas operacionais</CardTitle>
            <CardDescription>
              {state.notifications
                ? `${state.notifications.items.length} item(ns) atrasado(s) listado(s)`
                : "Carregando alertas reais da API."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.notifications?.items.length ? (
              state.notifications.items.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-[color:var(--app-soft-border)] bg-[color:var(--app-surface)] p-3 shadow-[var(--app-card-shadow-soft)]">
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
                      <p className="text-xs text-amber-600">
                        {item.daysOverdue} dia(s) em atraso
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.loading
                  ? "Carregando..."
                  : "Nenhum item em atraso retornado pela API."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-[color:var(--app-shell-border)] bg-[color:var(--app-surface-strong)] shadow-[var(--app-card-shadow)]">
          <CardHeader>
            <CardTitle>Radar rápido</CardTitle>
            <CardDescription>Indicadores imediatos do financeiro.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.25rem] border border-[color:var(--app-soft-border)] bg-[color:var(--app-surface)] p-3">
              <span className="text-muted-foreground">Vencem hoje</span>
              <p className="mt-2 text-2xl font-semibold">{state.notifications?.dueTodayCount ?? "—"}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[color:var(--app-soft-border)] bg-[color:var(--app-surface)] p-3">
              <span className="text-muted-foreground">Atrasos +1 dia</span>
              <p className="mt-2 text-2xl font-semibold">{state.notifications?.overdueCounts.oneDay ?? "—"}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[color:var(--app-soft-border)] bg-[color:var(--app-surface)] p-3">
              <span className="text-muted-foreground">Atrasos +3 dias</span>
              <p className="mt-2 text-2xl font-semibold">{state.notifications?.overdueCounts.threeDays ?? "—"}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[color:var(--app-soft-border)] bg-[color:var(--app-surface)] p-3">
              <span className="text-muted-foreground">Atrasos +7 dias</span>
              <p className="mt-2 text-2xl font-semibold">{state.notifications?.overdueCounts.sevenDays ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
