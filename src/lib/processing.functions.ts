import { createServerFn } from "@tanstack/react-start";

/**
 * Server boundary for the real processing pipeline. The client drives the job
 * forward one stage per call; all work (transcription, moment selection,
 * rendering) happens on the server and is persisted on the job record.
 */

export const advanceProcessing = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string }) => {
    if (!input?.jobId) throw new Error("jobId é obrigatório.");
    return { jobId: input.jobId };
  })
  .handler(async ({ data }) => {
    const { advanceJob } = await import("@/services/processing/pipeline.server");
    return advanceJob(data.jobId);
  });

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
