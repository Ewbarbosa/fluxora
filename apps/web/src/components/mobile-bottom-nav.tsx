"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  LandmarkIcon,
  PanelLeftOpenIcon,
  Settings2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const items = [
  {
    label: "Visão geral",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    match: (pathname: string) => pathname.startsWith("/dashboard"),
  },
  {
    label: "Financeiro",
    href: "/finance/transactions",
    icon: LandmarkIcon,
    match: (pathname: string) => pathname.startsWith("/finance"),
  },
  {
    label: "Configs",
    href: "/settings/workspace",
    icon: Settings2Icon,
    match: (pathname: string) => pathname.startsWith("/settings"),
  },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[var(--mobile-nav-offset)] z-40 px-3 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-[1.4rem] border border-[color:var(--app-accent-border)] bg-[color:var(--app-panel-strong)]/94 p-2 shadow-[0_18px_36px_rgba(15,23,32,0.12)] backdrop-blur-lg">
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-medium transition",
                active
                  ? "bg-[color:var(--app-accent-strong)] text-white shadow-[0_14px_28px_rgba(0,138,103,0.24)]"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] text-foreground shadow-none"
          onClick={() => setOpenMobile(true)}
        >
          <PanelLeftOpenIcon className="size-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </div>
    </nav>
  )
}
