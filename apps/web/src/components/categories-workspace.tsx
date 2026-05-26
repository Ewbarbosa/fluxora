"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRightIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react"

import { getStoredToken } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

type CategoryType = "INCOME" | "EXPENSE"

type Category = {
  id: number
  name: string
  type: CategoryType
  color?: string | null
}

type Filters = {
  search: string
  type: "ALL" | CategoryType
}

type FormState = {
  id?: number
  name: string
  type: CategoryType
  color: string
  colorInput: string
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
const defaultCategoryColors: Record<CategoryType, string> = {
  INCOME: "#059669",
  EXPENSE: "#E11D48",
}

const initialFilters: Filters = {
  search: "",
  type: "ALL",
}

const initialFormState: FormState = {
  name: "",
  type: "EXPENSE",
  color: defaultCategoryColors.EXPENSE,
  colorInput: defaultCategoryColors.EXPENSE,
}

function typeLabel(type: CategoryType) {
  return type === "INCOME" ? "Receita" : "Despesa"
}

function typeClassName(type: CategoryType) {
  return type === "INCOME"
    ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
    : "bg-rose-500/12 text-rose-700 ring-rose-500/20 dark:text-rose-300"
}

function normalizeColor(value: string) {
  return value.trim().toUpperCase()
}

function sanitizeColorInput(value: string) {
  const raw = value.toUpperCase().replace(/[^#0-9A-F]/g, "")
  const digits = raw.replace(/#/g, "").slice(0, 6)
  return `#${digits}`
}

function isFullHexColor(value: string) {
  return /^#[0-9A-F]{6}$/.test(normalizeColor(value))
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

export function CategoriesWorkspace() {
  const [categories, setCategories] = useState<Category[]>([])
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const token = useMemo(() => getStoredToken(), [])

  const loadCategories = useCallback(async () => {
    if (!token) {
      toast.error("Sessão não encontrada. Faça login novamente para carregar as categorias reais.")
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${apiBaseUrl}/finance/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error("Não foi possível carregar as categorias financeiras.")
      }

      const json = (await response.json()) as Category[]
      setCategories(json)
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Falha ao carregar categorias.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCategories])

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchesType = filters.type === "ALL" || category.type === filters.type
      const matchesSearch = !filters.search.trim()
        || category.name.toLowerCase().includes(filters.search.trim().toLowerCase())

      return matchesType && matchesSearch
    })
  }, [categories, filters])

  const summary = useMemo(() => {
    return categories.reduce(
      (acc, item) => {
        if (item.type === "INCOME") acc.income += 1
        if (item.type === "EXPENSE") acc.expense += 1
        return acc
      },
      { income: 0, expense: 0 }
    )
  }, [categories])

  function openCreateModal() {
    setModalMode("create")
    setFormState(initialFormState)
    setModalOpen(true)
  }

  function openEditModal(category: Category) {
    setModalMode("edit")
    setFormState({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color || defaultCategoryColors[category.type],
      colorInput: category.color || defaultCategoryColors[category.type],
    })
    setModalOpen(true)
  }

  function handleTypeChange(nextType: CategoryType) {
    setFormState((current) => {
      const currentDefault = defaultCategoryColors[current.type]
      const nextDefault = defaultCategoryColors[nextType]
      const shouldSwapColor =
        !current.colorInput || normalizeColor(current.colorInput) === normalizeColor(currentDefault)

      const normalizedInput = sanitizeColorInput(current.colorInput)
      const nextColor = shouldSwapColor
        ? nextDefault
        : isFullHexColor(normalizedInput)
          ? normalizeColor(normalizedInput)
          : current.color

      return {
        ...current,
        type: nextType,
        color: nextColor,
        colorInput: shouldSwapColor ? nextDefault : normalizedInput,
      }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      toast.error("Sessão inválida. Faça login novamente.")
      return
    }

    if (!formState.name.trim()) {
      toast.warning("Nome da categoria é obrigatório.")
      return
    }

    if (!isFullHexColor(formState.colorInput)) {
      toast.warning("Defina uma cor válida no formato hexadecimal.")
      return
    }

    setSubmitting(true)

    try {
      const isEdit = modalMode === "edit" && formState.id
      const response = await fetch(
        isEdit ? `${apiBaseUrl}/finance/categories/${formState.id}` : `${apiBaseUrl}/finance/categories`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formState.name.trim(),
            type: formState.type,
            color: normalizeColor(formState.colorInput),
          }),
        }
      )

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string | string[] } | null
        const message = Array.isArray(json?.message) ? json.message.join(" ") : json?.message
        throw new Error(message || `Não foi possível ${isEdit ? "salvar" : "criar"} a categoria.`)
      }

      setModalOpen(false)
      setFormState(initialFormState)
      toast.success(isEdit ? "Categoria atualizada." : "Categoria criada.")
      await loadCategories()
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Falha ao salvar categoria.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCategory() {
    if (!token || !deleteTarget) return

    setDeletingId(deleteTarget.id)

    try {
      const response = await fetch(`${apiBaseUrl}/finance/categories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string | string[] } | null
        const message = Array.isArray(json?.message) ? json.message.join(" ") : json?.message
        throw new Error(message || "Não foi possível excluir a categoria.")
      }

      setDeleteTarget(null)
      toast.success("Categoria excluída.")
      await loadCategories()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Falha ao excluir categoria.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="gap-3 border-b">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-2xl">Categorias financeiras</CardTitle>
                  <CardDescription>
                    Aqui mora a organização mínima do produto. Sem categoria boa, o financeiro só muda de roupa e continua bagunçado.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={openCreateModal}>
                    <PlusIcon className="size-4" />
                    Nova categoria
                  </Button>
                  <Button variant="outline" onClick={() => void loadCategories()} disabled={loading}>
                    <RefreshCcwIcon className={cn("size-4", loading && "animate-spin")} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="category-search">Buscar</FieldLabel>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="category-search"
                      placeholder="Nome da categoria"
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="category-type-filter">Tipo</FieldLabel>
                  <SelectField
                    id="category-type-filter"
                    value={filters.type}
                    onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as Filters["type"] }))}
                  >
                    <option value="ALL">Todos os tipos</option>
                    <option value="INCOME">Receitas</option>
                    <option value="EXPENSE">Despesas</option>
                  </SelectField>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <Card size="sm">
              <CardHeader>
                <CardDescription>Total cadastrado</CardDescription>
                <CardTitle className="text-2xl">{categories.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Categorias de receita</CardDescription>
                <CardTitle className="text-emerald-600 dark:text-emerald-300">{summary.income}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Categorias de despesa</CardDescription>
                <CardTitle className="text-rose-600 dark:text-rose-300">{summary.expense}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Lista de categorias</CardTitle>
            <CardDescription>
              {filteredCategories.length} item(ns) exibido(s). Use esta lista para editar, excluir e organizar as categorias financeiras.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-3 h-4 w-32" />
                </div>
              ))
            ) : filteredCategories.length ? (
              filteredCategories.map((category) => (
                <div key={category.id} className="rounded-xl border bg-card/40 p-4 shadow-xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="rounded-xl p-2 text-white shadow-sm"
                        style={{ backgroundColor: category.color || defaultCategoryColors[category.type] }}
                      >
                        <TagsIcon className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", typeClassName(category.type))}>
                            {typeLabel(category.type)}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                            ID #{category.id}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: category.color || defaultCategoryColors[category.type] }}
                            />
                            {category.color || defaultCategoryColors[category.type]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(category)}>
                        <PencilIcon className="size-4" />
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(category)} disabled={deletingId === category.id}>
                        <Trash2Icon className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="font-medium">Nenhuma categoria encontrada</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ajuste os filtros ou crie uma nova categoria.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Recomendação prática: mantenha nomes curtos, claros e estáveis para facilitar a operação e os relatórios.
            </p>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === "create" ? "Nova categoria" : "Editar categoria"}</DialogTitle>
            <DialogDescription>
              {modalMode === "create"
                ? "Crie categorias simples e úteis para organizar os lançamentos."
                : "Ajuste os dados da categoria selecionada."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="category-name">Nome</FieldLabel>
                <Input
                  id="category-name"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Honorários, Assinaturas, Fornecedores"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="category-type">Tipo</FieldLabel>
                <SelectField
                  id="category-type"
                  value={formState.type}
                  onChange={(event) => handleTypeChange(event.target.value as CategoryType)}
                >
                  <option value="EXPENSE">Despesa</option>
                  <option value="INCOME">Receita</option>
                </SelectField>
                <FieldDescription>
                  O tipo precisa corresponder ao uso real da categoria nos lançamentos.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="category-color">Cor</FieldLabel>
                <div className="flex items-center gap-3">
                  <Input
                    id="category-color"
                    type="color"
                    value={formState.color}
                    onChange={(event) => {
                      const nextColor = normalizeColor(event.target.value)
                      setFormState((current) => ({ ...current, color: nextColor, colorInput: nextColor }))
                    }}
                    className="h-10 w-14 cursor-pointer p-1"
                  />
                  <Input
                    id="category-color-hex"
                    value={formState.colorInput}
                    onChange={(event) => {
                      const nextInput = sanitizeColorInput(event.target.value)
                      setFormState((current) => ({
                        ...current,
                        colorInput: nextInput,
                        color: isFullHexColor(nextInput) ? normalizeColor(nextInput) : current.color,
                      }))
                    }}
                    placeholder="#E11D48"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={7}
                    className="h-10 font-mono uppercase"
                  />
                </div>
                <FieldDescription>
                  Essa cor será usada para identificar visualmente a categoria nos gráficos e listas.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter className="px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : modalMode === "create" ? "Criar categoria" : "Salvar categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A categoria “${deleteTarget.name}” será removida da lista ativa. Os lançamentos antigos continuam existindo para preservar o histórico.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletingId !== null}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleDeleteCategory()} disabled={deletingId !== null}>
              {deletingId !== null ? "Excluindo..." : "Excluir categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
