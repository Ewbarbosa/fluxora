"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  BellRingIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { getStoredToken } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
const PAGE_SIZE = 100

const typeOptions = [
  { label: "Todos os tipos", value: "ALL" },
  { label: "Receitas", value: "INCOME" },
  { label: "Despesas", value: "EXPENSE" },
] as const

const statusOptions = [
  { label: "Todos os status", value: "ALL" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Pagos", value: "PAID" },
  { label: "Atrasados", value: "OVERDUE" },
  { label: "Cancelados", value: "CANCELLED" },
] as const

const recurrenceOptions = [
  { label: "Mensal", value: "MONTHLY" },
  { label: "Semanal", value: "WEEKLY" },
  { label: "Anual", value: "YEARLY" },
] as const

const periodPresetLabels = {
  TODAY: "Hoje",
  "7_DAYS": "7 dias",
  "30_DAYS": "30 dias",
  THIS_MONTH: "Este mês",
  NEXT_MONTH: "Próximo mês",
  CUSTOM: "Personalizado",
} as const

type PeriodPreset = keyof typeof periodPresetLabels
type FilterType = (typeof typeOptions)[number]["value"]
type FilterStatus = (typeof statusOptions)[number]["value"]
type TransactionType = "INCOME" | "EXPENSE"
type TransactionStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED"
type RecurrenceFrequency = (typeof recurrenceOptions)[number]["value"]
type EntryMode = "SINGLE" | "RECURRING" | "INSTALLMENTS"
type UpdateScope = "SINGLE" | "ALL"

type Category = {
  id: number
  name: string
  type: TransactionType
}

type Transaction = {
  id: number
  description: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  dueDate: string | null
  competenceDate: string | null
  paymentDate: string | null
  notes?: string | null
  installmentNumber?: number | null
  installmentCount?: number | null
  recurrenceIndex?: number | null
  recurrenceCount?: number | null
  isRecurring?: boolean
  categoryId?: number | null
  recurrenceFrequency?: RecurrenceFrequency | null
  category?: Category | null
}

type TransactionResponse = {
  data: Transaction[]
  totalItems: number
  totalPages: number
  currentPage: number
  pageSize: number
}

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

type Filters = {
  search: string
  type: FilterType
  status: FilterStatus
  categoryId: string
  startDate: string
  endDate: string
}

type FormState = {
  id?: number
  type: TransactionType
  description: string
  amount: string
  categoryId: string
  competenceDate: string
  dueDate: string
  paymentDate: string
  notes: string
  status: TransactionStatus
  entryMode: EntryMode
  recurrenceFrequency: RecurrenceFrequency
  recurrenceInterval: string
  recurrenceCount: string
  installmentCount: string
  updateScope: UpdateScope
}

type SettlementFormState = {
  paymentDate: string
  penaltyAmount: string
  interestAmount: string
  discountAmount: string
  notes: string
}

type DeleteTarget = {
  id: number
  description: string
  entryMode: EntryMode
}

const initialFormState: FormState = {
  type: "EXPENSE",
  description: "",
  amount: "",
  categoryId: "",
  competenceDate: "",
  dueDate: "",
  paymentDate: "",
  notes: "",
  status: "PENDING",
  entryMode: "SINGLE",
  recurrenceFrequency: "MONTHLY",
  recurrenceInterval: "1",
  recurrenceCount: "2",
  installmentCount: "2",
  updateScope: "SINGLE",
}

const initialSettlementState: SettlementFormState = {
  paymentDate: toDateInputValue(new Date()),
  penaltyAmount: "0",
  interestAmount: "0",
  discountAmount: "0",
  notes: "",
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getPresetRange(preset: PeriodPreset) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case "TODAY":
      return { startDate: toDateInputValue(today), endDate: toDateInputValue(today) }
    case "7_DAYS": {
      const end = new Date(today)
      end.setDate(end.getDate() + 6)
      return { startDate: toDateInputValue(today), endDate: toDateInputValue(end) }
    }
    case "30_DAYS": {
      const end = new Date(today)
      end.setDate(end.getDate() + 29)
      return { startDate: toDateInputValue(today), endDate: toDateInputValue(end) }
    }
    case "THIS_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) }
    }
    case "NEXT_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) }
    }
    case "CUSTOM":
    default:
      return { startDate: "", endDate: "" }
  }
}

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

function formatDateInput(value: string | null) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

