import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LANGUAGE } from "@/lib/analysis-options";
import { buildAnalysisJobRequest } from "@/services/analysis/analysisRequest";
import type { AnalysisJobRequest } from "@/services/analysis/contracts";
import { mapProject, projectService } from "@/services/projectService";
import { videoMetadataService, type VideoFileMetadata } from "@/services/videoMetadataService";
import { videoUploadService, type UploadProgress } from "@/services/videoUploadService";
import {
  PROCESSING_STEP_TEMPLATE,
  type AnalysisMode,
  type AnalysisSource,
  type AnalysisStage,
  type ClipsDurationPreference,
  type ClipsQuantityMode,
  type ContextLevel,
  type EditConfiguration,
  type EditIntensity,
  type GeneratedVideo,
  type GeneratedVideoKind,
  type HighlightsDurationMode,
  type HighlightsStyle,
  type LanguageMode,
  type ProcessingJob,
  type ProcessingStep,
  type ProcessingType,
  type Project,
  type ProjectAnalysis,
  type ProjectStatus,
  type SegmentDecision,
  type ShortClip,
  type SpeechPriority,
  type VideoSegment,
} from "@/types/video-editor";


/**
 * videoProcessingService — the single boundary between the UI and persistence /
 * future processing infrastructure.
 *
 * Today it persists projects, configurations, jobs, segments and results in the
 * database and stores source videos in object storage. Real analysis
 * (transcription, silence detection, visual analysis, rendering) is not
 * implemented: `createProcessingJob` enqueues a real job record that a future
 * worker consumes. Nothing in this module simulates AI results.
 */

