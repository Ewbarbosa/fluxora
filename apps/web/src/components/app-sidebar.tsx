"use client"

import * as React from "react"
import Link from "next/link"
import {
  LayoutDashboardIcon,
  LandmarkIcon,
  OrbitIcon,
  Settings2Icon,
} from "lucide-react"

import { decodeAccessToken, getStoredToken } from "@/lib/auth"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const fallbackUser = {
  name: "Usuário",
  email: "",
  avatar: "",
}

const data = {
  navMain: [
    {
      title: "Visão geral",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Financeiro",
      url: "/finance/transactions",
      icon: <LandmarkIcon />,
      items: [
        { title: "Lançamentos", url: "/finance/transactions" },
        { title: "Categorias", url: "/finance/categories" },
      ],
    },
    {
      title: "Configurações",
      url: "/settings/workspace",
      icon: <Settings2Icon />,
      items: [
        { title: "Plano e limites", url: "/settings/limits" },
        { title: "Workspace", url: "/settings/workspace" },
        { title: "Equipe e acessos", url: "/settings/team" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const user = React.useMemo(() => {
    if (!hydrated) {
      return fallbackUser
    }

    const token = getStoredToken()
    const payload = token ? decodeAccessToken(token) : null

    if (!payload) {
      return fallbackUser
    }

    return {
      name: payload.name || fallbackUser.name,
      email: payload.email || fallbackUser.email,
      avatar: "",
    }
  }, [hydrated])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_12px_24px_rgba(48,180,124,0.22)]">
                <OrbitIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Fluxora</span>
                <span className="truncate text-xs">SaaS financeiro mobile-first</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
