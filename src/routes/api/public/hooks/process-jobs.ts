import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled hook that keeps processing jobs moving on the backend.
 *
 * Called by the database scheduler (pg_cron) every minute. It is the reason a
 * job survives the browser tab being closed: the sweep claims queued jobs and
 * jobs whose runner lease went stale, then advances them.
 *
 * Auth: the caller must present the private worker token. The token lives only
 * in server env and is never returned in a response.
 */
export const Route = createFileRoute("/api/public/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["VIDEO_WORKER_TOKEN"];
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
        try {
          const results = await sweepJobs();
          return Response.json({
            ok: true,
            picked: results.length,
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
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
