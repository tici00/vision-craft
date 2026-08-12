import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Info, Loader2, ServerCog, XCircle } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { JobStatusBadge } from "@/components/projects/StatusBadge";
import { ProcessingSteps } from "@/components/processing/ProcessingSteps";
import { projectQueries } from "@/services/queries";
import { videoProcessingService } from "@/services/videoProcessingService";
import { advanceProcessing, getProcessingCapabilities } from "@/lib/processing.functions";
import { formatElapsed, formatPercent, formatTimecode } from "@/lib/format";
import { ANALYSIS_STAGE_LABEL, PROCESSING_STEP_TEMPLATE } from "@/types/video-editor";


export const Route = createFileRoute("/projects/$projectId/processing")({
  head: () => ({
    meta: [
      { title: "Processing — AI Video Editor" },
      {
        name: "description",
        content: "Follow the detailed processing progress of an AI video editing job.",
      },
      { property: "og:title", content: "Processing — AI Video Editor" },
      {
        property: "og:description",
        content: "Detailed job progress, steps and cancellation for a video editing job.",
      },
    ],
  }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [, forceTick] = useState(0);

  const project = useQuery(projectQueries.detail(projectId));
  const job = useQuery({
    ...projectQueries.latestJob(projectId),
    refetchInterval: 4000,
  });

  const active = job.data?.status === "queued" || job.data?.status === "running";

  const capabilities = useQuery({
    queryKey: ["processing", "capabilities"] as const,
    queryFn: () => getProcessingCapabilities(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => forceTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  /**
   * Drives the real pipeline: each call executes one server-side stage and
   * persists what actually happened. No progress is simulated here.
   */
  const advancing = useRef(false);
  useEffect(() => {
    const jobId = job.data?.id;
    if (!jobId || !active || job.data?.cancelRequested) return;
    if (advancing.current) return;
    advancing.current = true;
    void advanceProcessing({ data: { jobId } })
      .then(() => {
        void job.refetch();
        void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => {
        advancing.current = false;
      });
  }, [job.data?.id, job.data?.stage, job.data?.status, active, job.data?.cancelRequested]);


  useEffect(() => {
    if (job.data?.status === "completed") {
      void navigate({ to: "/projects/$projectId/results", params: { projectId } });
    }
  }, [job.data?.status, navigate, projectId]);

  const cancel = useMutation({
    mutationFn: (jobId: string) => videoProcessingService.cancelJob(jobId),
    onSuccess: () => {
      toast.success("Processing cancelled");
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      void job.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const steps = job.data?.steps?.length ? job.data.steps : PROCESSING_STEP_TEMPLATE;

  return (
    <>
      <TopBar
        title={project.data?.name ?? "Processing"}
        subtitle="Processing job"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/projects/$projectId" params={{ projectId }}>
                Project detail
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/">Back to projects</Link>
            </Button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1280px] px-6 py-10 lg:px-10">
        {job.isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : !job.data ? (
          <EmptyState
            icon={<ServerCog className="size-5" />}
            title="No processing job yet"
            description="Configure the outputs you want, then queue a job to see detailed progress here."
            action={
              <Button asChild>
                <Link to="/projects/$projectId/configure" params={{ projectId }}>
                  Open configuration
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <section className="panel p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {job.data.status === "queued"
                          ? "Waiting in queue"
                          : job.data.status === "running"
                            ? (job.data.currentStep ?? "Processing")
                            : job.data.status === "cancelled"
                              ? "Processing cancelled"
                              : job.data.status === "error"
                                ? "Processing failed"
                                : "Processing complete"}
                      </h1>
                      <JobStatusBadge status={job.data.status} />
                    </div>
                    <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                      You can leave this page — the job keeps its state in the database and this view
                      updates from the job record.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-timecode text-4xl font-semibold text-foreground">
                      {formatPercent(job.data.progress)}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Overall
                    </p>
                  </div>
                </div>

                <Progress value={job.data.progress} className="mt-6" />

                <div className="mt-6 grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
                  <Metric
                    label="Elapsed"
                    value={formatElapsed(
                      job.data.startedAt ?? job.data.queuedAt,
                      job.data.finishedAt,
                    )}
                  />
                  <Metric
                    label="ETA"
                    value={
                      job.data.estimatedSecondsRemaining != null
                        ? formatTimecode(job.data.estimatedSecondsRemaining)
                        : "Not available"
                    }
                    hint={
                      job.data.estimatedSecondsRemaining == null
                        ? "Shown once the worker reports an estimate"
                        : undefined
                    }
                  />
                  <Metric label="Current step" value={job.data.currentStep ?? "—"} />
                </div>

                {job.data.errorMessage && (
                  <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {job.data.errorMessage}
                  </p>
                )}

                {active && (
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(job.data!.id)}
                    >
                      {cancel.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Cancel processing
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Cancellation is recorded on the job so the worker stops at its next checkpoint.
                    </span>
                  </div>
                )}
              </section>

              <section className="panel p-8">
                <h2 className="text-sm font-semibold text-foreground">Pipeline steps</h2>
                <div className="mt-4">
                  <ProcessingSteps steps={steps} />
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <div className="panel p-6">
                <h2 className="text-sm font-semibold text-foreground">Job</h2>
                <dl className="mt-4 space-y-3 text-xs">
                  <Row label="Job ID" value={job.data.id.slice(0, 8)} />
                  <Row label="Queued" value={new Date(job.data.queuedAt).toLocaleString()} />
                  <Row
                    label="Started"
                    value={
                      job.data.startedAt ? new Date(job.data.startedAt).toLocaleString() : "Not yet"
                    }
                  />
                  <Row
                    label="Cancel requested"
                    value={job.data.cancelRequested ? "Yes" : "No"}
                  />
                </dl>
              </div>

              <div className="rounded-xl border border-info/30 bg-info/8 p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-info">
                  <Info className="size-4" />
                  {capabilities.data?.workerHealthy
                    ? "Serviço de mídia conectado"
                    : capabilities.data?.mediaWorkerConfigured
                      ? "Serviço de mídia indisponível"
                      : "Serviço de mídia não configurado"}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {job.data.stageMessage ?? ANALYSIS_STAGE_LABEL[job.data.stage]}
                </p>
                {!capabilities.data?.workerHealthy && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {capabilities.data?.renderWorkerSetupMessage}
                  </p>
                )}
              </div>



              <div className="panel p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  Keep working
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Jobs run asynchronously. Return to the dashboard and open other projects while this
                  one waits.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-timecode mt-1.5 text-base text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-timecode max-w-[60%] truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
