import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Option } from "@/lib/analysis-options";

/** A titled card used by the "Configurar análise" step. */
export function ConfigSection({
  step,
  title,
  description,
  icon,
  aside,
  children,
  className,
}: {
  step?: number;
  title: string;
  description?: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-6 lg:p-7", className)}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              {icon}
            </span>
          )}
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              {step != null && (
                <span className="text-timecode text-xs text-muted-foreground">
                  {String(step).padStart(2, "0")}
                </span>
              )}
              {title}
            </h2>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {aside}
      </header>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

/** Pill list used for both single and multiple selection. */
export function OptionChips<T extends string>({
  options,
  selected,
  onSelect,
  multiple,
  columns,
}: {
  options: Option<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  multiple?: boolean;
  columns?: boolean;
}) {
  return (
    <div className={cn(columns ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2")}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(option.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <span className="block">{option.label}</span>
            {option.description && (
              <span
                className={cn(
                  "mt-0.5 block text-[11px] font-normal leading-snug",
                  active ? "text-primary/80" : "text-muted-foreground/80",
                )}
              >
                {option.description}
              </span>
            )}
          </button>
        );
      })}
      {multiple === false && null}
    </div>
  );
}

export function SummaryLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}
