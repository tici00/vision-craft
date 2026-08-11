/**
 * Media access for the processing pipeline.
 *
 * The app runs on an edge runtime, so it cannot run ffmpeg. Two real paths
 * exist and both are honest about their limits:
 *
 * 1. Short sources (under DIRECT_MEDIA_LIMIT_BYTES) are sent to the analysis
 *    model directly — the original file carries its own audio track.
 * 2. Long sources require an external media worker (ffmpeg) that extracts and
 *    splits the audio. When it is not connected the job fails with an explicit
 *    message describing exactly what to configure.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SOURCE_BUCKET = "source-videos";
export const CLIPS_BUCKET = "generated-clips";

/** Inline multimodal payload ceiling; larger sources need the media worker. */
export const DIRECT_MEDIA_LIMIT_BYTES = 18 * 1024 * 1024;

/** Audio chunk length requested from the media worker. */
export const AUDIO_CHUNK_SECONDS = 600;

export interface MediaWorkerConfig {
  url: string;
  token: string | null;
}

export function getMediaWorkerConfig(): MediaWorkerConfig | null {
  const url = process.env["VIDEO_WORKER_URL"];
  if (!url) return null;
  return { url: url.replace(/\/+$/, ""), token: process.env["VIDEO_WORKER_TOKEN"] ?? null };
}

export const MEDIA_WORKER_SETUP_MESSAGE =
  "Para vídeos longos é necessário um serviço externo de mídia com ffmpeg. " +
  "Configure a variável VIDEO_WORKER_URL (e VIDEO_WORKER_TOKEN, se o serviço exigir autenticação) " +
  "apontando para um serviço que exponha POST /extract-audio e POST /render-clips. " +
  "Nada será processado com dados simulados até que esse serviço esteja conectado.";

export const RENDER_WORKER_SETUP_MESSAGE =
  "Os cortes foram identificados com timestamps reais, mas a geração dos arquivos de vídeo exige ffmpeg, " +
  "que não roda no servidor da aplicação. Configure VIDEO_WORKER_URL (e VIDEO_WORKER_TOKEN, se necessário) " +
  "apontando para um serviço com POST /render-clips para gerar os arquivos dos cortes.";

export async function createSignedSourceUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(SOURCE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Não foi possível gerar o acesso ao vídeo de origem.");
  }
  return data.signedUrl;
}

export async function createSignedClipUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(CLIPS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  return data?.signedUrl ?? null;
}

export async function createClipUploadUrl(
  storagePath: string,
): Promise<{ path: string; uploadUrl: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(CLIPS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });
  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível preparar o destino do corte renderizado.");
  }
  return { path: storagePath, uploadUrl: data.signedUrl, token: data.token };
}

export async function getSourceObjectSize(storagePath: string): Promise<number | null> {
  const folder = storagePath.split("/").slice(0, -1).join("/");
  const name = storagePath.split("/").pop();
  const { data } = await supabaseAdmin.storage.from(SOURCE_BUCKET).list(folder, { limit: 100 });
  const match = data?.find((entry) => entry.name === name);
  const size = (match?.metadata as { size?: number } | null | undefined)?.size;
  return typeof size === "number" ? size : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

export interface InlineMedia {
  data: string;
  format: string;
  bytes: number;
}

const FORMAT_BY_EXTENSION: Record<string, string> = {
  mp4: "mp4",
  m4v: "mp4",
  mov: "mov",
  webm: "webm",
  mkv: "mp4",
  mp3: "mp3",
  wav: "wav",
  m4a: "m4a",
  aac: "aac",
  ogg: "ogg",
  flac: "flac",
};

export function formatForFile(fileName: string | null, fallback = "mp4"): string {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return (extension && FORMAT_BY_EXTENSION[extension]) || fallback;
}

/** Downloads a media URL and returns it as an inline base64 payload. */
export async function fetchInlineMedia(url: string, format: string): Promise<InlineMedia> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar a mídia para análise (${response.status}).`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error("O arquivo de mídia está vazio.");
  if (buffer.byteLength > DIRECT_MEDIA_LIMIT_BYTES) {
    throw new Error(MEDIA_WORKER_SETUP_MESSAGE);
  }
  return { data: toBase64(buffer), format, bytes: buffer.byteLength };
}

export interface AudioChunk {
  index: number;
  startSeconds: number;
  durationSeconds: number | null;
  downloadUrl: string;
  format: string;
}

interface WorkerAudioResponse {
  chunks?: {
    index?: number;
    startSeconds?: number;
    durationSeconds?: number | null;
    downloadUrl?: string;
    url?: string;
    format?: string;
  }[];
  error?: string;
}

async function callWorker<T>(path: string, body: unknown): Promise<T> {
  const config = getMediaWorkerConfig();
  if (!config) throw new Error(MEDIA_WORKER_SETUP_MESSAGE);

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `O serviço de mídia respondeu ${response.status} em ${path}: ${text.slice(0, 400)}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida do serviço de mídia em ${path}.`);
  }
}

/** Asks the external media worker to extract and split the audio track. */
export async function requestAudioChunks(params: {
  jobId: string;
  projectId: string;
  sourceUrl: string;
  chunkSeconds?: number;
}): Promise<AudioChunk[]> {
  const payload = await callWorker<WorkerAudioResponse>("/extract-audio", {
    jobId: params.jobId,
    projectId: params.projectId,
    sourceUrl: params.sourceUrl,
    chunkSeconds: params.chunkSeconds ?? AUDIO_CHUNK_SECONDS,
    outputFormat: "mp3",
  });
  const chunks = (payload.chunks ?? [])
    .map((chunk, position) => ({
      index: chunk.index ?? position,
      startSeconds: Number(chunk.startSeconds ?? 0),
      durationSeconds: chunk.durationSeconds == null ? null : Number(chunk.durationSeconds),
      downloadUrl: chunk.downloadUrl ?? chunk.url ?? "",
      format: chunk.format ?? "mp3",
    }))
    .filter((chunk) => chunk.downloadUrl)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  if (chunks.length === 0) {
    throw new Error(
      payload.error ?? "O serviço de mídia não retornou nenhum trecho de áudio utilizável.",
    );
  }
  return chunks;
}

export interface RenderClipRequest {
  id: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  uploadUrl: string;
  storagePath: string;
}

export interface RenderClipResult {
  id: string;
  storagePath: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  error: string | null;
}

interface WorkerRenderResponse {
  clips?: {
    id?: string;
    storagePath?: string | null;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
    thumbnailPath?: string | null;
    error?: string | null;
  }[];
  error?: string;
}

/** Asks the external media worker to cut the real clip files with ffmpeg. */
export async function requestClipRender(params: {
  jobId: string;
  projectId: string;
  sourceUrl: string;
  clips: RenderClipRequest[];
}): Promise<RenderClipResult[]> {
  const payload = await callWorker<WorkerRenderResponse>("/render-clips", {
    jobId: params.jobId,
    projectId: params.projectId,
    sourceUrl: params.sourceUrl,
    bucket: CLIPS_BUCKET,
    clips: params.clips,
  });
  if (!payload.clips?.length) {
    throw new Error(payload.error ?? "O serviço de mídia não retornou nenhum corte renderizado.");
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
