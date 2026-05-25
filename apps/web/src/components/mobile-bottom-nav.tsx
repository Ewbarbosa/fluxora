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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-[color:var(--app-panel-strong)]/95 px-3 pb-[calc(var(--safe-area-bottom)+0.75rem)] pt-3 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-[1.75rem] border border-white/70 bg-[color:var(--app-panel)]/90 p-2 shadow-[0_20px_40px_rgba(15,23,32,0.14)]">
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-medium transition",
                active
                  ? "bg-[color:var(--app-ink)] text-white shadow-[0_12px_30px_rgba(15,23,32,0.22)]"
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
          className="size-11 rounded-2xl border border-black/5 bg-white/70 text-foreground shadow-none"
          onClick={() => setOpenMobile(true)}
        >
          <PanelLeftOpenIcon className="size-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </div>
    </nav>
  )
}
