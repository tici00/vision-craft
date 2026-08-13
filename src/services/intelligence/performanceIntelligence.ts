/**
 * Performance Intelligence — architecture only (client-safe).
 *
 * Vision Craft keeps four clearly separated knowledge sources, so that a
 * prediction is never confused with a real result:
 *
 * 1. General Performance Intelligence — general knowledge about characteristics
 *    associated with good performance (currently expressed by the Clip
 *    Intelligence dimensions and their default weights).
 * 2. Creator Performance Intelligence — real historical data of that creator,
 *    stored in `creator_performance_profiles`. Empty until real data arrives.
 * 3. Current Content Intelligence — signals extracted from the current
 *    live/clip, stored on `clip_candidates`.
 * 4. Growth Opportunity — the `growthPotentialScore` dimension: reach beyond
 *    the creator's usual audience.
 *
 * Predicted performance lives in `clip_performance_predictions`; observed
 * performance lives in `clip_performance_observations`. The two are never
 * merged: comparing them is what will train future calibration.
 *
 * No social-network integration exists yet. Nothing here invents metrics.
 */

import type { ClipScoreComposition } from "./clipIntelligence";

export type IntelligenceSource =
  | "general_performance"
  | "creator_performance"
  | "current_content"
  | "growth_opportunity";

export const INTELLIGENCE_SOURCE_LABEL: Record<IntelligenceSource, string> = {
  general_performance: "Conhecimento geral de performance",
  creator_performance: "Histórico real do criador",
  current_content: "Características do conteúdo atual",
  growth_opportunity: "Oportunidade de expansão de alcance",
};

export type Platform = "tiktok" | "instagram" | "youtube" | "other";

/** What the AI expected — recorded before publication, never overwritten. */
export interface PredictedPerformance {
  platform: Platform | null;
  format: string | null;
  predictedClipScore: number | null;
  predictedGrowthScore: number | null;
  predictedRetention: number | null;
  predictedShareability: number | null;
  predictedCommentPotential: number | null;
  breakdown: ClipScoreComposition | null;
  model: string | null;
  intelligenceVersion: string | null;
  createdAt: string | null;
}

/** What really happened — only ever written from real, measured data. */
export interface ObservedPerformance {
  id: string;
  clipId: string | null;
  platform: Platform | string;
  publicationUrl: string | null;
  publishedAt: string | null;
  caption: string | null;
  hashtags: string[];
  format: string | null;
  clipDurationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  averageWatchSeconds: number | null;
  retentionRate: number | null;
  completionRate: number | null;
  /** Snapshots over time: [{ at, views, likes, ... }]. */
  growthTimeline: Record<string, unknown>[];
  observedScore: number | null;
  /** "manual" today; a platform id once integrations exist. */
  source: string;
  measuredAt: string | null;
}

/** Learned only from observed data; stays empty while no real data exists. */
export interface CreatorPerformanceProfile {
  creatorKey: string;
  displayName: string | null;
  clipTypes: Record<string, unknown>;
  topics: Record<string, unknown>;
  durations: Record<string, unknown>;
  hookStyles: Record<string, unknown>;
  emotions: Record<string, unknown>;
  formats: Record<string, unknown>;
  platforms: Record<string, unknown>;
  postingTimes: Record<string, unknown>;
  captionPatterns: Record<string, unknown>;
  retentionPatterns: Record<string, unknown>;
  sharePatterns: Record<string, unknown>;
  commentPatterns: Record<string, unknown>;
  topContent: Record<string, unknown>[];
  sampleSize: number;
  lastComputedAt: string | null;
}

export interface PredictionVsReality {
  clipId: string;
  predicted: PredictedPerformance | null;
  observed: ObservedPerformance[];
  /** Only computable once at least one observation exists. */
  delta: number | null;
}

/**
 * Weight calibration hook. Today it returns the general weights untouched; once
 * a creator profile has real observations, it can bias the dimensions without
 * any change to the pipeline or the UI.
 */
export function calibrateWeights(profile: CreatorPerformanceProfile | null): {
  weights: Record<string, number> | undefined;
  sourcesUsed: IntelligenceSource[];
} {
  if (!profile || profile.sampleSize <= 0) {
    return {
      weights: undefined,
      sourcesUsed: ["general_performance", "current_content", "growth_opportunity"],
    };
  }
  const learned = (profile.clipTypes as { weights?: Record<string, number> })?.weights;
  return {
    weights: learned && Object.keys(learned).length > 0 ? learned : undefined,
    sourcesUsed: [
      "general_performance",
      "creator_performance",
      "current_content",
      "growth_opportunity",
    ],
  };
}
