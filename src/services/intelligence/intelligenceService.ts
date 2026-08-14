/**
 * Read layer for the intelligence data that the pipeline already persisted.
 *
 * It only reads: `clip_candidates` (Clip Intelligence, written by the real
 * analysis) and `clip_performance_observations` (real published results). No
 * value here is generated on the fly, and if a project has no analysis yet the
 * result is an empty list — never placeholder data.
 */

import { supabase } from "@/integrations/supabase/client";

import { clamp01, type ClipDimensionKey, type ClipScores } from "./clipIntelligence";
import { buildCreatorIntelligence, type CreatorIntelligence } from "./creatorIntelligence";
import type { ObservedPerformance } from "./performanceIntelligence";
import { assessReachExpansion, type ReachExpansionAssessment } from "./reachExpansion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const SCORE_COLUMNS: Record<ClipDimensionKey, string> = {
  hookScore: "hook_score",
  contextScore: "context_score",
  emotionScore: "emotion_score",
  storyScore: "story_score",
  noveltyScore: "novelty_score",
  shareabilityScore: "shareability_score",
  commentPotentialScore: "comment_potential_score",
  retentionPotentialScore: "retention_potential_score",
  creatorFitScore: "creator_fit_score",
  platformFitScore: "platform_fit_score",
  growthPotentialScore: "growth_potential_score",
};

export interface ClipIntelligenceEntry {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  topic: string | null;
  category: string | null;
  keywords: string[];
  explanation: string | null;
  reason: string | null;
  transcriptExcerpt: string | null;
  contextRequirement: string | null;
  analysisConfidence: number | null;
  clipScore: number | null;
  diversityPenalty: number | null;
  diversityGroup: string | null;
  selected: boolean;
  selectionRank: number | null;
  selectionReason: string | null;
  topSignals: string[];
  intelligenceVersion: string | null;
  scores: Partial<ClipScores>;
  reach: ReachExpansionAssessment;
}

export interface ProjectIntelligence {
  candidates: ClipIntelligenceEntry[];
  selectedCount: number;
  creator: CreatorIntelligence;
  observations: ObservedPerformance[];
}

function mapObservation(row: Row): ObservedPerformance {
  return {
    id: row.id,
    clipId: row.clip_id ?? null,
    platform: row.platform,
    publicationUrl: row.publication_url ?? null,
    publishedAt: row.published_at ?? null,
    caption: row.caption ?? null,
    hashtags: (row.hashtags ?? []) as string[],
    format: row.format ?? null,
    clipDurationSeconds: row.clip_duration_seconds === null ? null : Number(row.clip_duration_seconds),
    views: row.views === null ? null : Number(row.views),
    likes: row.likes === null ? null : Number(row.likes),
    comments: row.comments === null ? null : Number(row.comments),
    shares: row.shares === null ? null : Number(row.shares),
    saves: row.saves === null ? null : Number(row.saves),
    averageWatchSeconds:
      row.average_watch_seconds === null ? null : Number(row.average_watch_seconds),
    retentionRate: row.retention_rate === null ? null : Number(row.retention_rate),
    completionRate: row.completion_rate === null ? null : Number(row.completion_rate),
    growthTimeline: (row.growth_timeline ?? []) as Record<string, unknown>[],
    observedScore: row.observed_score === null ? null : Number(row.observed_score),
    source: row.source ?? "manual",
    measuredAt: row.measured_at ?? null,
  };
}

export const intelligenceService = {
  async getProjectIntelligence(projectId: string): Promise<ProjectIntelligence> {
    const [candidatesResult, observationsResult] = await Promise.all([
      supabase
        .from("clip_candidates")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true }),
      supabase
        .from("clip_performance_observations")
        .select("*")
        .eq("project_id", projectId)
        .order("published_at", { ascending: false }),
    ]);

    if (candidatesResult.error) throw new Error(candidatesResult.error.message);
    if (observationsResult.error) throw new Error(observationsResult.error.message);

    const observations = (observationsResult.data ?? []).map(mapObservation);
    const creator = buildCreatorIntelligence({ creatorKey: projectId, observations });

    const candidates = (candidatesResult.data ?? []).map((row: Row): ClipIntelligenceEntry => {
      const scores: Partial<ClipScores> = {};
      for (const [key, column] of Object.entries(SCORE_COLUMNS) as [ClipDimensionKey, string][]) {
        const value = clamp01(row[column]);
        if (value !== null) scores[key] = value;
      }

      const durationSeconds = Number(row.duration_seconds ?? 0);
      return {
        id: row.id,
        title: row.title,
        startSeconds: Number(row.start_seconds ?? 0),
        endSeconds: Number(row.end_seconds ?? 0),
        durationSeconds,
        topic: row.topic ?? null,
        category: row.category ?? null,
        keywords: (row.keywords ?? []) as string[],
        explanation: row.explanation ?? null,
        reason: row.reason ?? null,
        transcriptExcerpt: row.transcript_excerpt ?? null,
        contextRequirement: row.context_requirement ?? null,
        analysisConfidence: clamp01(row.analysis_confidence),
        clipScore: clamp01(row.clip_score),
        diversityPenalty: row.diversity_penalty === null ? null : Number(row.diversity_penalty),
        diversityGroup: row.diversity_group ?? null,
        selected: Boolean(row.selected),
        selectionRank: row.selection_rank === null ? null : Number(row.selection_rank),
        selectionReason: row.selection_reason ?? null,
        topSignals: (row.top_signals ?? []) as string[],
        intelligenceVersion: row.intelligence_version ?? null,
        scores,
        reach: assessReachExpansion({
          scores,
          contextRequirement: row.context_requirement ?? null,
          durationSeconds,
          creator,
        }),
      };
    });

    return {
      candidates,
      selectedCount: candidates.filter((candidate) => candidate.selected).length,
      creator,
      observations,
    };
  },
};

export const intelligenceQueries = {
  project: (projectId: string) => ({
    queryKey: ["project", projectId, "intelligence"] as const,
    queryFn: () => intelligenceService.getProjectIntelligence(projectId),
  }),
};