function toIsoDate(value: string) {
  if (!value) return undefined
  return new Date(`${value}T12:00:00`).toISOString()
}

function getPeriodLabel(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return "Período inteiro"
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  if (start && end) return `${formatter.format(start)} até ${formatter.format(end)}`
  if (start) return `A partir de ${formatter.format(start)}`
  return `Até ${formatter.format(end as Date)}`
}

function buildQuery(filters: Filters, currentPage: number) {
  const params = new URLSearchParams({
    currentPage: String(currentPage),
    pageSize: String(PAGE_SIZE),
  })

  if (filters.search.trim()) params.set("search", filters.search.trim())
  if (filters.type !== "ALL") params.set("type", filters.type)
  if (filters.status !== "ALL") params.set("status", filters.status)
  if (filters.categoryId !== "ALL") params.set("categoryId", filters.categoryId)
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)

  return params.toString()
}

function statusLabel(status: TransactionStatus) {
  switch (status) {
    case "PAID":
      return "Pago"
    case "OVERDUE":
      return "Vencido"
    case "CANCELLED":
      return "Cancelado"
    default:
      return "Pendente"
  }
}

function statusClassName(status: TransactionStatus) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
    case "OVERDUE":
      return "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-300"
    case "CANCELLED":
      return "bg-muted text-muted-foreground ring-border"
    default:
      return "bg-sky-500/12 text-sky-700 ring-sky-500/20 dark:text-sky-300"
  }
}

function recurrenceLabel(value: RecurrenceFrequency | null | undefined) {
  if (value === "WEEKLY") return "Semanal"
  if (value === "YEARLY") return "Anual"
  return "Mensal"
}

function seriesLabel(item: Transaction) {
  if (item.isRecurring && item.recurrenceFrequency) {
    return `${recurrenceLabel(item.recurrenceFrequency)}${item.recurrenceIndex && item.recurrenceCount ? ` ${item.recurrenceIndex}/${item.recurrenceCount}` : ""}`
  }

  if (item.installmentNumber && item.installmentCount) {
    return `Parcela ${item.installmentNumber}/${item.installmentCount}`
  }

  return null
}

function SelectField(props: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  )
}

