import * as tus from "tus-js-client";

import { supabase } from "@/integrations/supabase/client";
import type { VideoFileMetadata } from "@/services/videoMetadataService";

/**
 * videoUploadService — moves the real file bytes into object storage.
 *
 * Large recordings are uploaded with the resumable (TUS) storage protocol,
 * which chunks the file, retries failed chunks and reports REAL byte progress.
 * A single-request XHR upload is used as a fallback for small files or when the
 * resumable endpoint is unavailable; it also reports real byte progress.
 * No progress value is ever simulated.
 */

export const SOURCE_BUCKET = "source-videos";

/** Chunk size required by the storage resumable endpoint (6 MB). */
const CHUNK_SIZE = 6 * 1024 * 1024;
/** Below this size a single request is faster than a resumable session. */
const RESUMABLE_THRESHOLD = 12 * 1024 * 1024;

const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] as string;
const SUPABASE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;

export type UploadPhase = "preparing" | "uploading" | "finalizing";

export interface UploadProgress {
  phase: UploadPhase;
  bytesUploaded: number;
  bytesTotal: number;
  /** 0-100, derived from real byte counts only. */
  percent: number;
}

export interface UploadSourceVideoInput {
  projectId: string;
  file: File;
  metadata: VideoFileMetadata;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

export interface UploadedSourceVideo {
  /** Path inside the bucket, e.g. "<projectId>/original.mp4". */
  storagePath: string;
  storedFileName: string;
  bucket: string;
}

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelado.");
    this.name = "UploadCancelledError";
  }
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? SUPABASE_KEY;
}

/** Deterministic layout: source-videos/{projectId}/original.{ext} */
function buildStoragePath(projectId: string, metadata: VideoFileMetadata) {
  const extension = metadata.format || "bin";
  const storedFileName = `original.${extension}`;
  return { storagePath: `${projectId}/${storedFileName}`, storedFileName };
}

function uploadResumable(
  input: UploadSourceVideoInput,
  storagePath: string,
  token: string,
): Promise<void> {
  const { file, metadata, onProgress, signal } = input;
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 6000, 12000],
      chunkSize: CHUNK_SIZE,
      removeFingerprintOnSuccess: true,
      uploadDataDuringCreation: true,
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
        "x-upsert": "true",
      },
      metadata: {
        bucketName: SOURCE_BUCKET,
        objectName: storagePath,
        contentType: metadata.mimeType,
        cacheControl: "3600",
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.({
          phase: "uploading",
          bytesUploaded,
          bytesTotal,
          percent: bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0,
        });
      },
      onSuccess: () => {
        onProgress?.({
          phase: "finalizing",
          bytesUploaded: file.size,
          bytesTotal: file.size,
          percent: 100,
        });
        resolve();
      },
      onError: (error) => reject(error instanceof Error ? error : new Error(String(error))),
    });

    if (signal) {
      if (signal.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          void upload.abort();
          reject(new UploadCancelledError());
        },
        { once: true },
      );
    }

    upload.start();
  });
}

function uploadSingleRequest(
  input: UploadSourceVideoInput,
  storagePath: string,
  token: string,
): Promise<void> {
  const { file, metadata, onProgress, signal } = input;
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `${SUPABASE_URL}/storage/v1/object/${SOURCE_BUCKET}/${storagePath}`,
      true,
    );
    request.setRequestHeader("authorization", `Bearer ${token}`);
    request.setRequestHeader("apikey", SUPABASE_KEY);
    request.setRequestHeader("x-upsert", "true");
    request.setRequestHeader("cache-control", "3600");
    if (metadata.mimeType) request.setRequestHeader("content-type", metadata.mimeType);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.({
        phase: "uploading",
        bytesUploaded: event.loaded,
        bytesTotal: event.total,
        percent: (event.loaded / event.total) * 100,
      });
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({
          phase: "finalizing",
          bytesUploaded: file.size,
          bytesTotal: file.size,
          percent: 100,
        });
        resolve();
        return;
      }
      reject(new Error(`Falha no upload (HTTP ${request.status}). ${request.responseText}`));
    };
    request.onerror = () => reject(new Error("Falha de rede durante o upload do vídeo."));
    request.onabort = () => reject(new UploadCancelledError());

    if (signal) {
      if (signal.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      signal.addEventListener("abort", () => request.abort(), { once: true });
    }

    request.send(file);
  });
}

export const videoUploadService = {
  buildStoragePath,

  /** Uploads the file and returns the stored reference. Throws on failure. */
  async uploadSourceVideo(input: UploadSourceVideoInput): Promise<UploadedSourceVideo> {
    const { projectId, file, metadata, onProgress } = input;
    onProgress?.({ phase: "preparing", bytesUploaded: 0, bytesTotal: file.size, percent: 0 });

    const { storagePath, storedFileName } = buildStoragePath(projectId, metadata);
    const token = await getAuthToken();

    if (file.size >= RESUMABLE_THRESHOLD) {
      try {
        await uploadResumable(input, storagePath, token);
      } catch (error) {
        if (error instanceof UploadCancelledError) throw error;
        // Resumable endpoint unavailable — fall back to a single request.
        await uploadSingleRequest(input, storagePath, token);
      }
    } else {
      await uploadSingleRequest(input, storagePath, token);
    }

    return { storagePath, storedFileName, bucket: SOURCE_BUCKET };
  },

  async removeStoredVideo(storagePath: string): Promise<void> {
    await supabase.storage.from(SOURCE_BUCKET).remove([storagePath]);
  },

  /** Signed playback URL for the private bucket. */
  async createSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  },
};
