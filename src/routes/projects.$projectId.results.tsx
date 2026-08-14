import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clapperboard,
  Download,
  Film,
  Loader2,
  Play,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { TimelineRibbon } from "@/components/timeline/SegmentTimeline";
import { projectQueries } from "@/services/queries";
import { intelligenceQueries } from "@/services/intelligence/intelligenceService";
import { ClipIntelligenceCard } from "@/components/intelligence/ClipIntelligenceCard";
import { CreatorIntelligencePanel } from "@/components/intelligence/CreatorIntelligencePanel";
import { videoProcessingService, NotImplementedError } from "@/services/videoProcessingService";
import { seedDemoResults } from "@/services/demo/demoResults";
import { formatDurationLabel, formatPercent, formatTimecode } from "@/lib/format";
import type { GeneratedVideo, ShortClip, VideoSegment } from "@/types/video-editor";

export const Route = createFileRoute("/projects/$projectId/results")({
  head: () => ({
    meta: [
      { title: "Results — AI Video Editor" },
      {
        name: "description",
        content: "Review generated short clips, the highlights video and the edited long version.",
      },
      { property: "og:title", content: "Results — AI Video Editor" },
      {
        property: "og:description",
        content: "Clips, highlights and long edit outputs for a video project.",
      },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();

  const analysis = useQuery(projectQueries.analysis(projectId));
  const clips = useQuery(projectQueries.clips(projectId));
  const highlights = useQuery(projectQueries.highlights(projectId));
  const longEdit = useQuery(projectQueries.longEdit(projectId));
  const intelligence = useQuery(intelligenceQueries.project(projectId));

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["project", projectId] });

  const seedDemo = useMutation({
    mutationFn: async () => {
      const data = analysis.data;
      if (!data) throw new Error("Project not loaded");
      await seedDemoResults(data.project, data.configuration);
    },
    onSuccess: () => {
      toast.success("Demo results loaded (placeholder data, not AI output)");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportResult = useMutation({
    mutationFn: (params: { resultId: string; kind: "clip" | "highlights" | "long_edit" }) =>
      videoProcessingService.exportResult({ projectId, ...params }),
    onError: (error: Error) =>
      toast.error(
        error instanceof NotImplementedError
          ? "Export becomes available when the render worker is connected."
          : error.message,
      ),
  });

  const loading = analysis.isLoading || clips.isLoading;

  return (
    <>
      <TopBar
        title={analysis.data?.project.name ?? "Results"}
        subtitle="Generated outputs"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/projects/$projectId" params={{ projectId }}>
                Project detail
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={seedDemo.isPending || !analysis.data}
              onClick={() => seedDemo.mutate()}
            >
              {seedDemo.isPending && <Loader2 className="size-4 animate-spin" />}
              Load demo results
            </Button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Results</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Outputs appear here once a processing worker writes them. “Load demo results” inserts
              clearly labelled placeholder rows so the review UI can be evaluated — it performs no
              analysis.
            </p>
          </div>
        </div>

        <Tabs defaultValue="clips">
          <TabsList>
            <TabsTrigger value="clips">
              Clips {clips.data?.length ? `(${clips.data.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="intelligence">
              Intelligence{" "}
              {intelligence.data?.candidates.length ? `(${intelligence.data.candidates.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="highlights">Highlights</TabsTrigger>
            <TabsTrigger value="long">Edited long video</TabsTrigger>
          </TabsList>

          <TabsContent value="clips" className="mt-8">
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-64 rounded-2xl" />
                ))}
              </div>
            ) : (clips.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Scissors className="size-5" />}
                title="No clips yet"
                description="Short clips appear here after the analysis and clip-generation steps complete."
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {clips.data?.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onKeepToggle={async () => {
                      await videoProcessingService.setClipKept(clip.id, !clip.kept);
                      invalidate();
                    }}
                    onDelete={async () => {
                      await videoProcessingService.deleteClip(clip.id);
                      toast.success("Clip deleted");
                      invalidate();
                    }}
                    onExport={() => exportResult.mutate({ resultId: clip.id, kind: "clip" })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="intelligence" className="mt-8 space-y-8">
            {intelligence.isLoading ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : (
              <>
                {intelligence.data && (
                  <CreatorIntelligencePanel creator={intelligence.data.creator} />
                )}
                {(intelligence.data?.candidates.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="size-5" />}
                    title="Nenhuma avaliação ainda"
                    description="As notas da Clip Intelligence aparecem aqui depois que a análise real avalia os momentos da gravação."
                  />
                ) : (
                  <div className="grid gap-6 xl:grid-cols-2">
                    {intelligence.data?.candidates.map((entry) => (
                      <ClipIntelligenceCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="highlights" className="mt-8">
            {highlights.isLoading ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : !highlights.data ? (
              <EmptyState
                icon={<Sparkles className="size-5" />}
                title="No highlights video yet"
                description="Once the highlights render completes, its final duration and the segments it uses appear here."
              />
            ) : (
              <section className="panel p-8">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Highlights video</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {highlights.data.segmentIds.length} segments used
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!highlights.data.videoUrl}>
                      <Play className="size-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        exportResult.mutate({ resultId: highlights.data!.id, kind: "highlights" })
                      }
                    >
                      <Download className="size-4" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="mt-8 grid gap-6 sm:grid-cols-3">
                  <Metric
                    label="Final duration"
                    value={formatDurationLabel(highlights.data.finalDurationSeconds)}
                  />
                  <Metric
                    label="Original duration"
                    value={formatDurationLabel(highlights.data.originalDurationSeconds)}
                  />
                  <Metric label="Segments" value={String(highlights.data.segmentIds.length)} />
                </div>
                <p className="mt-8 text-xs text-muted-foreground">
                  Reordering segments, adding or removing them and exporting become available with
                  the render worker.
                </p>
              </section>
            )}
          </TabsContent>

          <TabsContent value="long" className="mt-8">
            {longEdit.isLoading ? (
              <Skeleton className="h-72 rounded-2xl" />
            ) : !longEdit.data ? (
              <EmptyState
                icon={<Film className="size-5" />}
                title="No edited long video yet"
                description="The tightened long edit, its removed time and the kept/cut timeline appear here after rendering."
              />
            ) : (
              <LongEditPanel
                video={longEdit.data}
                segments={analysis.data?.segments ?? []}
                onExport={() =>
                  exportResult.mutate({ resultId: longEdit.data!.id, kind: "long_edit" })
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function LongEditPanel({
  video,
  segments,
  onExport,
}: {
  video: GeneratedVideo;
  segments: VideoSegment[];
  onExport: () => void;
}) {
  const original = video.originalDurationSeconds ?? 0;
  const removed = video.removedSeconds ?? 0;
  return (
    <section className="panel p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Edited long video</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Low-value sections removed, context preserved.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Original" value={formatDurationLabel(original)} />
        <Metric label="Final" value={formatDurationLabel(video.finalDurationSeconds)} />
        <Metric label="Removed" value={formatDurationLabel(removed)} />
        <Metric label="Cuts" value={String(video.cutsCount ?? 0)} />
        <Metric
          label="Removed share"
          value={original ? `≈ ${formatPercent((removed / original) * 100)}` : "—"}
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-keep" /> Kept
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-cut" /> Cut
          </span>
        </div>
        <TimelineRibbon segments={segments} totalDuration={original} />
      </div>
    </section>
  );
}

function ClipCard({
  clip,
  onKeepToggle,
  onDelete,
  onExport,
}: {
  clip: ShortClip;
  onKeepToggle: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <article className="panel hover-lift overflow-hidden">
      <div className="relative aspect-video border-b border-border bg-surface-raised">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Clapperboard className="size-6 opacity-50" />
          </div>
        )}
        <span className="text-timecode absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 text-[11px]">
          {formatTimecode(clip.durationSeconds)}
        </span>
        {!clip.kept && (
          <span className="absolute left-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground">
            Discarded
          </span>
        )}
      </div>

      <div className="space-y-3 p-5">
        <div>
          <h3 className="truncate text-sm font-semibold text-foreground">{clip.title}</h3>
          <p className="text-timecode mt-1 text-[11px] text-muted-foreground">
            from {formatTimecode(clip.sourceStartSeconds)}
            {clip.category ? ` · ${clip.category}` : ""}
          </p>
        </div>

        {clip.confidence != null && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Relevance</span>
              <span className="text-timecode text-primary">
                {Math.round(clip.confidence * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, clip.confidence * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" disabled={!clip.videoUrl}>
            <Play className="size-4" />
            Preview
          </Button>
          <Button variant={clip.kept ? "secondary" : "default"} size="sm" onClick={onKeepToggle}>
            {clip.kept ? "Discard" : "Keep"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onExport}>
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-timecode mt-1.5 text-lg text-foreground">{value}</p>
    </div>
  );
}
