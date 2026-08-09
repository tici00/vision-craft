/**
 * Domain models for the AI Video Editor.
 * These types mirror the database schema and are the single source of truth
 * for the UI layer. The UI never imports database row types directly.
 */

export type ProjectStatus =
  | "draft"
  | "ready"
  | "queued"
  | "processing"
  | "analyzing"
  | "generating_clips"
  | "rendering"
  | "completed"
  | "error";

export type JobStatus = "queued" | "running" | "completed" | "cancelled" | "error";

export type EditIntensity = "conservative" | "balanced" | "aggressive";

export type SegmentDecision = "keep" | "cut" | "undecided";

export type GeneratedVideoKind = "highlights" | "long_edit";

export type ProcessingType = "short_clips" | "highlights" | "long_edit";

/** Real lifecycle of the source-video upload. Never simulated. */
export type UploadStatus = "none" | "preparing" | "uploading" | "finalizing" | "uploaded" | "error";

export interface Project {
  id: string;
  name: string;
  sourceFileName: string | null;
  /** File name as stored in the bucket, e.g. "original.mp4". */
  sourceStoredFileName: string | null;
  sourceFileSize: number | null;
  sourceMimeType: string | null;
  /** Container extension, e.g. "mp4". */
  sourceFormat: string | null;
  sourceStoragePath: string | null;
  sourceUrl: string | null;
  sourceUploadedAt: string | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  status: ProjectStatus;
  processingTypes: ProcessingType[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditConfiguration {
  id: string;
  projectId: string;
  wantShortClips: boolean;
  wantHighlights: boolean;
  wantLongEdit: boolean;
  highlightsTargetSeconds: number | null;
  longEditIntensity: EditIntensity | null;
  clipMinSeconds: number | null;
  clipMaxSeconds: number | null;
}

export interface ProcessingStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  status: JobStatus;
  progress: number;
  currentStep: string | null;
  steps: ProcessingStep[];
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Only present when the processing backend reports a real estimate. */
  estimatedSecondsRemaining: number | null;
  cancelRequested: boolean;
  errorMessage: string | null;
}

export interface VideoSegment {
  id: string;
  projectId: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  decision: SegmentDecision;
  score: number | null;
  reason: string | null;
  category: string | null;
  relatedResultId: string | null;
}

export interface ShortClip {
  id: string;
  projectId: string;
  title: string;
  durationSeconds: number;
  sourceStartSeconds: number;
  category: string | null;
  confidence: number | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  kept: boolean;
}

export interface GeneratedVideo {
  id: string;
  projectId: string;
  kind: GeneratedVideoKind;
  originalDurationSeconds: number | null;
  finalDurationSeconds: number | null;
  removedSeconds: number | null;
  cutsCount: number | null;
  segmentIds: string[];
  thumbnailUrl: string | null;
  videoUrl: string | null;
}

export interface ProjectAnalysis {
  project: Project;
  configuration: EditConfiguration | null;
  segments: VideoSegment[];
  latestJob: ProcessingJob | null;
}

export const PROCESSING_STEP_TEMPLATE: ProcessingStep[] = [
  { key: "prepare", label: "Video prepared", status: "pending" },
  { key: "audio", label: "Audio extracted", status: "pending" },
  { key: "transcribe", label: "Transcribing speech", status: "pending" },
  { key: "analyze", label: "Analyzing moments", status: "pending" },
  { key: "timeline", label: "Creating timeline", status: "pending" },
  { key: "generate", label: "Generating videos", status: "pending" },
  { key: "finalize", label: "Finalizing", status: "pending" },
];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  ready: "Ready to process",
  queued: "Queued",
  processing: "Processing",
  analyzing: "Analyzing",
  generating_clips: "Generating clips",
  rendering: "Rendering",
  completed: "Completed",
  error: "Error",
};

export const PROCESSING_TYPE_LABEL: Record<ProcessingType, string> = {
  short_clips: "Short clips",
  highlights: "Highlights video",
  long_edit: "Long edited video",
};
