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
 *
 * Authentication: the worker validates the `x-worker-token` header. The token
 * is read from the `VIDEO_WORKER_TOKEN` environment secret at call time and is
 * never logged, persisted or exposed to the browser.
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

/** Auth headers for the worker. The token value never leaves this module. */
function authHeaders(config: WorkerConfig): Record<string, string> {
  return config.token ? { "x-worker-token": config.token } : {};
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

/** Worker media URLs may come back as http://; upgrade them for browser/edge use. */
function normalizeWorkerUrl(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown-host";
  }
}

/**
 * Structured, secret-free diagnostics for a failed transfer. Never includes
 * tokens, headers, signed URLs or query strings — only host, path and metrics.
 */
function logTransferFailure(fields: Record<string, unknown>): void {
  console.error(`[worker-transfer-failure] ${JSON.stringify(fields)}`);
}

function errorShape(error: unknown): Record<string, unknown> {
  const err = error as { name?: string; message?: string; cause?: unknown } | null;
  const cause = err?.cause as { code?: string; name?: string; message?: string } | undefined;
  return {
    errorName: err?.name ?? "unknown",
    errorMessage: err?.message ?? "unknown",
    ...(cause
      ? { causeCode: cause.code ?? null, causeName: cause.name ?? null }
      : { causeCode: null }),
  };
}

interface RequestOptions {
  method?: "GET" | "POST";
  timeoutMs?: number;
  retries?: number;
  /** Streaming multipart body (used for the video uploads). */
  body?: BodyInit;
  contentType?: string;
  /** Secret-free context added to failure diagnostics. */
  diagnostics?: Record<string, unknown>;
  /** Returns how many payload bytes were streamed so far (upload progress). */
  bytesSent?: () => number;
}


/** Single entry point for every worker HTTP call. */
export async function workerRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = requireConfig();
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const streaming = options.body instanceof ReadableStream;
  // A streamed body cannot be replayed, so retries only apply to buffered calls.
  const maxAttempts = streaming ? 1 : (options.retries ?? COLD_START_RETRIES) + 1;

  let lastError: WorkerError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.url}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          ...(options.contentType ? { "Content-Type": options.contentType } : {}),
          ...authHeaders(config),
        },
        ...(options.body === undefined ? {} : { body: options.body }),
        signal: controller.signal,
        // Required by the runtime when the request body is a stream.
        ...(streaming ? ({ duplex: "half" } as Record<string, unknown>) : {}),
      } as RequestInit);

      const text = await response.text();

      if (!response.ok) {
        const error = new WorkerError(
          response.status,
          path,
          friendlyMessage(response.status, path, text),
        );
        logTransferFailure({
          path,
          host: safeHost(config.url),
          attempt,
          elapsedMs: Date.now() - startedAt,
          httpStatus: response.status,
          bytesSent: options.bytesSent?.() ?? null,
          ...(options.diagnostics ?? {}),
        });
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
      const elapsedMs = Date.now() - startedAt;
      const sent = options.bytesSent?.() ?? null;
      logTransferFailure({
        path,
        host: safeHost(config.url),
        attempt,
        elapsedMs,
        httpStatus: null,
        bytesSent: sent,
        streamedBody: streaming,
        aborted,
        ...errorShape(error),
        ...(options.diagnostics ?? {}),
      });
      const transferNote =
        sent != null
          ? ` Transferidos ${Math.round(sent / 1_000_000)} MB em ${Math.round(elapsedMs / 1000)}s antes da queda.`
          : "";
      const networkError = new WorkerError(
        0,
        path,
        aborted
          ? `O serviço de mídia não respondeu em ${Math.round(timeoutMs / 1000)}s em ${path}.${transferNote}`
          : `Não foi possível alcançar o serviço de mídia em ${path}: ${
              error instanceof Error ? error.message : "erro de rede"
            }.${transferNote}`,
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

/* --------------------------------------------------- streaming multipart body */

interface MultipartFile {
  field: string;
  fileName: string;
  contentType: string;
  stream: ReadableStream<Uint8Array>;
}

/**
 * Builds a streamed multipart/form-data body. The source video is piped from
 * storage straight to the worker, so multi-hour files are never fully buffered
 * in memory.
 */
function multipartStream(
  fields: Record<string, string>,
  file: MultipartFile,
): {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  /** Payload bytes handed to the outgoing request so far. */
  bytesSent: () => number;
  /** Set when the storage read (not the worker) is what broke. */
  sourceError: () => unknown;
} {
  const boundary = `----visioncraft${crypto.randomUUID().replace(/-/g, "")}`;
  const encoder = new TextEncoder();
  let sent = 0;
  let sourceError: unknown = null;

  let head = "";
  for (const [name, value] of Object.entries(fields)) {
    head += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  head +=
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${file.field}"; filename="${file.fileName}"\r\n` +
    `Content-Type: ${file.contentType}\r\n\r\n`;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(head));
      const reader = file.stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            sent += value.byteLength;
            controller.enqueue(value);
          }
        }
      } catch (error) {
        // The storage download died mid-transfer: record it so the failure is
        // attributed to storage instead of the media service.
        sourceError = error;
        logTransferFailure({
          path: "storage-read",
          host: "storage",
          bytesSent: sent,
          ...errorShape(error),
        });
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }
      controller.enqueue(encoder.encode(`\r\n--${boundary}--\r\n`));
      controller.close();
    },
  });

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    bytesSent: () => sent,
    sourceError: () => sourceError,
  };
}

