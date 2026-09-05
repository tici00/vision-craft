import { createServerFn } from "@tanstack/react-start";

/**
 * Server boundary for the real processing pipeline.
 *
 * Execution lives entirely on the backend: `startProcessing` kicks a job off and
 * the scheduled hook (`/api/public/hooks/process-jobs`) keeps advancing it, so
 * the browser only creates the job and polls its persisted state.
 */

export const startProcessing = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) => {
    const jobId = input?.jobId?.trim();
    if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("jobId inválido.");
    return { jobId };
  })
  .handler(async ({ data }) => {
    const { runJob } = await import("@/services/processing/runner.server");
    const result = await runJob(data.jobId);
    return {
      jobId: result.jobId,
      claimed: result.claimed,
      steps: result.steps,
      reason: result.reason,
      snapshot: result.snapshot,
    };
  });

/**
 * Kept as an explicit "retry now" escape hatch: it runs a bounded backend run
 * for a single job. It is NOT used to drive normal progress.
 */
export const advanceProcessing = startProcessing;

export const getProcessingCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  const { getCapabilities } = await import("@/services/processing/pipeline.server");
  return getCapabilities();
});


export const getClipPlaybackUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { storagePath: string }) => ({ storagePath: input.storagePath }))
  .handler(async ({ data }) => {
    const { createSignedClipUrl } = await import("@/services/processing/media.server");
    return { url: await createSignedClipUrl(data.storagePath) };
  });
