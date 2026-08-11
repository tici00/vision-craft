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

/* ------------------------------------------------------- analysis pipeline */

/** Stages of the future multimodal analysis pipeline. */
export type AnalysisStage =
  | "queued"
  | "preparing"
  | "extracting_audio"
  | "detecting_language"
  | "transcribing"
  | "analyzing_audio"
  | "analyzing_video"
  | "combining_signals"
  | "scoring_segments"
  | "preparing_outputs"
  | "rendering"
  | "completed"
  | "failed";

/** Honest analysis state of a project — never advanced without a real worker. */
export type AnalysisStatus =
  | "not_configured"
  | "configured"
  | "queued"
  | "running"
  | "completed"
  | "error";

export type LanguageMode = "manual" | "auto";

export type SpeechPriority = "always" | "preferred" | "optional";

export type ContextLevel = "minimal" | "balanced" | "high";

export type HighlightsStyle = "dynamic" | "balanced" | "complete";

/** Which signal families the analysis should combine. */
export type AnalysisMode = "audio_only" | "audio_speech" | "multimodal";

export type ClipsQuantityMode = "auto" | "fixed" | "custom";

export type ClipsDurationPreference = "auto" | "15_30" | "30_60" | "60_90" | "up_to_180";

export type HighlightsDurationMode = "preset" | "custom";

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
  /* analysis lifecycle — written only by real processing */
  analysisStatus: AnalysisStatus;
  analysisProgress: number;
  analysisStage: AnalysisStage | null;
  /** Reported by the language-detection service; never overrides a manual choice. */
  detectedLanguage: string | null;
  languageConfidence: number | null;
  analysisError: string | null;
  analysisStartedAt: string | null;
  analysisCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditConfiguration {
  id: string;
  projectId: string;

  /* outputs enabled */
  wantShortClips: boolean;
  wantHighlights: boolean;
  wantLongEdit: boolean;

  /* language */
  languageMode: LanguageMode;
  primaryLanguage: string;
  secondaryLanguages: string[];
  hasMultipleLanguages: boolean;
  /** Language the transcription service should start with (manual choice wins). */
  transcriptionLanguage: string | null;

  /* content context */
  contentTypes: string[];
  videoContext: string | null;
  mainActivity: string | null;
  analysisNotes: string | null;
  importantAudioVideoFlags: string[];
  analysisMode: AnalysisMode;

  /* short clips */
  clipsQuantityMode: ClipsQuantityMode;
  clipsQuantity: number | null;
  clipsDurationPreference: ClipsDurationPreference;
  clipsSelectionCriteria: string[];
  avoidSimilarClips: boolean;
  speechPriority: SpeechPriority;
  clipMinSeconds: number | null;
  clipMaxSeconds: number | null;

  /* highlights */
  highlightsDurationMode: HighlightsDurationMode;
  highlightsDurationMinutes: number;
  highlightsTargetSeconds: number | null;
  highlightsEditingStyle: HighlightsStyle;
  highlightsCriteria: string[];
  highlightsContextLevel: ContextLevel;

  /* long edit */
  longEditIntensity: EditIntensity | null;
  longEditRemoveFlags: string[];
  removeSilences: boolean;
  silenceThresholdSeconds: number | null;
  removeWaiting: boolean;
  removeRepetitions: boolean;
  removeLowActivity: boolean;
  preserveVisualEvents: boolean;
  preserveWebcamReactions: boolean;
  preserveContextLevel: ContextLevel;
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
  stage: AnalysisStage;
  /** True while no real worker has claimed the job. */
  waitingForWorker: boolean;
  steps: ProcessingStep[];
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Only present when the processing backend reports a real estimate. */
  estimatedSecondsRemaining: number | null;
  cancelRequested: boolean;
  errorMessage: string | null;
  /** Human-readable description of what the last executed stage really did. */
  stageMessage: string | null;
}


/** Multi-signal relevance scores produced by the future analysis pipeline. */
export interface SegmentScores {
  speechScore: number | null;
  transcriptScore: number | null;
  visualScore: number | null;
  reactionScore: number | null;
  contextScore: number | null;
  audioEnergyScore: number | null;
  noveltyScore: number | null;
  overallScore: number | null;
}

export type AnalysisSource = "audio" | "transcript" | "video" | "context";

export interface VideoSegment extends SegmentScores {
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
  reasonCodes: string[];
  reasonSummary: string | null;
  analysisSources: AnalysisSource[];
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
  { key: "prepare", label: "Vídeo preparado", status: "pending" },
  { key: "extracting_audio", label: "Extraindo áudio", status: "pending" },
  { key: "detecting_language", label: "Detectando idioma", status: "pending" },
  { key: "transcribing", label: "Transcrevendo vídeo", status: "pending" },
  { key: "analyzing_audio", label: "Analisando áudio", status: "pending" },
  { key: "analyzing_video", label: "Analisando imagens", status: "pending" },
  { key: "combining_signals", label: "Combinando informações", status: "pending" },
  { key: "scoring_segments", label: "Selecionando os melhores momentos", status: "pending" },
  { key: "preparing_outputs", label: "Preparando edição", status: "pending" },
  { key: "rendering", label: "Renderizando resultados", status: "pending" },
];

export const ANALYSIS_STAGE_LABEL: Record<AnalysisStage, string> = {
  queued: "Na fila",
  preparing: "Preparando vídeo",
  extracting_audio: "Extraindo áudio",
  detecting_language: "Detectando idioma",
  transcribing: "Transcrevendo vídeo",
  analyzing_audio: "Analisando áudio",
  analyzing_video: "Analisando imagens",
  combining_signals: "Combinando informações",
  scoring_segments: "Selecionando os melhores momentos",
  preparing_outputs: "Preparando edição",
  rendering: "Renderizando resultados",
  completed: "Concluído",
  failed: "Falhou",
};

export const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  not_configured: "Configuração pendente",
  configured: "Configuração concluída",
  queued: "Aguardando processamento",
  running: "Análise em andamento",
  completed: "Análise concluída",
  error: "Erro na análise",
};

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
