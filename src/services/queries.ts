import { supabase } from "@/integrations/supabase/client";
import { videoProcessingService } from "@/services/videoProcessingService";
import type { Project, EditConfiguration, ShortClip } from "@/types/video-editor";

const GENERATED_CLIPS_BUCKET = "generated-clips";
const GENERATED_CLIP_URL_TTL_SECONDS = 60 * 60;

async function getGeneratedClipsWithPlayback(projectId: string): Promise<ShortClip[]> {
  const { data, error } = await supabase
    .from("short_clips")
    .select("*")
    .eq("project_id", projectId)
    .order("source_start_seconds", { ascending: true });

  if (error) throw new Error(error.message);

  const clips = await Promise.all(
    (data ?? []).map(async (row) => {
      let videoUrl: string | null = null;

      if (row.video_storage_path) {
        const signed = await supabase.storage
          .from(GENERATED_CLIPS_BUCKET)
          .createSignedUrl(row.video_storage_path, GENERATED_CLIP_URL_TTL_SECONDS);

        if (!signed.error && signed.data?.signedUrl) {
          videoUrl = signed.data.signedUrl;
        } else {
          console.error(
            "[generated-clips] failed to create signed URL",
            row.id,
            signed.error?.message,
          );
        }
      }

      // Keep a valid absolute video_url as a fallback for older generated rows.
      if (
        !videoUrl &&
        row.video_url &&
        (row.video_url.startsWith("http://") || row.video_url.startsWith("https://"))
      ) {
        videoUrl = row.video_url;
      }

      return {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        durationSeconds: Number(row.duration_seconds),
        sourceStartSeconds: Number(row.source_start_seconds),
        category: row.category,
        confidence: row.confidence == null ? null : Number(row.confidence),
        thumbnailUrl: row.thumbnail_url,
        videoUrl,
        kept: row.kept,
      } satisfies ShortClip;
    }),
  );

  return clips;
}

export const projectQueries = {
  all: () => ({
    queryKey: ["projects"] as const,
    queryFn: () => videoProcessingService.listProjects(),
  }),
  detail: (projectId: string) => ({
    queryKey: ["project", projectId] as const,
    queryFn: () => videoProcessingService.getProject(projectId),
  }),
  analysis: (projectId: string) => ({
    queryKey: ["project", projectId, "analysis"] as const,
    queryFn: () => videoProcessingService.getProjectAnalysis(projectId),
  }),
  configuration: (projectId: string) => ({
    queryKey: ["project", projectId, "configuration"] as const,
    queryFn: () => videoProcessingService.getConfiguration(projectId),
  }),
  latestJob: (projectId: string) => ({
    queryKey: ["project", projectId, "job"] as const,
    queryFn: () => videoProcessingService.getLatestJob(projectId),
  }),
  clips: (projectId: string) => ({
    queryKey: ["project", projectId, "clips"] as const,
    queryFn: () => getGeneratedClipsWithPlayback(projectId),
  }),
  highlights: (projectId: string) => ({
    queryKey: ["project", projectId, "highlights"] as const,
    queryFn: () => videoProcessingService.getHighlightsVideo(projectId),
  }),
  longEdit: (projectId: string) => ({
    queryKey: ["project", projectId, "long-edit"] as const,
    queryFn: () => videoProcessingService.getEditedLongVideo(projectId),
  }),
  playbackUrl: (project: Project | undefined) => ({
    queryKey: ["playback", project?.id, project?.sourceStoragePath] as const,
    queryFn: () =>
      project ? videoProcessingService.getSourcePlaybackUrl(project) : Promise.resolve(null),
    enabled: Boolean(project?.sourceStoragePath),
  }),
};

export type { EditConfiguration };
