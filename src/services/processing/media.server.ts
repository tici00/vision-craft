/**
 * Storage access for the processing pipeline.
 *
 * This module only deals with Supabase Storage (signed download/upload URLs and
 * object metadata) plus the inline-payload helper used when the AI model reads
 * a media file directly. All communication with the external media worker lives
 * in `@/services/worker/workerClient.server`.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SOURCE_BUCKET = "source-videos";
export const CLIPS_BUCKET = "generated-clips";

/** Inline multimodal payload ceiling used only when the media worker is offline. */
export const DIRECT_MEDIA_LIMIT_BYTES = 18 * 1024 * 1024;

export type { AudioChunk } from "@/services/worker/types";

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
    throw new Error(
      "Este arquivo é grande demais para ser analisado diretamente. O serviço de mídia (ffmpeg) precisa estar acessível para extrair o áudio.",
    );
  }
  return { data: toBase64(buffer), format, bytes: buffer.byteLength };
}
