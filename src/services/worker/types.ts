/**
 * Shared data contracts between Vision Craft and the external media worker.
 *
 * Plain types only — safe to import from anywhere. All HTTP traffic goes
 * through `workerClient.server.ts`; no component should ever call the worker
 * directly.
 */

export interface WorkerHealth {
  ok: boolean;
  service: string | null;
  ffmpeg: string | null;
  timestamp: string | null;
}

export interface AudioChunk {
  index: number;
  startSeconds: number;
  durationSeconds: number | null;
  downloadUrl: string;
  format: string;
}

export interface ExtractAudioParams {
  jobId: string;
  projectId: string;
  sourceUrl: string;
  chunkSeconds?: number;
  outputFormat?: string;
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

export interface RenderClipsParams {
  jobId: string;
  projectId: string;
  sourceUrl: string;
  bucket: string;
  clips: RenderClipRequest[];
}
