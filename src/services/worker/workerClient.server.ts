/**
 * Centralised communication layer between Vision Craft and the external media
 * worker (ffmpeg service).
 *
 * Everything worker-related lives here: base URL, authentication, request and
 * response handling, timeouts, retries for cold starts and typed errors. No UI
 * component, route or other service issues HTTP calls to the worker directly.
 *
 * Nothing in this module simulates work: when the worker is unreachable or
 * returns an error, a `WorkerError` is thrown so the job records an honest
 * failure instead of a fake success.
 */

import type {
  AudioChunk,
  ExtractAudioParams,
  RenderClipResult,
  RenderClipsParams,
  WorkerHealth,
} from "./types";

export type {
  AudioChunk,
  ExtractAudioParams,
  RenderClipRequest,
  RenderClipResult,
  RenderClipsParams,
  WorkerHealth,
} from "./types";

export interface WorkerConfig {
  url: string;
  token: string | null;
}

export class WorkerError extends Error {
  status: number;
  path: string;

  constructor(status: number, path: string, message: string) {
    super(message);
    this.name = "WorkerError";
    this.status = status;
    this.path = path;
  }
}

/** Audio chunk length requested from the worker (technical detail, invisible to users). */
export const AUDIO_CHUNK_SECONDS = 600;

/** Clips rendered per worker call, so long jobs progress incrementally. */
export const RENDER_BATCH_SIZE = 4;

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 90 * 1000;
/** Retries only cover cold starts / transient gateway errors, never real failures. */
const COLD_START_RETRIES = 3;
const COLD_START_STATUSES = new Set([429, 502, 503, 504, 0]);

export const WORKER_SETUP_MESSAGE =
  "O serviço de mídia (ffmpeg) não está configurado. Defina VIDEO_WORKER_URL (e VIDEO_WORKER_TOKEN, " +
  "se o serviço exigir autenticação) para que o processamento real de áudio e vídeo possa ser executado.";

export function getWorkerConfig(): WorkerConfig | null {
  const url = process.env["VIDEO_WORKER_URL"];
  if (!url) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token: process.env["VIDEO_WORKER_TOKEN"] ?? null,
  };
}

export function isWorkerConfigured(): boolean {
  return Boolean(getWorkerConfig());
}

function requireConfig(): WorkerConfig {
  const config = getWorkerConfig();
  if (!config) throw new WorkerError(0, "", WORKER_SETUP_MESSAGE);
  return config;
}

function friendlyMessage(status: number, path: string, body: string): string {
  const detail = body.trim().slice(0, 400);
  switch (status) {
    case 401:
    case 403:
      return `O serviço de mídia recusou a autenticação em ${path}. Verifique se VIDEO_WORKER_TOKEN é igual ao token configurado no serviço.`;
    case 404:
      return `O serviço de mídia não expõe ${path}. Atualize o worker para a versão que implementa esse endpoint.`;
    case 413:
      return `O serviço de mídia rejeitou a requisição em ${path} por tamanho excessivo. Reduza o tamanho do lote.`;
    default:
      return `O serviço de mídia respondeu ${status} em ${path}${detail ? `: ${detail}` : "."}`;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  timeoutMs?: number;
  retries?: number;
}

/** Single entry point for every worker HTTP call. */
export async function workerRequest<T>(
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const config = requireConfig();
  const method = options.method ?? (body === undefined ? "GET" : "POST");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = (options.retries ?? COLD_START_RETRIES) + 1;

  let lastError: WorkerError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${config.url}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        const error = new WorkerError(
          response.status,
          path,
          friendlyMessage(response.status, path, text),
        );
        if (COLD_START_STATUSES.has(response.status) && attempt < maxAttempts) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
          continue;
        }
        throw error;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new WorkerError(
          response.status,
          path,
          `Resposta inválida do serviço de mídia em ${path}.`,
        );
      }
    } catch (error) {
      if (error instanceof WorkerError) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      const networkError = new WorkerError(
        0,
        path,
        aborted
          ? `O serviço de mídia não respondeu em ${Math.round(timeoutMs / 1000)}s em ${path}.`
          : `Não foi possível alcançar o serviço de mídia em ${path}: ${
              error instanceof Error ? error.message : "erro de rede"
            }`,
      );
      if (attempt < maxAttempts && !aborted) {
        lastError = networkError;
        await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        continue;
      }
      throw networkError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new WorkerError(0, path, `Falha ao chamar o serviço de mídia em ${path}.`);
}

