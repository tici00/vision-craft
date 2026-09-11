import { supabaseAdmin } from "@/integrations/supabase/client.server";

export {
  WorkerError,
  RENDER_BATCH_SIZE,
  WORKER_SETUP_MESSAGE,
  getWorkerConfig,
  isWorkerConfigured,
  workerRequest,
  checkWorkerHealth,
  extractAudio,
} from "./workerClient.transport.server";

export type {
  AudioChunk,
  ExtractAudioParams,
  ExtractAudioResult,
  RenderClipRequest,
  RenderClipResult,
  RenderClipsParams,
  WorkerHealth,
  WorkerConfig,
} from "./workerClient.transport.server";

import {
  WorkerError,
  workerRequest,
  type RenderClipResult,
  type RenderClipsParams,
} from "./workerClient.transport.server";

interface RenderJobStatus {
  ok?: boolean;
  job?: {
    id?: string;
    status?: "queued" | "downloading" | "rendering" | "completed" | "partial" | "failed";
    progress?: number;
    error?: string | null;
    clips?: {
      id?: string;
      start?: number;
      end?: number;
      url?: string;
      error?: string | null;
    }[];
  };
}

interface StoredRenderJob {
  workerJobId: string;
  clipIds: string[];
  createdAt: string;
}

type WorkerPayload = Record<string, unknown> & {
  renderJobs?: Record<string, StoredRenderJob>;
};