async function openSourceStream(
  sourceUrl: string,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  sizeBytes: number | null;
}> {
  let response: Response;
  try {
    response = await fetch(sourceUrl);
  } catch (error) {
    logTransferFailure({ path: "storage-open", host: safeHost(sourceUrl), ...errorShape(error) });
    throw new WorkerError(
      0,
      "storage",
      "Não foi possível iniciar a leitura do vídeo de origem no armazenamento.",
    );
  }
  if (!response.ok || !response.body) {
    throw new WorkerError(
      response.status || 0,
      "storage",
      `Não foi possível ler o vídeo de origem para enviar ao serviço de mídia (${response.status}).`,
    );
  }
  const length = Number(response.headers.get("content-length") ?? "");
  return {
    stream: response.body as ReadableStream<Uint8Array>,
    contentType: response.headers.get("content-type") ?? "video/mp4",
    sizeBytes: Number.isFinite(length) && length > 0 ? length : null,
  };
}


/* ----------------------------------------------------------------- endpoints */

/** Real availability check — the pipeline only advances after this succeeds. */
export async function checkWorkerHealth(): Promise<WorkerHealth> {
  const payload = await workerRequest<{
    ok?: boolean;
    service?: string;
    ffmpeg?: string;
    timestamp?: string;
  }>("/health", { timeoutMs: HEALTH_TIMEOUT_MS, retries: 2 });

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

export interface ExtractAudioResult {
  chunks: AudioChunk[];
  durationSeconds: number | null;
}

/**
 * Extracts the audio track of a source of any length. The video is streamed to
 * the worker, which returns a single audio file placed at second 0 of the
 * source timeline.
 */
export async function extractAudio(params: ExtractAudioParams): Promise<ExtractAudioResult> {
  const source = await openSourceStream(params.sourceUrl);
  const { body, contentType, bytesSent, sourceError } = multipartStream(
    {},
    {
      field: "video",
      fileName: params.fileName ?? "source.mp4",
      contentType: params.contentType ?? source.contentType,
      stream: source.stream,
    },
  );

  let payload: {
    ok?: boolean;
    error?: string;
    audioId?: string;
    audioUrl?: string;
    durationSeconds?: number | null;
  };
  try {
    payload = await workerRequest("/extract-audio", {
      body,
      contentType,
      bytesSent,
      diagnostics: { stage: "extract-audio", sourceSizeBytes: source.sizeBytes },
    });
  } catch (error) {
    // Attribute the failure honestly: a broken storage download is not a worker fault.
    if (sourceError()) {
      throw new WorkerError(
        0,
        "storage",
        `A leitura do vídeo de origem no armazenamento foi interrompida após ${Math.round(
          bytesSent() / 1_000_000,
        )} MB, antes de o serviço de mídia poder concluir a extração.`,
      );
    }
    throw error;
  }

  if (payload.ok === false || !payload.audioUrl) {
    throw new WorkerError(502, "/extract-audio", payload.error ?? "Falha ao extrair o áudio.");
  }


  return {
    chunks: [
      {
        index: 0,
        startSeconds: 0,
        durationSeconds: payload.durationSeconds ?? null,
        downloadUrl: normalizeWorkerUrl(payload.audioUrl),
        format: payload.audioUrl.split(".").pop()?.toLowerCase() ?? "mp3",
      },
    ],
    durationSeconds: payload.durationSeconds ?? null,
  };
}

/**
 * Renders a batch of clips. The worker returns one file per requested range, in
 * the same order; Vision Craft then copies each file into storage.
 */
export async function renderClips(params: RenderClipsParams): Promise<RenderClipResult[]> {
  if (params.clips.length === 0) return [];

  const source = await openSourceStream(params.sourceUrl);
  const { body, contentType } = multipartStream(
    {
      clips: JSON.stringify(
        params.clips.map((clip) => ({
          id: clip.id,
          start: Number(clip.startSeconds.toFixed(3)),
          end: Number(clip.endSeconds.toFixed(3)),
        })),
      ),
    },
    {
      field: "video",
      fileName: params.fileName ?? "source.mp4",
      contentType: params.contentType ?? source.contentType,
      stream: source.stream,
    },
  );

  const payload = await workerRequest<{
    ok?: boolean;
    error?: string;
    clips?: { id?: string; start?: number; end?: number; url?: string; error?: string }[];
  }>("/render-clips", { body, contentType });

  if (payload.ok === false) {
    throw new WorkerError(502, "/render-clips", payload.error ?? "Falha ao renderizar os cortes.");
  }

  const returned = payload.clips ?? [];
  return params.clips.map((clip, index) => {
    const result = returned[index];
    return {
      id: clip.id,
      downloadUrl: result?.url ? normalizeWorkerUrl(result.url) : null,
      startSeconds: result?.start ?? clip.startSeconds,
      endSeconds: result?.end ?? clip.endSeconds,
      error: result?.error ?? (result?.url ? null : "O serviço de mídia não retornou o arquivo."),
    };
  });
}
