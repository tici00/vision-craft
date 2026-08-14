import { Link, useRouterState } from "@tanstack/react-router";
import { Film, LayoutGrid, PlusCircle, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Projects", icon: LayoutGrid, exact: true },
  { to: "/projects/new", label: "New project", icon: PlusCircle, exact: false },
] as const;

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Film className="size-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">AI Video Editor</p>
            <p className="truncate text-[11px] text-muted-foreground">Long-form editing suite</p>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon
                className={cn("size-[18px] shrink-0", active && "text-primary")}
                strokeWidth={2}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-sidebar-border bg-surface-raised/60 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                !status
                  ? "bg-muted-foreground/50"
                  : status.level === "ok"
                    ? "bg-success"
                    : status.level === "degraded"
                      ? "bg-warning"
                      : "bg-destructive",
              )}
            />
            <Sparkles className="size-3.5 text-primary" />
            Processing backend
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {status ? `${status.title}. ${status.detail}` : "Verificando serviços de análise e renderização…"}
          </p>
        </div>
      )}


      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn("w-full text-muted-foreground", collapsed && "px-0")}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