export function TransactionsWorkspace() {
  const initialRange = useMemo(() => getPresetRange("THIS_MONTH"), [])

  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "ALL",
    status: "ALL",
    categoryId: "ALL",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
  })
  const [page, setPage] = useState(1)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("THIS_MONTH")
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<TransactionResponse | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [notifications, setNotifications] = useState<Notifications | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowActionId, setRowActionId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [submitting, setSubmitting] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<Transaction | null>(null)
  const [payFormState, setPayFormState] = useState<SettlementFormState>(initialSettlementState)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleteScope, setDeleteScope] = useState<UpdateScope>("SINGLE")
  const [deleting, setDeleting] = useState(false)

  const token = useMemo(() => getStoredToken(), [])

  const formCategories = useMemo(
    () => categories.filter((category) => category.type === formState.type),
    [categories, formState.type]
  )

  const groupedTransactions = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    const groups = new Map<string, { label: string; items: Transaction[]; income: number; expense: number }>()

    for (const item of transactions?.data ?? []) {
      const rawDate = item.dueDate ?? item.competenceDate ?? new Date().toISOString()
      const date = new Date(rawDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!groups.has(key)) {
        groups.set(key, {
          label: formatter.format(date),
          items: [],
          income: 0,
          expense: 0,
        })
      }

      const group = groups.get(key)!
      group.items.push(item)
      if (item.type === "INCOME") group.income += item.amount
      else group.expense += item.amount
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => group)
  }, [transactions])

  const loadData = useCallback(async () => {
    if (!token) {
      toast.error("Sessão não encontrada. Faça login novamente para carregar os lançamentos reais.")
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      const query = buildQuery(filters, page)

      const [categoriesResponse, transactionsResponse, summaryResponse, notificationsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/finance/categories`, { headers }),
        fetch(`${apiBaseUrl}/finance/transactions?${query}`, { headers }),
        fetch(`${apiBaseUrl}/finance/summary?startDate=${filters.startDate || ""}&endDate=${filters.endDate || ""}`, { headers }),
        fetch(`${apiBaseUrl}/finance/notifications`, { headers }),
      ])

      if (!categoriesResponse.ok) throw new Error("Não foi possível carregar as categorias financeiras.")
      if (!transactionsResponse.ok) throw new Error("Não foi possível carregar os lançamentos financeiros.")
      if (!notificationsResponse.ok) throw new Error("Não foi possível carregar os alertas operacionais.")

      setCategories((await categoriesResponse.json()) as Category[])
      setTransactions((await transactionsResponse.json()) as TransactionResponse)
      setNotifications((await notificationsResponse.json()) as Notifications)

      if (summaryResponse.ok) {
        setSummary((await summaryResponse.json()) as Summary)
      } else {
        setSummary(null)
      }
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Falha ao carregar dados do financeiro.")
    } finally {
      setLoading(false)
    }
  }, [filters, page, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  function applyPreset(preset: PeriodPreset) {
    setPeriodPreset(preset)
    setPage(1)
    if (preset === "CUSTOM") return
    const range = getPresetRange(preset)
    setFilters((current) => ({ ...current, startDate: range.startDate, endDate: range.endDate }))
  }

  function applyCustomRange() {
    setPeriodPreset("CUSTOM")
    setPage(1)
  }

  function onSearch() {
    setFilters((current) => ({ ...current, search: search.trim() }))
    setPage(1)
  }

  function openCreateModal() {
    setModalMode("create")
    setFormState(initialFormState)
    setModalOpen(true)
  }

  function openEditModal(item: Transaction) {
    const entryMode: EntryMode = item.installmentCount && item.installmentCount > 1
      ? "INSTALLMENTS"
      : item.isRecurring
        ? "RECURRING"
        : "SINGLE"

    setModalMode("edit")
    setFormState({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: String(item.amount),
      categoryId: String(item.category?.id ?? item.categoryId ?? ""),
      competenceDate: formatDateInput(item.competenceDate),
      dueDate: formatDateInput(item.dueDate),
      paymentDate: formatDateInput(item.paymentDate),
      notes: item.notes ?? "",
      status: item.status === "OVERDUE" ? "PENDING" : item.status,
      entryMode,
      recurrenceFrequency: item.recurrenceFrequency ?? "MONTHLY",
      recurrenceInterval: "1",
      recurrenceCount: String(item.recurrenceCount ?? 2),
      installmentCount: String(item.installmentCount ?? 2),
      updateScope: "SINGLE",
    })
    setModalOpen(true)
  }

  function openPayModal(item: Transaction) {
    setPayTarget(item)
    setPayFormState({
      ...initialSettlementState,
      paymentDate: formatDateInput(item.paymentDate) || toDateInputValue(new Date()),
    })
    setPayModalOpen(true)
  }

  function openDeleteModal(item: Transaction) {
    const entryMode: EntryMode = item.installmentCount && item.installmentCount > 1
      ? "INSTALLMENTS"
      : item.isRecurring
        ? "RECURRING"
        : "SINGLE"

    setDeleteTarget({
      id: item.id,
      description: item.description,
      entryMode,
    })
    setDeleteScope("SINGLE")
    setDeleteModalOpen(true)
  }

  async function confirmPayment() {
    if (!token || !payTarget) return
    setRowActionId(payTarget.id)

    try {
      const response = await fetch(`${apiBaseUrl}/finance/transactions/${payTarget.id}/pay`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentDate: toIsoDate(payFormState.paymentDate),
          penaltyAmount: Number(payFormState.penaltyAmount || "0"),
          interestAmount: Number(payFormState.interestAmount || "0"),
          discountAmount: Number(payFormState.discountAmount || "0"),
          notes: payFormState.notes.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string | string[] } | null
        const message = Array.isArray(json?.message) ? json.message.join(" ") : json?.message
        throw new Error(message || "Não foi possível marcar o lançamento como pago.")
      }

      setPayModalOpen(false)
      setPayTarget(null)
      toast.success("Baixa confirmada com sucesso.")
      await loadData()
    } catch (markError) {
      toast.error(markError instanceof Error ? markError.message : "Falha ao atualizar lançamento.")
    } finally {
      setRowActionId(null)
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return

    setDeleting(true)
    setRowActionId(deleteTarget.id)

    try {
      const params = new URLSearchParams()
      params.set("deleteScope", deleteScope)

      const response = await fetch(`${apiBaseUrl}/finance/transactions/${deleteTarget.id}?${params.toString()}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const json = (await response.json().catch(() => null)) as
        | { message?: string | string[]; deletedCount?: number; scope?: UpdateScope }
        | null

      if (!response.ok) {
        const message = Array.isArray(json?.message) ? json.message.join(" ") : json?.message
        throw new Error(message || "Não foi possível excluir o lançamento.")
      }

      setDeleteModalOpen(false)
      setDeleteTarget(null)
      setDeleteScope("SINGLE")
      if (json?.scope === "ALL" && json.deletedCount && json.deletedCount > 1) {
        toast.success(`${json.deletedCount} lançamentos excluídos.`)
      } else {
        toast.success("Lançamento excluído.")
      }
      await loadData()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Falha ao excluir lançamento.")
    } finally {
      setDeleting(false)
      setRowActionId(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      toast.error("Sessão inválida. Faça login novamente.")
      return
    }

    if (!formState.description.trim()) {
      toast.warning("Descrição é obrigatória.")
      return
    }

    if (!formState.amount || Number(formState.amount) <= 0) {
      toast.warning("Informe um valor válido maior que zero.")
      return
    }

    if (!formState.categoryId) {
      toast.warning("Selecione uma categoria.")
      return
    }

    if (!formState.dueDate) {
      toast.warning("Informe a data de vencimento.")
      return
    }

    const payload: Record<string, unknown> = {
      type: formState.type,
      description: formState.description.trim(),
      amount: Number(formState.amount),
      categoryId: Number(formState.categoryId),
      competenceDate: toIsoDate(formState.competenceDate),
      dueDate: toIsoDate(formState.dueDate),
      paymentDate: toIsoDate(formState.paymentDate),
      notes: formState.notes.trim() || undefined,
    }

    if (modalMode === "edit") {
      payload.status = formState.status
      payload.updateScope = formState.updateScope
    }

    if (modalMode === "create" && formState.entryMode === "RECURRING") {
      payload.recurrenceFrequency = formState.recurrenceFrequency
      payload.recurrenceInterval = Number(formState.recurrenceInterval || "1")
      payload.recurrenceCount = Number(formState.recurrenceCount)
    }

    if (modalMode === "create" && formState.entryMode === "INSTALLMENTS") {
      payload.installmentCount = Number(formState.installmentCount)
    }

    setSubmitting(true)

    try {
      const isEdit = modalMode === "edit" && formState.id
      const endpoint = isEdit
        ? `${apiBaseUrl}/finance/transactions/${formState.id}`
        : `${apiBaseUrl}/finance/transactions`

      const response = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = (await response.json().catch(() => null)) as
        | { message?: string | string[]; updatedCount?: number; scope?: UpdateScope }
        | null

      if (!response.ok) {
        const message = Array.isArray(json?.message) ? json.message.join(" ") : json?.message
        throw new Error(message || "Não foi possível salvar o lançamento.")
      }

      setModalOpen(false)
      setFormState(initialFormState)
      if (modalMode === "create") {
        toast.success("Lançamento criado.")
      } else if (json?.scope === "ALL" && json.updatedCount && json.updatedCount > 1) {
        toast.success(`${json.updatedCount} lançamentos atualizados.`)
      } else {
        toast.success("Lançamento atualizado.")
      }
      await loadData()
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Falha ao salvar lançamento.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="space-y-6 p-4 pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-28" /></CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Receitas</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatMoney(summary?.totalIncome ?? 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Despesas</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatMoney(summary?.totalExpense ?? 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatMoney(summary?.balance ?? 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidos</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{summary?.overdueCount ?? 0}</CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRingIcon className="h-4 w-4" /> Alertas de atraso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Vencem hoje</p>
                <p className="text-2xl font-semibold">{notifications?.dueTodayCount ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Atrasados 1+ dia</p>
                <p className="text-2xl font-semibold">{notifications?.overdueCounts.oneDay ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Atrasados 3+ dias</p>
                <p className="text-2xl font-semibold">{notifications?.overdueCounts.threeDays ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">Atrasados 7+ dias</p>
                <p className="text-2xl font-semibold">{notifications?.overdueCounts.sevenDays ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              {(notifications?.items ?? []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <div className="font-medium">{item.description}</div>
                    <div className="text-muted-foreground">
                      {item.installmentLabel ? `Parcela ${item.installmentLabel} • ` : ""}
                      {item.daysOverdue} dia(s) de atraso
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatMoney(item.amount)}</div>
                    <div className="text-muted-foreground">{formatDate(item.dueDate)}</div>
                  </div>
                </div>
              ))}
              {(notifications?.items?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum alerta de atraso no momento.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Lançamentos por período</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {getPeriodLabel(filters.startDate || undefined, filters.endDate || undefined)}
              </p>
            </div>
            <Button onClick={openCreateModal}>
              <PlusIcon className="mr-2 h-4 w-4" /> Novo lançamento
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(periodPresetLabels) as PeriodPreset[]).map((preset) => (
                  <Button
                    key={preset}
                    variant={periodPreset === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {periodPresetLabels[preset]}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_190px_190px]">
                <div className="flex gap-2">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por descrição..."
                  />
                  <Button onClick={onSearch}>
                    <SearchIcon className="mr-2 h-4 w-4" /> Buscar
                  </Button>
                </div>

                <SelectField
                  value={filters.type}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, type: event.target.value as FilterType }))
                    setPage(1)
                  }}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>

                <SelectField
                  value={filters.status}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, status: event.target.value as FilterStatus }))
                    setPage(1)
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>

                <div className="flex items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
                  <CalendarDaysIcon className="h-4 w-4" /> Agrupado por mês
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data inicial</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data final</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="outline" className="w-full" onClick={applyCustomRange}>
                    Aplicar período personalizado
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-xl border bg-background shadow-sm">
                    <div className="border-b px-4 py-4"><Skeleton className="h-10 w-full" /></div>
                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                  </div>
                ))
              ) : groupedTransactions.length ? (
                groupedTransactions.map((group) => (
                  <div key={group.label} className="overflow-hidden rounded-xl border bg-background shadow-sm">
                    <div className="border-b bg-muted/40 px-4 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold capitalize tracking-tight">{group.label}</h3>
                          <p className="text-sm text-muted-foreground">{group.items.length} lançamento(s) neste período</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                            <div className="text-muted-foreground">Receitas</div>
                            <div className="font-semibold text-emerald-600 dark:text-emerald-300">{formatMoney(group.income)}</div>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                            <div className="text-muted-foreground">Despesas</div>
                            <div className="font-semibold text-rose-600 dark:text-rose-300">{formatMoney(group.expense)}</div>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                            <div className="text-muted-foreground">Saldo</div>
                            <div className={cn("font-semibold", group.income - group.expense >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                              {formatMoney(group.income - group.expense)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y">
                      <div className="hidden bg-muted/20 px-4 py-3 lg:grid lg:grid-cols-[minmax(0,2fr)_160px_140px_140px_160px_220px] lg:items-center lg:gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lançamento</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vencimento</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                        <div className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</div>
                        <div className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</div>
                      </div>

                      {group.items.map((item) => {
                        const itemSeries = seriesLabel(item)
                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_160px_140px_140px_160px_220px] lg:items-center">
                              <div className="min-w-0 space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Lançamento</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{item.description}</span>
                                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                                    {item.type === "INCOME" ? "Receita" : "Despesa"}
                                  </span>
                                  {itemSeries ? (
                                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground ring-1 ring-inset ring-border">
                                      {itemSeries}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Categoria</div>
                                <div className="truncate text-sm">{item.category?.name ?? "Sem categoria"}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Vencimento</div>
                                <div className="text-sm">{formatDate(item.dueDate)}</div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Status</div>
                                <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", statusClassName(item.status))}>
                                  {statusLabel(item.status)}
                                </span>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Valor</div>
                                <div className={cn("text-sm font-semibold lg:text-right", item.type === "INCOME" ? "text-emerald-600 dark:text-emerald-300" : "text-foreground")}>
                                  {formatMoney(item.amount)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Ações</div>
                                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Abrir ações do lançamento" />}>
                                      <EllipsisVerticalIcon className="size-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="min-w-48">
                                      {(item.status === "PENDING" || item.status === "OVERDUE") ? (
                                        <DropdownMenuItem onClick={() => openPayModal(item)}>
                                          <CheckCircle2Icon className="size-4" />
                                          Baixar lançamento
                                        </DropdownMenuItem>
                                      ) : null}
                                      <DropdownMenuItem onClick={() => openEditModal(item)}>
                                        <PencilIcon className="size-4" />
                                        Editar lançamento
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem variant="destructive" onClick={() => openDeleteModal(item)}>
                                        <Trash2Icon className="size-4" />
                                        Excluir lançamento
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para o período e filtros selecionados.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {transactions?.currentPage ?? 1} de {transactions?.totalPages ?? 1}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= (transactions?.totalPages ?? 1) || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="p-0">
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "Novo lançamento" : "Editar lançamento"}</DialogTitle>
            <DialogDescription>
              {modalMode === "create"
                ? "Cadastre receita, despesa, recorrência ou parcelamento."
                : "Ajuste o lançamento selecionado e salve as alterações."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="entry-type">Tipo</FieldLabel>
                  <SelectField
                    id="entry-type"
                    value={formState.type}
                    onChange={(event) => {
                      const nextType = event.target.value as TransactionType
                      setFormState((current) => ({ ...current, type: nextType, categoryId: "" }))
                    }}
                  >
                    <option value="EXPENSE">Despesa</option>
                    <option value="INCOME">Receita</option>
                  </SelectField>
                </Field>

                <Field>
                  <FieldLabel htmlFor="entry-mode">Modo</FieldLabel>
                  <SelectField
                    id="entry-mode"
                    value={formState.entryMode}
                    disabled={modalMode === "edit"}
                    onChange={(event) => setFormState((current) => ({ ...current, entryMode: event.target.value as EntryMode }))}
                  >
                    <option value="SINGLE">Lançamento único</option>
                    <option value="RECURRING">Recorrência</option>
                    <option value="INSTALLMENTS">Parcelamento</option>
                  </SelectField>
                  {modalMode === "edit" && formState.entryMode === "SINGLE" ? (
                    <FieldDescription>Esse lançamento é individual, então a edição afeta só este item.</FieldDescription>
                  ) : null}
                </Field>

                {modalMode === "edit" && formState.entryMode !== "SINGLE" ? (
                  <Field>
                    <FieldLabel htmlFor="update-scope">Aplicar alterações em</FieldLabel>
                    <SelectField
                      id="update-scope"
                      value={formState.updateScope}
                      onChange={(event) => setFormState((current) => ({ ...current, updateScope: event.target.value as UpdateScope }))}
                    >
                      <option value="SINGLE">Somente este lançamento</option>
                      <option value="ALL">Todos desta série</option>
                    </SelectField>
                    <FieldDescription>
                      Use item único para ajustar uma parcela/ocorrência isolada ou a série inteira para replicar a edição.
                    </FieldDescription>
                  </Field>
                ) : null}

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="description">Descrição</FieldLabel>
                  <Input id="description" value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="amount">Valor</FieldLabel>
                  <Input id="amount" type="number" min="0" step="0.01" value={formState.amount} onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="categoryId">Categoria</FieldLabel>
                  <SelectField id="categoryId" value={formState.categoryId} onChange={(event) => setFormState((current) => ({ ...current, categoryId: event.target.value }))}>
                    <option value="">Selecione</option>
                    {formCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </SelectField>
                </Field>

                <Field>
                  <FieldLabel htmlFor="competenceDate">Competência</FieldLabel>
                  <Input id="competenceDate" type="date" value={formState.competenceDate} onChange={(event) => setFormState((current) => ({ ...current, competenceDate: event.target.value }))} />
                </Field>

                <Field>
                  <FieldLabel htmlFor="dueDate">Vencimento</FieldLabel>
                  <Input id="dueDate" type="date" value={formState.dueDate} onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))} />
                  <FieldDescription>Obrigatório para qualquer lançamento.</FieldDescription>
                </Field>

                {modalMode === "edit" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="status-edit">Status</FieldLabel>
                      <SelectField id="status-edit" value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as TransactionStatus }))}>
                        <option value="PENDING">Pendente</option>
                        <option value="PAID">Pago</option>
                        <option value="CANCELLED">Cancelado</option>
                      </SelectField>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="paymentDate">Data de pagamento</FieldLabel>
                      <Input id="paymentDate" type="date" value={formState.paymentDate} onChange={(event) => setFormState((current) => ({ ...current, paymentDate: event.target.value }))} />
                    </Field>
                  </>
                ) : null}

                {modalMode === "create" && formState.entryMode === "RECURRING" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="recurrenceFrequency">Frequência</FieldLabel>
                      <SelectField id="recurrenceFrequency" value={formState.recurrenceFrequency} onChange={(event) => setFormState((current) => ({ ...current, recurrenceFrequency: event.target.value as RecurrenceFrequency }))}>
                        {recurrenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </SelectField>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="recurrenceInterval">Intervalo</FieldLabel>
                      <Input id="recurrenceInterval" type="number" min="1" value={formState.recurrenceInterval} onChange={(event) => setFormState((current) => ({ ...current, recurrenceInterval: event.target.value }))} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="recurrenceCount">Ocorrências</FieldLabel>
                      <Input id="recurrenceCount" type="number" min="2" value={formState.recurrenceCount} onChange={(event) => setFormState((current) => ({ ...current, recurrenceCount: event.target.value }))} />
                    </Field>
                  </>
                ) : null}

                {modalMode === "create" && formState.entryMode === "INSTALLMENTS" ? (
                  <Field>
                    <FieldLabel htmlFor="installmentCount">Quantidade de parcelas</FieldLabel>
                    <Input id="installmentCount" type="number" min="2" value={formState.installmentCount} onChange={(event) => setFormState((current) => ({ ...current, installmentCount: event.target.value }))} />
                  </Field>
                ) : null}

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="notes">Observações</FieldLabel>
                  <Input id="notes" value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} />
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : modalMode === "create" ? "Criar lançamento" : "Salvar alterações"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar baixa</DialogTitle>
            <DialogDescription>
              {payTarget
                ? `Confirme a baixa de “${payTarget.description}” e registre os ajustes da operação.`
                : "Confirme a baixa do lançamento selecionado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Valor original</span>
                <span className="font-semibold">{formatMoney(payTarget?.amount ?? 0)}</span>
              </div>
            </div>

            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="settlement-payment-date">Data de pagamento</FieldLabel>
                <Input
                  id="settlement-payment-date"
                  type="date"
                  value={payFormState.paymentDate}
                  onChange={(event) => setPayFormState((current) => ({ ...current, paymentDate: event.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-discount">Desconto</FieldLabel>
                <Input
                  id="settlement-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payFormState.discountAmount}
                  onChange={(event) => setPayFormState((current) => ({ ...current, discountAmount: event.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-penalty">Multa</FieldLabel>
                <Input
                  id="settlement-penalty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payFormState.penaltyAmount}
                  onChange={(event) => setPayFormState((current) => ({ ...current, penaltyAmount: event.target.value }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="settlement-interest">Juros</FieldLabel>
                <Input
                  id="settlement-interest"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payFormState.interestAmount}
                  onChange={(event) => setPayFormState((current) => ({ ...current, interestAmount: event.target.value }))}
                />
              </Field>

              <Field className="md:col-span-2">
                <FieldLabel htmlFor="settlement-notes">Observações da baixa</FieldLabel>
                <Input
                  id="settlement-notes"
                  value={payFormState.notes}
                  onChange={(event) => setPayFormState((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Ex.: acordo com desconto, pagamento negociado, etc."
                />
              </Field>
            </FieldGroup>

            <div className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Valor final da baixa</span>
                <span className="font-semibold">
                  {formatMoney(
                    Math.max(
                      0,
                      (payTarget?.amount ?? 0)
                        + Number(payFormState.penaltyAmount || "0")
                        + Number(payFormState.interestAmount || "0")
                        - Number(payFormState.discountAmount || "0")
                    )
                  )}
                </span>
              </div>
            </div>

            <DialogFooter className="px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)} disabled={rowActionId !== null}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void confirmPayment()} disabled={rowActionId !== null}>
                {rowActionId !== null ? "Confirmando..." : "Confirmar baixa"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Confirme a exclusão de “${deleteTarget.description}”.`
                : "Confirme a exclusão do lançamento selecionado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-4">
            {deleteTarget?.entryMode !== "SINGLE" ? (
              <Field>
                <FieldLabel htmlFor="delete-scope">Excluir</FieldLabel>
                <SelectField
                  id="delete-scope"
                  value={deleteScope}
                  onChange={(event) => setDeleteScope(event.target.value as UpdateScope)}
                >
                  <option value="SINGLE">Somente este lançamento</option>
                  <option value="ALL">Todos desta série</option>
                </SelectField>
                <FieldDescription>
                  Para parcelados e recorrentes, escolha se a exclusão vale só para este item ou para a série inteira.
                </FieldDescription>
              </Field>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Esse lançamento é individual. A exclusão afeta apenas este item.
              </div>
            )}

            <DialogFooter className="px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting || rowActionId === deleteTarget?.id}>
                {deleting ? "Excluindo..." : "Excluir lançamento"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
