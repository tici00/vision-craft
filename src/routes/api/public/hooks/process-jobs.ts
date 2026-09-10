import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled hook that keeps processing jobs moving on the backend.
 *
 * Called by the database scheduler (pg_cron/pg_net) every minute. It is the
 * reason a job survives the browser tab being closed: the sweep claims queued
 * jobs and jobs whose runner lease went stale, then advances them.
 *
 * IMPORTANT (why the work is awaited): on the edge runtime an invocation only
 * stays alive while its response is pending. Answering 202 first and continuing
 * "in the background" looked fine (the scheduler got 202) but the delegated work
 * was dropped right after the response, so jobs stalled mid-chunk with no
 * heartbeat and no error. The sweep is therefore awaited inside the request,
 * with a wall-clock budget below pg_net's 55s timeout; each stage persists its
 * own result, so the next minute's run resumes exactly where this one stopped.
 *
 * Auth: the caller must present the private worker token. The token lives only
 * in server env and is never returned in a response.
 */
export const Route = createFileRoute("/api/public/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env["RUNNER_CRON_TOKEN"] ?? process.env["VIDEO_WORKER_TOKEN"] ?? "";

        if (!expected) {
          return Response.json({ error: "Runner token não configurado." }, { status: 500 });
        }
        const provided =
          request.headers.get("x-runner-token") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== expected) {
          return Response.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { sweepJobs } = await import("@/services/processing/runner.server");

        // Optional smaller budget for manual probing; defaults to the runner's.
        const budgetParam = Number(new URL(request.url).searchParams.get("budgetMs"));
        const budgetMs =
          Number.isFinite(budgetParam) && budgetParam > 0 ? Math.min(budgetParam, 50_000) : undefined;

        const startedAt = Date.now();
        try {
          const results = await sweepJobs(budgetMs);
          return Response.json({
            ok: true,
            picked: results.length,
            elapsedMs: Date.now() - startedAt,
            jobs: results.map((result) => ({
              jobId: result.jobId,
              claimed: result.claimed,
              steps: result.steps,
              reason: result.reason,
              stage: result.snapshot?.stage ?? null,
              status: result.snapshot?.status ?? null,
              progress: result.snapshot?.progress ?? null,
            })),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha inesperada no runner.";
          console.error("[process-jobs]", message);
          return Response.json(
            { ok: false, error: message, elapsedMs: Date.now() - startedAt },
            { status: 500 },
          );
        }
      },
    },
  },
});
