import { supabase } from "@/integrations/supabase/client";
import type { VideoFileMetadata } from "@/services/videoMetadataService";
import { videoUploadService, type UploadedSourceVideo } from "@/services/videoUploadService";
import type {
  ProcessingType,
  Project,
  ProjectStatus,
  UploadStatus,
} from "@/types/video-editor";

/**
 * projectService — persistence for projects and their real source-video
 * reference. Video bytes live in object storage; the database only stores
 * metadata and the storage path.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export function mapProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    sourceFileName: row.source_file_name,
    sourceStoredFileName: row.source_stored_file_name ?? null,
    sourceFileSize: row.source_file_size == null ? null : Number(row.source_file_size),
    sourceMimeType: row.source_mime_type,
    sourceFormat: row.source_format ?? null,
    sourceStoragePath: row.source_storage_path,
    sourceUrl: row.source_url,
    sourceUploadedAt: row.source_uploaded_at ?? null,
    uploadStatus: (row.upload_status ?? "none") as UploadStatus,
    uploadError: row.upload_error ?? null,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    thumbnailUrl: row.thumbnail_url,
    status: row.status as ProjectStatus,
    processingTypes: (row.processing_types ?? []) as ProcessingType[],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function updateProject(projectId: string, patch: Record<string, unknown>): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapProject(data);
}

export const projectService = {
  mapProject,

  async createProject(name: string): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, status: "draft", upload_status: "none" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapProject(data);
  },

  /**
   * Stores the metadata read from the real file before the bytes are sent, so a
   * failed upload still keeps the project and its source details.
   */
  async attachSourceMetadata(projectId: string, metadata: VideoFileMetadata): Promise<Project> {
    return updateProject(projectId, {
      source_file_name: metadata.fileName,
      source_file_size: metadata.sizeBytes,
      source_mime_type: metadata.mimeType,
      source_format: metadata.format,
      duration_seconds: metadata.durationSeconds,
      status: "draft",
      upload_status: "preparing",
      upload_error: null,
    });
  },

  async setUploadStatus(
    projectId: string,
    uploadStatus: UploadStatus,
    uploadError?: string | null,
  ): Promise<Project> {
    return updateProject(projectId, {
      upload_status: uploadStatus,
      upload_error: uploadError ?? null,
      ...(uploadStatus === "error" ? { status: "error" as ProjectStatus } : {}),
    });
  },

  /** Marks the upload as complete and the project as ready to configure. */
  async confirmUpload(
    projectId: string,
    stored: UploadedSourceVideo,
    metadata: VideoFileMetadata,
  ): Promise<Project> {
    return updateProject(projectId, {
      source_storage_path: stored.storagePath,
      source_stored_file_name: stored.storedFileName,
      source_file_name: metadata.fileName,
      source_file_size: metadata.sizeBytes,
      source_mime_type: metadata.mimeType,
      source_format: metadata.format,
      duration_seconds: metadata.durationSeconds,
      source_uploaded_at: new Date().toISOString(),
      upload_status: "uploaded",
      upload_error: null,
      status: "ready",
    });
  },

  async detachSource(projectId: string, storagePath: string | null): Promise<Project> {
    if (storagePath) await videoUploadService.removeStoredVideo(storagePath);
    return updateProject(projectId, {
      source_file_name: null,
      source_stored_file_name: null,
      source_file_size: null,
      source_mime_type: null,
      source_format: null,
      source_storage_path: null,
      source_uploaded_at: null,
      duration_seconds: null,
      upload_status: "none",
      upload_error: null,
      status: "draft",
    });
  },
};