/** Real availability check — the pipeline only advances after this succeeds. */
export async function checkWorkerHealth(): Promise<WorkerHealth> {
  const payload = await workerRequest<{
    ok?: boolean;
    service?: string;
    ffmpeg?: string;
    timestamp?: string;
  }>("/health", undefined, { timeoutMs: HEALTH_TIMEOUT_MS, retries: 2 });

  if (!payload.ok) {
    throw new WorkerError(502, "/health", "O serviço de mídia respondeu que não está saudável.");
  }
  if (!payload.ffmpeg) {
    throw new WorkerError(
      502,
      "/health",
      "O serviço de mídia respondeu sem ffmpeg disponível; o processamento real não pode ser executado.",
    );
  }
  return {
    ok: true,
    service: payload.service ?? null,
    ffmpeg: payload.ffmpeg,
    timestamp: payload.timestamp ?? null,
  };
}

interface WorkerAudioResponse {
  ok?: boolean;
  error?: string;
  durationSeconds?: number | null;
  chunks?: {
    index?: number;
    startSeconds?: number;
    durationSeconds?: number | null;
    downloadUrl?: string;
    url?: string;
    format?: string;
  }[];
}

export interface ExtractAudioResult {
  chunks: AudioChunk[];
  durationSeconds: number | null;
}

/**
 * Extracts and splits the audio track of a source of any length. Chunking is a
 * technical decision inside the worker layer: a 4h recording is still one video.
 */
export async function extractAudio(params: ExtractAudioParams): Promise<ExtractAudioResult> {
  const payload = await workerRequest<WorkerAudioResponse>("/extract-audio", {
    jobId: params.jobId,
    projectId: params.projectId,
    sourceUrl: params.sourceUrl,
    chunkSeconds: params.chunkSeconds ?? AUDIO_CHUNK_SECONDS,
    outputFormat: params.outputFormat ?? "mp3",
  });

  if (payload.ok === false) {
    throw new WorkerError(502, "/extract-audio", payload.error ?? "Falha ao extrair o áudio.");
  }

  const chunks = (payload.chunks ?? [])
    .map((chunk, position) => ({
      index: chunk.index ?? position,
      startSeconds: Number(chunk.startSeconds ?? 0),
      durationSeconds: chunk.durationSeconds == null ? null : Number(chunk.durationSeconds),
      downloadUrl: chunk.downloadUrl ?? chunk.url ?? "",
      format: chunk.format ?? "mp3",
    }))
    .filter((chunk) => chunk.downloadUrl.length > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  if (chunks.length === 0) {
    throw new WorkerError(
      502,
      "/extract-audio",
      payload.error ?? "O serviço de mídia não retornou nenhum trecho de áudio utilizável.",
    );
  }

  return {
    chunks,
    durationSeconds: payload.durationSeconds == null ? null : Number(payload.durationSeconds),
  };
}

interface WorkerRenderResponse {
  ok?: boolean;
  error?: string;
  clips?: {
    id?: string;
    storagePath?: string | null;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
    thumbnailPath?: string | null;
    error?: string | null;
  }[];
}

/** Cuts real clip files with ffmpeg and uploads them to the signed destinations. */
export async function renderClips(params: RenderClipsParams): Promise<RenderClipResult[]> {
  const payload = await workerRequest<WorkerRenderResponse>("/render-clips", {
    jobId: params.jobId,
    projectId: params.projectId,
    sourceUrl: params.sourceUrl,
    bucket: params.bucket,
    clips: params.clips,
  });

  if (payload.ok === false) {
    throw new WorkerError(502, "/render-clips", payload.error ?? "Falha ao renderizar os cortes.");
  }
  if (!payload.clips?.length) {
    throw new WorkerError(
      502,
      "/render-clips",
      payload.error ?? "O serviço de mídia não retornou nenhum corte renderizado.",
    );
  }

  return payload.clips.map((clip, position) => ({
    id: clip.id ?? params.clips[position]?.id ?? "",
    storagePath: clip.storagePath ?? null,
    sizeBytes: clip.sizeBytes == null ? null : Number(clip.sizeBytes),
    durationSeconds: clip.durationSeconds == null ? null : Number(clip.durationSeconds),
    thumbnailPath: clip.thumbnailPath ?? null,
    error: clip.error ?? null,
  }));
}
