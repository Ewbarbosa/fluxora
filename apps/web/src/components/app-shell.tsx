import { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type AppShellProps = {
  title: string
  section?: string
  children: ReactNode
}

export function AppShell({ title, section = "Fluxora", children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-x-clip bg-background md:overflow-hidden md:border md:border-[color:var(--app-shell-border)] md:bg-[color:var(--app-panel-strong)] md:shadow-[var(--app-shell-shadow)]">
        <header className="sticky top-0 z-30 hidden shrink-0 items-center border-b border-[color:var(--app-shell-border)] bg-[color:var(--app-panel-strong)]/92 backdrop-blur-xl md:flex">
          <div className="mx-auto flex w-full max-w-[1680px] items-center gap-2 px-4 pb-2 pt-[max(0.75rem,var(--safe-area-top))] md:px-5 md:pt-4">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden data-vertical:h-4 data-vertical:self-auto md:block"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">{section}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto hidden text-right md:block">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Fluxora
              </p>
              <p className="text-sm text-foreground/80">Web app financeiro</p>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1680px] px-3 pb-[var(--mobile-nav-space)] pt-3 md:px-5 md:pb-5">
          <PwaInstallPrompt />
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
