/**
 * Shared data contracts between Vision Craft and the external media worker.
 *
 * Plain types only — safe to import from anywhere. All HTTP traffic goes
 * through `workerClient.server.ts`; no component should ever call the worker
 * directly.
 *
 * The real worker contract (verified against the deployed service) is:
 *   GET  /health        -> { ok, service, ffmpeg, timestamp }
 *   POST /extract-audio -> multipart field `video` -> { ok, audioId, audioUrl }
 *   POST /render-clips  -> multipart field `video` + `clips` JSON
 *                          -> { ok, clips: [{ id, start, end, url }] }
 * Authentication uses the `x-worker-token` header.
 */

export interface WorkerHealth {
  ok: boolean;
  service: string | null;
  ffmpeg: string | null;
  timestamp: string | null;
}

/** One audio track produced by the worker, already placed on the source timeline. */
export interface AudioChunk {
  index: number;
  startSeconds: number;
  durationSeconds: number | null;
  downloadUrl: string;
  format: string;
}

export interface ExtractAudioParams {
  /** Signed URL of the source video in storage — streamed to the worker. */
  sourceUrl: string;
  fileName?: string;
  contentType?: string;
}

export interface RenderClipRequest {
  /** Vision Craft clip id; used to map the worker response back to our rows. */
  id: string;
  startSeconds: number;
  endSeconds: number;
  title?: string;
}

export interface RenderClipResult {
  id: string;
  /** URL of the rendered file on the worker, to be copied into storage. */
  downloadUrl: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  error: string | null;
}

export interface RenderClipsParams {
  sourceUrl: string;
  fileName?: string;
  contentType?: string;
  clips: RenderClipRequest[];
}
