"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, LayoutDashboard, LogOut, Menu, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { CardWithAlerts } from "@/lib/kanban/alerts"
import { AlertsPanel } from "@/components/alerts/alerts-panel"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV_ITEMS = [
  { href: "/", label: "Board", icon: LayoutDashboard },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
]

// Nav lives on the dark sidebar surface on both desktop (rail) and mobile
// (drawer), so it always reads off the sidebar-* tokens, never the page's.
function NavLinks({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && label}
          </Link>
        )
      })}
    </nav>
  )
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1",
        collapsed && "justify-center px-0"
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
        K
      </div>
      {!collapsed && (
        <span className="font-heading text-sm font-bold text-sidebar-foreground">
          Kanban Aluguel
        </span>
      )}
    </div>
  )
}

const sidebarGhostButton =
  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

function useLogout() {
  const router = useRouter()

  return React.useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }, [router])
}

function LogoutIconButton({ collapsed }: { collapsed?: boolean }) {
  const logout = useLogout()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={sidebarGhostButton}
      onClick={logout}
      aria-label="Sair"
      title={collapsed ? "Sair" : undefined}
    >
      <LogOut className="size-4" />
    </Button>
  )
}

function LogoutRow() {
  const logout = useLogout()

  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <LogOut className="size-4 shrink-0" />
      Sair
    </button>
  )
}

export function AppShell({
  children,
  alertCards,
  todayISO,
}: {
  children: React.ReactNode
  alertCards: CardWithAlerts[]
  todayISO: string
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  const [lastPathname, setLastPathname] = React.useState(pathname)

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  return (
    // h-screen (not min-h-screen) so the shell has a *definite* height:
    // the board's columns size themselves against it and scroll internally
    // instead of stretching the whole page.
    <div className="flex h-screen w-full overflow-hidden">
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:bg-sidebar md:transition-[width] md:duration-200",
          collapsed ? "md:w-16" : "md:w-56"
        )}
      >
        <div className="flex items-center py-3">
          <Logo collapsed={collapsed} />
        </div>
        <Separator className="bg-sidebar-border" />
        <div className="flex-1 py-3">
          <NavLinks collapsed={collapsed} />
        </div>
        <Separator className="bg-sidebar-border" />
        <div
          className={cn(
            "flex items-center gap-1 p-2",
            collapsed ? "flex-col" : "justify-between"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className={sidebarGhostButton}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <Menu className="size-4" />
          </Button>
          <AlertsPanel
            cards={alertCards}
            todayISO={todayISO}
            triggerClassName={sidebarGhostButton}
          />
          <LogoutIconButton collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 bg-sidebar px-3 py-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={sidebarGhostButton}
                  aria-label="Abrir menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border">
                <SheetTitle className="font-heading text-sidebar-foreground">
                  Kanban Aluguel
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-1 flex-col justify-between py-3">
                <NavLinks />
                <div>
                  <Separator className="mb-3 bg-sidebar-border" />
                  <div className="px-2">
                    <LogoutRow />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Logo />
          <div className="ml-auto">
            <AlertsPanel
              cards={alertCards}
              todayISO={todayISO}
              triggerClassName={sidebarGhostButton}
            />
          </div>
        </header>

        {/* min-h-0 lets this shrink below its content so long pages scroll
            here instead of pushing the layout past the viewport. */}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
