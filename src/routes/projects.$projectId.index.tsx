import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Loader2, PlayCircle, Settings2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { SegmentTimeline } from "@/components/timeline/SegmentTimeline";
import { EmptyState } from "@/components/common/EmptyState";
import { projectQueries } from "@/services/queries";
import { videoProcessingService } from "@/services/videoProcessingService";
import { formatDate, formatDurationLabel, formatFileSize, formatPercent } from "@/lib/format";
import { PROCESSING_TYPE_LABEL } from "@/types/video-editor";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project detail — AI Video Editor" },
      {
        name: "description",
        content:
          "Review a project's source video, configuration, processing stats and reviewable segment timeline.",
      },
      { property: "og:title", content: "Project detail — AI Video Editor" },
      {
        property: "og:description",
        content: "Source preview, configuration, stats and segment timeline for a video project.",
      },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();

  const analysis = useQuery(projectQueries.analysis(projectId));
  const project = analysis.data?.project;
  const playback = useQuery(projectQueries.playbackUrl(project));

  const setDecision = useMutation({
    mutationFn: ({ segmentId, decision }: { segmentId: string; decision: "keep" | "cut" }) =>
      videoProcessingService.setSegmentDecision(segmentId, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId, "analysis"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const queueJob = useMutation({
    mutationFn: () => videoProcessingService.createProcessingJob(projectId),
    onSuccess: () => {
      toast.success("Job queued");
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (analysis.isLoading) {
    return (
      <>
        <TopBar title="Loading project…" actions={<span />} />
        <main className="mx-auto w-full max-w-[1680px] space-y-8 px-6 py-10 lg:px-10">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </main>
      </>
    );
  }

  if (analysis.isError || !project) {
    return (
      <>
        <TopBar title="Project" actions={<span />} />
        <main className="mx-auto w-full max-w-[900px] px-6 py-20">
          <EmptyState
            icon={<TriangleAlert className="size-5" />}
            title="Couldn't load this project"
            description={
              (analysis.error as Error | null)?.message ?? "The project may have been deleted."
            }
            action={
              <Button asChild variant="outline">
                <Link to="/">Back to projects</Link>
              </Button>
            }
          />
        </main>
      </>
    );
  }

  const config = analysis.data?.configuration;
  const segments = analysis.data?.segments ?? [];
  const keptSeconds = segments
    .filter((segment) => segment.decision === "keep")
    .reduce((sum, segment) => sum + segment.durationSeconds, 0);

  return (
    <>
      <TopBar
        title={
          <span className="flex items-center gap-3">
            {project.name}
            <StatusBadge status={project.status} />
          </span>
        }
        subtitle={project.sourceFileName ?? "No source video"}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/projects/$projectId/configure" params={{ projectId }}>
                <Settings2 className="size-4" />
                Configuration
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/projects/$projectId/results" params={{ projectId }}>
                Results
              </Link>
            </Button>
            <Button
              size="sm"
              disabled={queueJob.isPending || !config}
              onClick={() => queueJob.mutate()}
            >
              {queueJob.isPending && <Loader2 className="size-4 animate-spin" />}
              Queue processing
            </Button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="panel overflow-hidden">
              <div className="aspect-video w-full bg-black">
                {playback.isLoading ? (
                  <Skeleton className="size-full rounded-none" />
                ) : playback.data ? (
                  <video src={playback.data} controls className="size-full" />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <div className="text-center">
                      <PlayCircle className="mx-auto size-8 opacity-50" />
                      <p className="mt-3 text-sm">No source video attached</p>
                    </div>
                  </div>
                )}
              </div>
              <dl className="grid gap-6 border-t border-border p-6 sm:grid-cols-4">
                <Meta label="Duration" value={formatDurationLabel(project.durationSeconds)} />
                <Meta label="File size" value={formatFileSize(project.sourceFileSize)} />
                <Meta label="Format" value={project.sourceMimeType ?? "—"} />
                <Meta label="Created" value={formatDate(project.createdAt)} />
              </dl>
            </section>

            <section className="panel p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Segment timeline</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every segment carries a start, end, duration, decision, score, reason and
                    category — ready for manual review and future AI explanations.
                  </p>
                </div>
                {segments.length > 0 && (
                  <p className="text-timecode text-xs text-muted-foreground">
                    {segments.length} segments · {formatDurationLabel(keptSeconds)} kept
                  </p>
                )}
              </div>
              <div className="mt-6">
                <SegmentTimeline
                  segments={segments}
                  totalDuration={project.durationSeconds}
                  onDecisionChange={(segmentId, decision) =>
                    setDecision.mutate({ segmentId, decision })
                  }
                />
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="panel p-6">
              <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
              {!config ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">No outputs configured yet.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/projects/$projectId/configure" params={{ projectId }}>
                      Configure outputs
                    </Link>
                  </Button>
                </div>
              ) : (
                <dl className="mt-4 space-y-3 text-xs">
                  <Row
                    label="Outputs"
                    value={
                      project.processingTypes.map((t) => PROCESSING_TYPE_LABEL[t]).join(", ") || "—"
                    }
                  />
                  <Row
                    label="Highlights target"
                    value={
                      config.highlightsTargetSeconds
                        ? formatDurationLabel(config.highlightsTargetSeconds)
                        : "—"
                    }
                  />
                  <Row label="Long edit intensity" value={config.longEditIntensity ?? "—"} />
                </dl>
              )}
            </div>

            <div className="panel p-6">
              <h2 className="text-sm font-semibold text-foreground">Stats</h2>
              <dl className="mt-4 space-y-3 text-xs">
                <Row label="Segments" value={String(segments.length)} />
                <Row label="Kept" value={formatDurationLabel(keptSeconds)} />
                <Row
                  label="Kept share"
                  value={
                    project.durationSeconds
                      ? formatPercent((keptSeconds / project.durationSeconds) * 100)
                      : "—"
                  }
                />
                <Row
                  label="Latest job"
                  value={analysis.data?.latestJob ? analysis.data.latestJob.status : "None"}
                />
              </dl>
              {analysis.data?.latestJob && (
                <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                  <Link to="/projects/$projectId/processing" params={{ projectId }}>
                    View processing
                  </Link>
                </Button>
              )}
            </div>

            <div className="panel p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="size-4 text-primary" />
                Review notes
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Keep/cut decisions you make here are stored on the segment records and will be used
                as review input for the render step.
              </p>
            </div>

            <div className="panel flex items-center gap-3 p-6 text-xs text-muted-foreground">
              <Film className="size-4 shrink-0" />
              Source videos are stored outside the database; only references are persisted.
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="text-timecode mt-1.5 truncate text-sm text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-foreground">{value}</dd>
    </div>
  );
}
