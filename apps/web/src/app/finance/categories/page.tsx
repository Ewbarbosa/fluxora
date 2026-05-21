import { AppShell } from "@/components/app-shell"
import { CategoriesWorkspace } from "@/components/categories-workspace"

export default function CategoriesPage() {
  return (
    <AppShell title="Categorias" section="Financeiro">
      <CategoriesWorkspace />
    </AppShell>
  )
}
