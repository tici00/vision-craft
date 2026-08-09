import { Scissors, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import type { VideoSegment } from "@/types/video-editor";

/** Compact kept/cut ribbon visualisation across the full source duration. */
export function TimelineRibbon({
  segments,
  totalDuration,
  className,
}: {
  segments: VideoSegment[];
  totalDuration: number;
  className?: string;
}) {
  if (!totalDuration || totalDuration <= 0) return null;
  return (
    <div
      className={cn(
        "relative h-10 w-full overflow-hidden rounded-lg border border-border bg-cut/40",
        className,
      )}
      role="img"
      aria-label="Timeline of kept and cut regions"
    >
      {segments.map((segment) => (
        <div
          key={segment.id}
          title={`${formatTimecode(segment.startSeconds)} – ${formatTimecode(segment.endSeconds)} · ${segment.decision}`}
          className={cn(
            "absolute inset-y-0",
            segment.decision === "keep" ? "bg-keep/80" : "bg-transparent",
          )}
          style={{
            left: `${(segment.startSeconds / totalDuration) * 100}%`,
            width: `${Math.max((segment.durationSeconds / totalDuration) * 100, 0.3)}%`,
          }}
        />
      ))}
    </div>
  );
}

export function SegmentTimeline({
  segments,
  totalDuration,
  onDecisionChange,
}: {
  segments: VideoSegment[];
  totalDuration: number | null;
  onDecisionChange?: (segmentId: string, decision: "keep" | "cut") => void;
}) {
  if (segments.length === 0) {
    return (
      <EmptyState
        icon={<Scissors className="size-5" />}
        title="No segments yet"
        description="The timeline is built during analysis. Once a processing worker completes the analysis step, segments with scores and reasons appear here for review."
      />
    );
  }

  return (
    <div className="space-y-5">
      {totalDuration != null && (
        <TimelineRibbon segments={segments} totalDuration={totalDuration} />
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {segments.map((segment) => (
          <li
            key={segment.id}
            className="flex flex-wrap items-center gap-4 bg-surface/60 p-4 transition-colors hover:bg-surface-raised/60"
          >
            <div className="text-timecode w-40 shrink-0 text-xs text-muted-foreground">
              {formatTimecode(segment.startSeconds)} → {formatTimecode(segment.endSeconds)}
              <span className="ml-2 text-foreground">
                {formatTimecode(segment.durationSeconds)}
              </span>
            </div>

            <div className="min-w-[200px] flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium",
                    segment.decision === "keep"
                      ? "bg-success/10 text-success"
                      : segment.decision === "cut"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {segment.decision === "undecided" ? "Needs review" : segment.decision}
                </span>
                {segment.category && (
                  <span className="text-[11px] text-muted-foreground">{segment.category}</span>
                )}
                {segment.score != null && (
                  <span className="text-timecode inline-flex items-center gap-1 text-[11px] text-primary">
                    <Sparkles className="size-3" />
                    {Math.round(segment.score * 100)}
                  </span>
                )}
              </div>
              {segment.reason && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {segment.reason}
                </p>
              )}
            </div>

            {onDecisionChange && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant={segment.decision === "keep" ? "default" : "outline"}
                  onClick={() => onDecisionChange(segment.id, "keep")}
                >
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant={segment.decision === "cut" ? "secondary" : "outline"}
                  onClick={() => onDecisionChange(segment.id, "cut")}
                >
                  Cut
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
