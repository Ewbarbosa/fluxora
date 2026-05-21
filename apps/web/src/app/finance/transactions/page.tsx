import { AppShell } from "@/components/app-shell"
import { TransactionsWorkspace } from "@/components/transactions-workspace"

export default function TransactionsPage() {
  return (
    <AppShell title="Lançamentos" section="Financeiro">
      <TransactionsWorkspace />
    </AppShell>
  )
}
