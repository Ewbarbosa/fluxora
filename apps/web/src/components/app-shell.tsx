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
      <SidebarInset className="min-h-svh bg-transparent">
        <header className="sticky top-0 z-30 flex h-[4.5rem] shrink-0 items-center gap-2 border-b border-white/60 bg-[color:var(--app-panel)]/80 backdrop-blur-xl">
          <div className="flex w-full items-center gap-2 px-4 pb-2 pt-[max(0.75rem,var(--safe-area-top))] md:pt-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
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
        <div className="px-3 pb-[var(--mobile-nav-space)] pt-3 md:px-0 md:pb-0">
          <PwaInstallPrompt />
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
