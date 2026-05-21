import { AppShell } from "@/components/app-shell"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function Page() {
  return (
    <AppShell title="Visão geral">
      <DashboardOverview />
    </AppShell>
  )
}
