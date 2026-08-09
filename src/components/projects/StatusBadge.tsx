import { PROJECT_STATUS_LABEL, type JobStatus, type ProjectStatus } from "@/types/video-editor";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "border-border-strong bg-muted text-muted-foreground",
  ready: "border-info/30 bg-info/10 text-info",
  queued: "border-info/30 bg-info/10 text-info",
  processing: "border-primary/30 bg-primary/10 text-primary",
  analyzing: "border-primary/30 bg-primary/10 text-primary",
  generating_clips: "border-primary/30 bg-primary/10 text-primary",
  rendering: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-success/30 bg-success/10 text-success",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

const ACTIVE: ProjectStatus[] = ["processing", "analyzing", "generating_clips", "rendering"];

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          ACTIVE.includes(status) && "animate-pulse",
        )}
      />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

const JOB_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
  error: "Error",
};

const JOB_STYLE: Record<JobStatus, string> = {
  queued: "border-info/30 bg-info/10 text-info",
  running: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-success/30 bg-success/10 text-success",
  cancelled: "border-border-strong bg-muted text-muted-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        JOB_STYLE[status],
      )}
    >
      {JOB_LABEL[status]}
    </span>
  );
}