function normalizeWorkerUrl(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

function mapRenderPayload(
  params: RenderClipsParams,
  payload: RenderJobStatus,
): RenderClipResult[] {
  const returned = payload.job?.clips ?? [];
  return params.clips.map((clip, index) => {
    const byId = returned.find((entry) => entry.id === clip.id);
    const result = byId ?? returned[index];
    return {
      id: clip.id,
      downloadUrl: result?.url ? normalizeWorkerUrl(result.url) : null,
      startSeconds: result?.start ?? clip.startSeconds,
      endSeconds: result?.end ?? clip.endSeconds,
      error: result?.error ?? (result?.url ? null : "O serviço de mídia ainda não retornou o arquivo."),
    };
  });
}

async function getRenderJob(jobId: string): Promise<RenderJobStatus> {
  return workerRequest<RenderJobStatus>(`/render-jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    timeoutMs: 90 * 1000,
    retries: 2,
    diagnostics: {
      stage: "render-job-status",
      jobId,
    },
  });
}

async function createRenderJob(params: RenderClipsParams): Promise<{ jobId: string }> {
  const payload = await workerRequest<{
    ok?: boolean;
    jobId?: string;
    status?: string;
    error?: string;
  }>("/render-jobs", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({
      videoUrl: params.sourceUrl,
      clips: params.clips.map((clip) => ({
        id: clip.id,
        start: Number(clip.startSeconds.toFixed(3)),
        end: Number(clip.endSeconds.toFixed(3)),
      })),
    }),
    diagnostics: {
      stage: "render-job-create",
      clipCount: params.clips.length,
    },
  });

  if (!payload.jobId) {
    throw new WorkerError(
      502,
      "/render-jobs",
      payload.error ?? "O serviço de mídia não retornou um jobId.",
    );
  }

  return { jobId: payload.jobId };
}

async function loadRenderJobMapping(
  clipIds: string[],
): Promise<{
  processingJobId: string;
  payload: WorkerPayload;
  mapping: StoredRenderJob | null;
}> {
  const firstClipId = clipIds[0];
  const { data: clip, error: clipError } = await supabaseAdmin
    .from("short_clips")
    .select("job_id")
    .eq("id", firstClipId)
    .maybeSingle();
  if (clipError) throw new Error(clipError.message);
  if (!clip?.job_id) {
    throw new Error("Não foi possível localizar o job de processamento do corte.");
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, worker_payload")
    .eq("id", clip.job_id)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Job de processamento não encontrado.");

  const payload = (
    job.worker_payload && typeof job.worker_payload === "object"
      ? job.worker_payload
      : {}
  ) as WorkerPayload;
  const batchKey = clipIds.join("|");

  return {
    processingJobId: job.id,
    payload,
    mapping: payload.renderJobs?.[batchKey] ?? null,
  };
}

async function persistRenderJobMapping(
  processingJobId: string,
  payload: WorkerPayload,
  clipIds: string[],
  workerJobId: string,
): Promise<void> {
  const renderJobs = {
    ...(payload.renderJobs ?? {}),
    [clipIds.join("|")]: {
      workerJobId,
      clipIds,
      createdAt: new Date().toISOString(),
    },
  };

  const { error } = await supabaseAdmin
    .from("processing_jobs")
    .update({
      worker_payload: {
        ...payload,
        renderJobs,
      } as unknown as Record<string, unknown>,
      worker_stage: "rendering",
      worker_last_sync_at: new Date().toISOString(),
    })
    .eq("id", processingJobId);
  if (error) throw new Error(error.message);
}

async function removeRenderJobMapping(
  processingJobId: string,
  payload: WorkerPayload,
  clipIds: string[],
): Promise<void> {
  const renderJobs = { ...(payload.renderJobs ?? {}) };
  delete renderJobs[clipIds.join("|")];
  await supabaseAdmin
    .from("processing_jobs")
    .update({
      worker_payload: {
        ...payload,
        renderJobs,
      } as unknown as Record<string, unknown>,
      worker_last_sync_at: new Date().toISOString(),
    })
    .eq("id", processingJobId);
}

/**
 * The processing runner has a short execution budget, while FFmpeg render jobs
 * can take minutes. When the worker is still rendering, return control to the
 * runner without counting another render attempt. The persisted worker job id
 * lets the next sweep resume the same worker job instead of creating a duplicate.
 */
async function releaseActiveBatch(
  clipIds: string[],
  message: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("short_clips")
    .select("id, render_attempts")
    .in("id", clipIds);
  if (error) throw new Error(error.message);

  const { data: clips, error: loadError } = await supabaseAdmin
    .from("short_clips")
    .select("id, render_attempts")
    .in("id", clipIds);
  if (loadError) throw new Error(loadError.message);

  for (const clip of clips ?? []) {
    const currentAttempts = Number(clip.render_attempts ?? 0);
    await supabaseAdmin
      .from("short_clips")
      .update({
        render_status: "pending",
        render_attempts: Math.max(0, currentAttempts - 1),
        render_error: message,
      })
      .eq("id", clip.id);
  }
}

/**
 * Creates a worker job once, persists its id, and then polls only for the
 * current state. It never waits for FFmpeg to finish inside the Vision Craft
 * request. Completed results are returned to the existing pipeline, while an
 * active job is handed back to the scheduler for the next sweep.
 */
export async function renderClips(
  params: RenderClipsParams,
): Promise<RenderClipResult[]> {
  if (params.clips.length === 0) return [];

  const clipIds = params.clips.map((clip) => clip.id);
  const { processingJobId, payload, mapping } = await loadRenderJobMapping(clipIds);

  let workerJobId = mapping?.workerJobId ?? null;
  let result: RenderJobStatus;

  if (workerJobId) {
    try {
      result = await getRenderJob(workerJobId);
    } catch (error) {
      if (!(error instanceof WorkerError) || error.status !== 404) throw error;
      workerJobId = null;
      await removeRenderJobMapping(processingJobId, payload, clipIds);
      result = { ok: true };
    }
  } else {
    result = { ok: true };
  }

  if (!workerJobId) {
    const created = await createRenderJob(params);
    workerJobId = created.jobId;
    await persistRenderJobMapping(processingJobId, payload, clipIds, workerJobId);
    await releaseActiveBatch(
      clipIds,
      "Lote enviado ao serviço de mídia; aguardando a conclusão do FFmpeg.",
    );
    return params.clips.map((clip) => ({
      id: clip.id,
      downloadUrl: null,
      startSeconds: clip.startSeconds,
      endSeconds: clip.endSeconds,
      error: "Lote enviado ao serviço de mídia e continuará em segundo plano.",
    }));
  }

  const job = result.job;
  if (!job) {
    throw new WorkerError(
      502,
      `/render-jobs/${workerJobId}`,
      "O serviço de mídia não retornou os dados do job.",
    );
  }

  if (job.status === "queued" || job.status === "downloading" || job.status === "rendering") {
    await releaseActiveBatch(
      clipIds,
      `Serviço de mídia em ${job.status}; a renderização continuará em segundo plano.`,
    );
    return params.clips.map((clip) => ({
      id: clip.id,
      downloadUrl: null,
      startSeconds: clip.startSeconds,
      endSeconds: clip.endSeconds,
      error: `Serviço de mídia em ${job.status}; aguardando a próxima verificação.`,
    }));
  }

  if (job.status === "failed") {
    await removeRenderJobMapping(processingJobId, payload, clipIds);
    return mapRenderPayload(params, result);
  }

  return mapRenderPayload(params, result);
}
