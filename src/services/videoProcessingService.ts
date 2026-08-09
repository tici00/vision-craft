import { supabase } from "@/integrations/supabase/client";
import {
  PROCESSING_STEP_TEMPLATE,
  type EditConfiguration,
  type EditIntensity,
  type GeneratedVideo,
  type GeneratedVideoKind,
  type ProcessingJob,
  type ProcessingStep,
  type ProcessingType,
  type Project,
  type ProjectAnalysis,
  type ProjectStatus,
  type SegmentDecision,
  type ShortClip,
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

type Row = Record<string, any>;

function mapProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    sourceFileName: row.source_file_name,
    sourceFileSize: row.source_file_size == null ? null : Number(row.source_file_size),
    sourceMimeType: row.source_mime_type,
    sourceStoragePath: row.source_storage_path,
    sourceUrl: row.source_url,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    thumbnailUrl: row.thumbnail_url,
    status: row.status as ProjectStatus,
    processingTypes: (row.processing_types ?? []) as ProcessingType[],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConfiguration(row: Row): EditConfiguration {
  return {
    id: row.id,
    projectId: row.project_id,
    wantShortClips: row.want_short_clips,
    wantHighlights: row.want_highlights,
    wantLongEdit: row.want_long_edit,
    highlightsTargetSeconds: row.highlights_target_seconds,
    longEditIntensity: row.long_edit_intensity as EditIntensity | null,
    clipMinSeconds: row.clip_min_seconds,
    clipMaxSeconds: row.clip_max_seconds,
  };
}

function mapJob(row: Row): ProcessingJob {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    progress: Number(row.progress ?? 0),
    currentStep: row.current_step,
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
    score: row.score == null ? null : Number(row.score),
    reason: row.reason,
    category: row.category,
    relatedResultId: row.related_result_id,
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
  /** Duration read from the browser's video element before upload. */
  durationSeconds: number | null;
  onProgress?: (percent: number) => void;
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
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: input.name, status: "draft" })
      .select("*")
      .single();
    return mapProject(unwrap(data, error));
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

  async uploadVideo({ projectId, file, durationSeconds }: UploadVideoInput): Promise<Project> {
    const existing = await this.getProject(projectId);
    if (existing.sourceStoragePath) {
      await supabase.storage.from(SOURCE_BUCKET).remove([existing.sourceStoragePath]);
    }

    const path = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from(SOURCE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await supabase
      .from("projects")
      .update({
        source_file_name: file.name,
        source_file_size: file.size,
        source_mime_type: file.type,
        source_storage_path: path,
        duration_seconds: durationSeconds,
        status: "ready",
      })
      .eq("id", projectId)
      .select("*")
      .single();
    return mapProject(unwrap(data, error));
  },

  async removeVideo(projectId: string): Promise<Project> {
    const existing = await this.getProject(projectId);
    if (existing.sourceStoragePath) {
      await supabase.storage.from(SOURCE_BUCKET).remove([existing.sourceStoragePath]);
    }
    const { data, error } = await supabase
      .from("projects")
      .update({
        source_file_name: null,
        source_file_size: null,
        source_mime_type: null,
        source_storage_path: null,
        duration_seconds: null,
        status: "draft",
      })
      .eq("id", projectId)
      .select("*")
      .single();
    return mapProject(unwrap(data, error));
  },

  /** Signed playback URL for the private source video, valid for one hour. */
  async getSourcePlaybackUrl(project: Project): Promise<string | null> {
    if (!project.sourceStoragePath) return null;
    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .createSignedUrl(project.sourceStoragePath, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
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
        steps: PROCESSING_STEP_TEMPLATE,
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
