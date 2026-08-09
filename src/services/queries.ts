import { videoProcessingService } from "@/services/videoProcessingService";
import type { Project, EditConfiguration } from "@/types/video-editor";

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
    queryFn: () => videoProcessingService.getGeneratedClips(projectId),
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
