import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function TopBar({ title, subtitle, actions }: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-md lg:px-10">
      <div className="min-w-0 flex-1 py-3">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions ?? (
          <Button asChild size="sm">
            <Link to="/projects/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
