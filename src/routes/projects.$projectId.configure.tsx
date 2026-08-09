import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Film, Loader2, Scissors, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDurationLabel } from "@/lib/format";
import { projectQueries } from "@/services/queries";
import { videoProcessingService } from "@/services/videoProcessingService";
import type { EditIntensity } from "@/types/video-editor";

export const Route = createFileRoute("/projects/$projectId/configure")({
  head: () => ({
    meta: [
      { title: "Edit configuration — AI Video Editor" },
      {
        name: "description",
        content:
          "Choose the outputs for this project: short clips, a highlights video or a tightened long edit.",
      },
      { property: "og:title", content: "Edit configuration — AI Video Editor" },
      {
        property: "og:description",
        content: "Choose short clips, highlights or a tightened long edit for your recording.",
      },
    ],
  }),
  component: ConfigurePage,
});

const INTENSITIES: { value: EditIntensity; label: string; description: string }[] = [
  {
    value: "conservative",
    label: "Conservative",
    description: "Removes only clear dead air and obvious filler.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Trims low-value stretches while keeping full context.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Keeps only the strongest material; shortest result.",
  },
];

function ConfigurePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const project = useQuery(projectQueries.detail(projectId));
  const existing = useQuery(projectQueries.configuration(projectId));

  const [shortClips, setShortClips] = useState(true);
  const [highlights, setHighlights] = useState(false);
  const [longEdit, setLongEdit] = useState(false);
  const [highlightPreset, setHighlightPreset] = useState<"600" | "900" | "custom">("600");
  const [customMinutes, setCustomMinutes] = useState(20);
  const [intensity, setIntensity] = useState<EditIntensity>("balanced");

  useEffect(() => {
    const config = existing.data;
    if (!config) return;
    setShortClips(config.wantShortClips);
    setHighlights(config.wantHighlights);
    setLongEdit(config.wantLongEdit);
    if (config.longEditIntensity) setIntensity(config.longEditIntensity);
    if (config.highlightsTargetSeconds === 600) setHighlightPreset("600");
    else if (config.highlightsTargetSeconds === 900) setHighlightPreset("900");
    else if (config.highlightsTargetSeconds) {
      setHighlightPreset("custom");
      setCustomMinutes(Math.round(config.highlightsTargetSeconds / 60));
    }
  }, [existing.data]);

  const highlightsSeconds =
    highlightPreset === "custom" ? Math.max(1, customMinutes) * 60 : Number(highlightPreset);

  const selectedCount = [shortClips, highlights, longEdit].filter(Boolean).length;

  const startProcessing = useMutation({
    mutationFn: async () => {
      await videoProcessingService.saveConfiguration({
        projectId,
        wantShortClips: shortClips,
        wantHighlights: highlights,
        wantLongEdit: longEdit,
        highlightsTargetSeconds: highlights ? highlightsSeconds : null,
        longEditIntensity: longEdit ? intensity : null,
      });
      return videoProcessingService.createProcessingJob(projectId);
    },
    onSuccess: () => {
      toast.success("Job queued");
      void navigate({ to: "/projects/$projectId/processing", params: { projectId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveDraft = useMutation({
    mutationFn: () =>
      videoProcessingService.saveConfiguration({
        projectId,
        wantShortClips: shortClips,
        wantHighlights: highlights,
        wantLongEdit: longEdit,
        highlightsTargetSeconds: highlights ? highlightsSeconds : null,
        longEditIntensity: longEdit ? intensity : null,
      }),
    onSuccess: () => toast.success("Configuration saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <TopBar
        title={project.data?.name ?? "Edit configuration"}
        subtitle="Step 2 of 2 · Output goals"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedCount === 0 || saveDraft.isPending}
              onClick={() => saveDraft.mutate()}
            >
              Save configuration
            </Button>
            <Button
              size="sm"
              disabled={selectedCount === 0 || startProcessing.isPending}
              onClick={() => startProcessing.mutate()}
            >
              {startProcessing.isPending && <Loader2 className="size-4 animate-spin" />}
              Queue processing
            </Button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1280px] px-6 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          What should we produce?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pick one or more outputs. Each goal becomes part of the processing job for{" "}
          <span className="text-foreground">
            {project.isLoading ? "this project" : (project.data?.sourceFileName ?? "this project")}
          </span>
          {project.data?.durationSeconds != null && (
            <> · {formatDurationLabel(project.data.durationSeconds)}</>
          )}
          .
        </p>

        {existing.isLoading ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <GoalCard
              icon={<Scissors className="size-5" />}
              title="Short clips"
              description="Standalone vertical-ready moments cut from the strongest parts of the recording."
              selected={shortClips}
              onToggle={() => setShortClips((value) => !value)}
            />

            <GoalCard
              icon={<Sparkles className="size-5" />}
              title="Highlights video"
              description="One condensed cut of the best moments at a target duration."
              selected={highlights}
              onToggle={() => setHighlights((value) => !value)}
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["600", "900", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setHighlights(true);
                        setHighlightPreset(preset);
                      }}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        highlightPreset === preset
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-border-strong",
                      )}
                    >
                      {preset === "600" ? "10 min" : preset === "900" ? "15 min" : "Custom"}
                    </button>
                  ))}
                </div>
                {highlightPreset === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-minutes" className="text-xs">
                      Custom duration (minutes)
                    </Label>
                    <Input
                      id="custom-minutes"
                      type="number"
                      min={1}
                      max={240}
                      value={customMinutes}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setCustomMinutes(Number(event.target.value))}
                    />
                  </div>
                )}
              </div>
            </GoalCard>

            <GoalCard
              icon={<Film className="size-5" />}
              title="Long edited video"
              description="The full recording with low-value sections removed and context preserved."
              selected={longEdit}
              onToggle={() => setLongEdit((value) => !value)}
            >
              <div className="space-y-2">
                {INTENSITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setLongEdit(true);
                      setIntensity(option.value);
                    }}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                      intensity === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-xs font-semibold",
                        intensity === option.value ? "text-primary" : "text-foreground",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </GoalCard>
          </div>
        )}

        <section className="panel mt-10 p-6">
          <div className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Processing summary</h2>
          </div>
          {selectedCount === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Select at least one output to queue processing.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {shortClips && <SummaryRow>Short clips from the highest-scoring moments</SummaryRow>}
              {highlights && (
                <SummaryRow>
                  Highlights video targeting {formatDurationLabel(highlightsSeconds)}
                </SummaryRow>
              )}
              {longEdit && (
                <SummaryRow>
                  Long edited video · {INTENSITIES.find((i) => i.value === intensity)?.label}{" "}
                  removal
                </SummaryRow>
              )}
              <li className="pt-2 text-xs text-muted-foreground/80">
                {selectedCount} output{selectedCount > 1 ? "s" : ""} will be produced by a single
                processing job. Analysis and rendering workers are not connected yet, so the job
                waits in the queue after it is created.
              </li>
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function SummaryRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-success" />
      <span className="text-foreground">{children}</span>
    </li>
  );
}

function GoalCard({
  icon,
  title,
  description,
  selected,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "panel hover-lift flex cursor-pointer flex-col gap-4 p-6 text-left",
        selected && "border-primary/60 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children && <div className="mt-auto pt-1">{children}</div>}
    </div>
  );
}
