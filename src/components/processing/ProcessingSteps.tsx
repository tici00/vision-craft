import { Check, Circle, Loader2, MinusCircle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProcessingStep } from "@/types/video-editor";

export function ProcessingSteps({ steps }: { steps: ProcessingStep[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((step) => (
        <li
          key={step.key}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
            step.status === "running" ? "bg-primary/8 text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="grid size-5 shrink-0 place-items-center">
            {step.status === "done" ? (
              <Check className="size-4 text-success" />
            ) : step.status === "running" ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : step.status === "error" ? (
              <XCircle className="size-4 text-destructive" />
            ) : step.status === "skipped" ? (
              <MinusCircle className="size-4" />
            ) : (
              <Circle className="size-3.5 opacity-40" />
            )}
          </span>
          <span className={cn(step.status === "done" && "text-foreground")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
