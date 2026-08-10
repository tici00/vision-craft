/**
 * Contracts for the future AI pipeline.
 *
 * Nothing here executes analysis. Each interface is the integration point for a
 * real provider/worker; the app persists configuration and enqueues jobs, and a
 * worker implementing these contracts performs the work and writes results back.
 * The UI must never treat these as producing data today.
 */

import type {
  AnalysisMode,
  AnalysisSource,
  AnalysisStage,
  ClipsDurationPreference,
  ClipsQuantityMode,
  ContextLevel,
  EditIntensity,
  HighlightsStyle,
  LanguageMode,
  SegmentScores,
  SpeechPriority,
} from "@/types/video-editor";

/* ------------------------------------------------- structured job request */

export interface AnalysisSourceVideo {
  projectId: string;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  format: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
}

export interface AnalysisLanguageRequest {
  mode: LanguageMode;
  /** Manual choice always wins over automatic detection. */
  primary: string;
  secondary: string[];
  hasMultiple: boolean;
  transcriptionLanguage: string | null;
  preferManualChoice: true;
}

export interface AnalysisContextRequest {
  contentTypes: string[];
  description: string | null;
  mainActivity: string | null;
  audioVideoFlags: string[];
  additionalInstructions: string | null;
}

export interface AnalysisPlanRequest {
  mode: AnalysisMode;
  /** Signal families the pipeline must combine; never interpreted in isolation. */
  sources: AnalysisSource[];
}

export interface ShortClipsOutputRequest {
  enabled: boolean;
  quantityMode: ClipsQuantityMode;
  quantity: number | null;
  durationPreference: ClipsDurationPreference;
  minSeconds: number | null;
  maxSeconds: number | null;
  selectionCriteria: string[];
  avoidSimilar: boolean;
  speechPriority: SpeechPriority;
}

export interface HighlightsOutputRequest {
  enabled: boolean;
  targetSeconds: number;
  editingStyle: HighlightsStyle;
  criteria: string[];
  contextLevel: ContextLevel;
}

export interface LongEditOutputRequest {
  enabled: boolean;
  intensity: EditIntensity;
  removeFlags: string[];
  removeSilences: boolean;
  silenceThresholdSeconds: number | null;
  removeWaiting: boolean;
  removeRepetitions: boolean;
  removeLowActivity: boolean;
  preserveVisualEvents: boolean;
  preserveWebcamReactions: boolean;
  preserveContextLevel: ContextLevel;
}

/** Everything a worker needs, independent of the UI. */
export interface AnalysisJobRequest {
  version: 1;
  sourceVideo: AnalysisSourceVideo;
  language: AnalysisLanguageRequest;
  context: AnalysisContextRequest;
  analysis: AnalysisPlanRequest;
  outputs: {
    shortClips: ShortClipsOutputRequest;
    highlights: HighlightsOutputRequest;
    longEdit: LongEditOutputRequest;
  };
}

/* --------------------------------------------------------- signal models */

export interface AudioSignal {
  startSeconds: number;
  endSeconds: number;
  energy: number | null;
  isSilence: boolean;
  hasMusic: boolean;
  hasLaughter: boolean;
  notableSound: string | null;
}

export interface SpeechSegment {
  startSeconds: number;
  endSeconds: number;
  language: string | null;
  confidence: number | null;
}

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
  topic: string | null;
  isQuestion: boolean;
  isFunny: boolean;
  isTopicChange: boolean;
}

export interface VisualEvent {
  startSeconds: number;
  endSeconds: number;
  kind: "scene_change" | "screen_activity" | "on_screen_text" | "game_event" | "other";
  description: string | null;
  intensity: number | null;
}

export interface WebcamEvent {
  startSeconds: number;
  endSeconds: number;
  reaction: string | null;
  intensity: number | null;
}

export interface ContextSignal {
  code: string;
  matchedSegmentStart: number;
  matchedSegmentEnd: number;
  explanation: string | null;
}

export interface MultimodalSignals {
  audioSignals: AudioSignal[];
  speechSegments: SpeechSegment[];
  transcriptSegments: TranscriptSegment[];
  visualEvents: VisualEvent[];
  sceneChanges: number[];
  webcamEvents: WebcamEvent[];
  contextSignals: ContextSignal[];
}

/** Canonical reason codes used to explain a keep/cut decision to the user. */
export const REASON_CODES = [
  "HIGH_ENERGY_SPEECH",
  "USER_REACTION",
  "IMPORTANT_VISUAL_EVENT",
  "GAME_EVENT",
  "CONTEXT_MATCH",
  "STRONG_QUOTE",
  "TOPIC_CHANGE",
  "LONG_SILENCE",
  "WAITING_TIME",
  "REPETITION",
  "LOW_ACTIVITY",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface ScoredSegment extends SegmentScores {
  startSeconds: number;
  endSeconds: number;
  reasonCodes: ReasonCode[];
  reasonSummary: string | null;
  analysisSources: AnalysisSource[];
}

/* ---------------------------------------------------------- service ports */

export interface AudioExtractionService {
  extractAudio(request: AnalysisJobRequest): Promise<{ audioStoragePath: string }>;
}

export interface TranscriptionService {
  detectLanguage(request: AnalysisJobRequest): Promise<{ language: string; confidence: number }>;
  transcribe(
    request: AnalysisJobRequest,
  ): Promise<{ speechSegments: SpeechSegment[]; transcriptSegments: TranscriptSegment[] }>;
}

export interface VisualAnalysisService {
  analyzeVideo(
    request: AnalysisJobRequest,
  ): Promise<{ visualEvents: VisualEvent[]; sceneChanges: number[]; webcamEvents: WebcamEvent[] }>;
}

export interface MultimodalAnalysisService {
  combineSignals(request: AnalysisJobRequest): Promise<MultimodalSignals>;
}

export interface ScoringService {
  scoreSegments(
    request: AnalysisJobRequest,
    signals: MultimodalSignals,
  ): Promise<ScoredSegment[]>;
}

export interface SegmentSelectionService {
  selectSegments(
    request: AnalysisJobRequest,
    scored: ScoredSegment[],
  ): Promise<{ keep: ScoredSegment[]; cut: ScoredSegment[] }>;
}

export interface RenderingService {
  render(request: AnalysisJobRequest, keep: ScoredSegment[]): Promise<{ outputPaths: string[] }>;
}

export interface AnalysisPipelineProviders {
  audio?: AudioExtractionService;
  transcription?: TranscriptionService;
  visual?: VisualAnalysisService;
  multimodal?: MultimodalAnalysisService;
  scoring?: ScoringService;
  selection?: SegmentSelectionService;
  rendering?: RenderingService;
}

export const PIPELINE_STAGE_ORDER: AnalysisStage[] = [
  "queued",
  "preparing",
  "extracting_audio",
  "detecting_language",
  "transcribing",
  "analyzing_audio",
  "analyzing_video",
  "combining_signals",
  "scoring_segments",
  "preparing_outputs",
  "rendering",
  "completed",
];

/**
 * No provider is registered yet: the job is persisted and waits for a real
 * worker. Kept explicit so no part of the app can pretend analysis happened.
 */
export const registeredProviders: AnalysisPipelineProviders = {};

export function hasConnectedWorker(): boolean {
  return Object.keys(registeredProviders).length > 0;
}
