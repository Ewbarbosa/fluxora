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
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-[1.9rem] border border-white/80 bg-[color:var(--app-panel-strong)]/92 p-2 shadow-[0_24px_48px_rgba(15,23,32,0.16)] backdrop-blur-xl">
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
                  ? "bg-[color:var(--app-ink)] text-white shadow-[0_14px_28px_rgba(15,23,32,0.2)]"
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
          className="size-11 rounded-2xl border border-black/5 bg-white/80 text-foreground shadow-none"
          onClick={() => setOpenMobile(true)}
        >
          <PanelLeftOpenIcon className="size-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </div>
    </nav>
  )
}