const SOURCE_BUCKET = "source-videos";

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available yet — no processing backend is connected.`);
    this.name = "NotImplementedError";
  }
}

/* ------------------------------------------------------------------ mappers */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function mapConfiguration(row: Row): EditConfiguration {
  return {
    id: row.id,
    projectId: row.project_id,
    wantShortClips: row.want_short_clips,
    wantHighlights: row.want_highlights,
    wantLongEdit: row.want_long_edit,

    languageMode: (row.language_mode ?? "manual") as LanguageMode,
    primaryLanguage: row.primary_language ?? DEFAULT_LANGUAGE,
    secondaryLanguages: (row.secondary_languages ?? []) as string[],
    hasMultipleLanguages: row.has_multiple_languages ?? false,
    transcriptionLanguage: row.transcription_language ?? row.primary_language ?? DEFAULT_LANGUAGE,

    contentTypes: (row.content_types ?? []) as string[],
    videoContext: row.video_context ?? null,
    mainActivity: row.main_activity ?? null,
    analysisNotes: row.analysis_notes ?? null,
    importantAudioVideoFlags: (row.important_audio_video_flags ?? []) as string[],
    analysisMode: (row.analysis_mode ?? "multimodal") as AnalysisMode,

    clipsQuantityMode: (row.clips_quantity_mode ?? "auto") as ClipsQuantityMode,
    clipsQuantity: num(row.clips_quantity),
    clipsDurationPreference: (row.clips_duration_preference ?? "auto") as ClipsDurationPreference,
    clipsSelectionCriteria: (row.clips_selection_criteria ?? []) as string[],
    avoidSimilarClips: row.avoid_similar_clips ?? true,
    speechPriority: (row.speech_priority ?? "preferred") as SpeechPriority,
    clipMinSeconds: num(row.clip_min_seconds),
    clipMaxSeconds: num(row.clip_max_seconds),

    highlightsDurationMode: (row.highlights_duration_mode ?? "preset") as HighlightsDurationMode,
    highlightsDurationMinutes: Number(row.highlights_duration_minutes ?? 15),
    highlightsTargetSeconds: num(row.highlights_target_seconds),
    highlightsEditingStyle: (row.highlights_editing_style ?? "balanced") as HighlightsStyle,
    highlightsCriteria: (row.highlights_criteria ?? []) as string[],
    highlightsContextLevel: (row.highlights_context_level ?? "balanced") as ContextLevel,

    longEditIntensity: (row.long_edit_intensity ?? null) as EditIntensity | null,
    longEditRemoveFlags: (row.long_edit_remove_flags ?? []) as string[],
    removeSilences: row.remove_silences ?? true,
    silenceThresholdSeconds: num(row.silence_threshold_seconds),
    removeWaiting: row.remove_waiting ?? true,
    removeRepetitions: row.remove_repetitions ?? false,
    removeLowActivity: row.remove_low_activity ?? true,
    preserveVisualEvents: row.preserve_visual_events ?? true,
    preserveWebcamReactions: row.preserve_webcam_reactions ?? true,
    preserveContextLevel: (row.preserve_context_level ?? "balanced") as ContextLevel,
  };
}

function mapJob(row: Row): ProcessingJob {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    progress: Number(row.progress ?? 0),
    currentStep: row.current_step,
    stage: (row.stage ?? "queued") as AnalysisStage,
    waitingForWorker: row.waiting_for_worker ?? true,
    steps: (row.steps ?? []) as ProcessingStep[],
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    estimatedSecondsRemaining: row.estimated_seconds_remaining,
    cancelRequested: row.cancel_requested,
    errorMessage: row.error_message,
  };
}

function mapSegment(row: Row): VideoSegment {
  return {
    id: row.id,
    projectId: row.project_id,
    startSeconds: Number(row.start_seconds),
    endSeconds: Number(row.end_seconds),
    durationSeconds: Number(row.duration_seconds),
    decision: row.decision as SegmentDecision,
    score: num(row.score),
    reason: row.reason,
    category: row.category,
    relatedResultId: row.related_result_id,
    speechScore: num(row.speech_score),
    transcriptScore: num(row.transcript_score),
    visualScore: num(row.visual_score),
    reactionScore: num(row.reaction_score),
    contextScore: num(row.context_score),
    audioEnergyScore: num(row.audio_energy_score),
    noveltyScore: num(row.novelty_score),
    overallScore: num(row.overall_score),
    reasonCodes: (row.reason_codes ?? []) as string[],
    reasonSummary: row.reason_summary ?? null,
    analysisSources: (row.analysis_sources ?? []) as AnalysisSource[],
  };
}


function mapClip(row: Row): ShortClip {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    durationSeconds: Number(row.duration_seconds),
    sourceStartSeconds: Number(row.source_start_seconds),
    category: row.category,
    confidence: row.confidence == null ? null : Number(row.confidence),
    thumbnailUrl: row.thumbnail_url,
    videoUrl: row.video_url,
    kept: row.kept,
  };
}

function mapGeneratedVideo(row: Row): GeneratedVideo {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as GeneratedVideoKind,
    originalDurationSeconds:
      row.original_duration_seconds == null ? null : Number(row.original_duration_seconds),
    finalDurationSeconds:
      row.final_duration_seconds == null ? null : Number(row.final_duration_seconds),
    removedSeconds: row.removed_seconds == null ? null : Number(row.removed_seconds),
    cutsCount: row.cuts_count,
    segmentIds: row.segment_ids ?? [],
    thumbnailUrl: row.thumbnail_url,
    videoUrl: row.video_url,
  };
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Not found");
  return data;
}

/* ---------------------------------------------------------------- interface */

export interface CreateProjectInput {
  name: string;
}

export interface UploadVideoInput {
  projectId: string;
  file: File;
  /** Real metadata read from the file; re-read when omitted. */
  metadata?: VideoFileMetadata;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

export interface SaveConfigurationInput {
  projectId: string;
  wantShortClips: boolean;
  wantHighlights: boolean;
  wantLongEdit: boolean;
  highlightsTargetSeconds: number | null;
  longEditIntensity: EditIntensity | null;
}

export const videoProcessingService = {
  /* ------------------------------------------------------------- projects */

  async listProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProject);
  },

  async getProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    return mapProject(unwrap(data, error));
  },

  async createProject(input: CreateProjectInput): Promise<Project> {
    return projectService.createProject(input.name);
  },

  async renameProject(projectId: string, name: string): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", projectId)
      .select("*")
      .single();
    return mapProject(unwrap(data, error));
  },

  async setProjectStatus(projectId: string, status: ProjectStatus): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update({ status })
      .eq("id", projectId)
      .select("*")
      .single();
    return mapProject(unwrap(data, error));
  },

  async deleteProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId).catch(() => null);
    if (project?.sourceStoragePath) {
      await supabase.storage.from(SOURCE_BUCKET).remove([project.sourceStoragePath]);
    }
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) throw new Error(error.message);
  },

  /* --------------------------------------------------------------- source */

  /**
   * Real upload pipeline: metadata is persisted first, then the bytes go to
   * object storage with real progress, then the reference is confirmed.
   */
  async uploadVideo({
    projectId,
    file,
    metadata,
    onProgress,
    signal,
  }: UploadVideoInput): Promise<Project> {
    const resolved = metadata ?? (await videoMetadataService.read(file));
    const existing = await this.getProject(projectId);
    if (existing.sourceStoragePath) {
      await videoUploadService.removeStoredVideo(existing.sourceStoragePath);
    }

    await projectService.attachSourceMetadata(projectId, resolved);
    try {
      await projectService.setUploadStatus(projectId, "uploading");
      const stored = await videoUploadService.uploadSourceVideo({
        projectId,
        file,
        metadata: resolved,
        onProgress,
        signal,
      });
      return await projectService.confirmUpload(projectId, stored, resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no upload do vídeo.";
      await projectService.setUploadStatus(projectId, "error", message).catch(() => null);
      throw error;
    }
  },

  async removeVideo(projectId: string): Promise<Project> {
    const existing = await this.getProject(projectId);
    return projectService.detachSource(projectId, existing.sourceStoragePath);
  },

  /** Signed playback URL for the private source video, valid for one hour. */
  async getSourcePlaybackUrl(project: Project): Promise<string | null> {
    if (!project.sourceStoragePath) return null;
    return videoUploadService.createSignedUrl(project.sourceStoragePath);
  },

  /* -------------------------------------------------------- configuration */

  async getConfiguration(projectId: string): Promise<EditConfiguration | null> {
    const { data, error } = await supabase
      .from("edit_configurations")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapConfiguration(data) : null;
  },

  async saveConfiguration(input: SaveConfigurationInput): Promise<EditConfiguration> {
    const { data, error } = await supabase
      .from("edit_configurations")
      .upsert(
        {
          project_id: input.projectId,
          want_short_clips: input.wantShortClips,
          want_highlights: input.wantHighlights,
          want_long_edit: input.wantLongEdit,
          highlights_target_seconds: input.highlightsTargetSeconds,
          long_edit_intensity: input.longEditIntensity,
        },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();

    const types: ProcessingType[] = [];
    if (input.wantShortClips) types.push("short_clips");
    if (input.wantHighlights) types.push("highlights");
    if (input.wantLongEdit) types.push("long_edit");
    await supabase
      .from("projects")
      .update({ processing_types: types, status: "ready" })
      .eq("id", input.projectId);

    return mapConfiguration(unwrap(data, error));
  },

  /* ----------------------------------------------------------------- jobs */

  /**
   * Enqueues a real job record. A processing worker is not connected yet, so
   * the job stays `queued` until one picks it up — the UI reflects that
   * honestly instead of simulating progress.
   */
  async createProcessingJob(projectId: string): Promise<ProcessingJob> {
    const { data, error } = await supabase
      .from("processing_jobs")
      .insert({
        project_id: projectId,
        status: "queued",
        progress: 0,
        current_step: null,
        steps: PROCESSING_STEP_TEMPLATE as unknown as Row,
      })
      .select("*")
      .single();
    await supabase.from("projects").update({ status: "queued" }).eq("id", projectId);
    return mapJob(unwrap(data, error));
  },

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const { data, error } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    return mapJob(unwrap(data, error));
  },

  async getLatestJob(projectId: string): Promise<ProcessingJob | null> {
    const { data, error } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data) : null;
  },

  async cancelJob(jobId: string): Promise<ProcessingJob> {
    const { data, error } = await supabase
      .from("processing_jobs")
      .update({
        cancel_requested: true,
        status: "cancelled",
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();
    const job = mapJob(unwrap(data, error));
    await supabase.from("projects").update({ status: "ready" }).eq("id", job.projectId);
    return job;
  },

  /* ------------------------------------------------------------- analysis */

  async getProjectAnalysis(projectId: string): Promise<ProjectAnalysis> {
    const [project, configuration, segments, latestJob] = await Promise.all([
      this.getProject(projectId),
      this.getConfiguration(projectId),
      this.getSegments(projectId),
      this.getLatestJob(projectId),
    ]);
    return { project, configuration, segments, latestJob };
  },

  async getSegments(projectId: string): Promise<VideoSegment[]> {
    const { data, error } = await supabase
      .from("video_segments")
      .select("*")
      .eq("project_id", projectId)
      .order("start_seconds", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSegment);
  },

  async setSegmentDecision(segmentId: string, decision: SegmentDecision): Promise<VideoSegment> {
    const { data, error } = await supabase
      .from("video_segments")
      .update({ decision })
      .eq("id", segmentId)
      .select("*")
      .single();
    return mapSegment(unwrap(data, error));
  },

  /* -------------------------------------------------------------- results */

  async getGeneratedClips(projectId: string): Promise<ShortClip[]> {
    const { data, error } = await supabase
      .from("short_clips")
      .select("*")
      .eq("project_id", projectId)
      .order("source_start_seconds", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapClip);
  },

  async setClipKept(clipId: string, kept: boolean): Promise<void> {
    const { error } = await supabase.from("short_clips").update({ kept }).eq("id", clipId);
    if (error) throw new Error(error.message);
  },

  async deleteClip(clipId: string): Promise<void> {
    const { error } = await supabase.from("short_clips").delete().eq("id", clipId);
    if (error) throw new Error(error.message);
  },

  async getHighlightsVideo(projectId: string): Promise<GeneratedVideo | null> {
    return this.getGeneratedVideo(projectId, "highlights");
  },

  async getEditedLongVideo(projectId: string): Promise<GeneratedVideo | null> {
    return this.getGeneratedVideo(projectId, "long_edit");
  },

  async getGeneratedVideo(
    projectId: string,
    kind: GeneratedVideoKind,
  ): Promise<GeneratedVideo | null> {
    const { data, error } = await supabase
      .from("generated_videos")
      .select("*")
      .eq("project_id", projectId)
      .eq("kind", kind)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGeneratedVideo(data) : null;
  },

  /** Export/render pipeline lives in the future processing backend. */
  async exportResult(_params: {
    projectId: string;
    resultId: string;
    kind: "clip" | GeneratedVideoKind;
    format?: "mp4" | "mov";
  }): Promise<never> {
    throw new NotImplementedError("Exporting results");
  },
};

export type VideoProcessingService = typeof videoProcessingService;
