"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, ChevronDown, LogOut } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav";
import { Logo, LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function Sidebar({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const initial = (userName || userEmail || "?").charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {collapsed ? <LogoMark className="h-7 w-7" /> : <Logo />}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-secondary hover:text-foreground"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed ? <p className="micro-label px-2 pb-1.5">{group.label}</p> : null}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const content = (
                  <span
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "border-l-primary bg-accent-soft font-medium text-primary"
                        : "text-text-muted hover:bg-secondary hover:text-foreground",
                      !item.enabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    {!collapsed && !item.enabled ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto shrink-0 border-none bg-secondary px-1.5 py-0 text-[10px] text-text-faint"
                      >
                        Em breve
                      </Badge>
                    ) : null}
                  </span>
                );

                return item.enabled ? (
                  <Link key={item.href} href={item.href}>
                    {content}
                  </Link>
                ) : (
                  <span key={item.href} aria-disabled="true">
                    {content}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left hover:bg-secondary",
                  collapsed && "justify-center",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-primary">
                  {initial}
                </span>
                {!collapsed ? (
                  <>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {userName || "Minha conta"}
                      </span>
                      <span className="truncate text-xs text-text-muted">{userEmail}</span>
                    </span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-text-faint" />
                  </>
                ) : null}
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem render={<Link href="/configuracoes">Configurações</Link>} />
            <DropdownMenuItem onClick={() => signOut()} variant="destructive">
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
