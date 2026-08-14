/**
 * Creator Intelligence — first real layer (client-safe, pure).
 *
 * This module learns ONLY from observed performance
 * (`clip_performance_observations`). It never invents data: with no real
 * observations the profile is explicitly empty and its confidence is 0, so the
 * UI can say "ainda não há histórico" instead of showing a fabricated pattern.
 *
 * The output is deliberately small and explainable:
 * - patterns: what really performed well for this creator so far;
 * - weights: how much each Clip Intelligence dimension should be nudged for
 *   this creator (only applied once the sample is large enough);
 * - familiarity: how much of the audience reached is the usual audience, used
 *   by Reach Expansion Intelligence.
 */

import { CLIP_DIMENSIONS, type ClipDimensionKey } from "./clipIntelligence";
import type { ObservedPerformance } from "./performanceIntelligence";

/** Below this number of observations nothing is treated as a learned pattern. */
export const CREATOR_MIN_SAMPLE = 5;
/** Full trust in the learned weights only after this many observations. */
export const CREATOR_FULL_SAMPLE = 30;

export interface CreatorPattern {
  key: string;
  label: string;
  /** Number of observations backing this pattern. */
  sampleSize: number;
  /** Median observed reach of this bucket, relative to the creator baseline. */
  relativePerformance: number;
}

export interface CreatorIntelligence {
  creatorKey: string;
  sampleSize: number;
  /** 0–1: how much any conclusion here can be trusted. */
  confidence: number;
  /** Median views across all observations, or null with no data. */
  baselineViews: number | null;
  bestDurations: CreatorPattern[];
  bestTopics: CreatorPattern[];
  bestPlatforms: CreatorPattern[];
  /** Per-dimension multipliers to apply to the default Clip Intelligence weights. */
  weights: Partial<Record<ClipDimensionKey, number>> | undefined;
  /** Human-readable summary built from the data above; never speculative. */
  summary: string;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function durationBucket(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 20) return "até 20s";
  if (seconds < 35) return "20–35s";
  if (seconds < 60) return "35–60s";
  if (seconds < 90) return "60–90s";
  return "acima de 90s";
}

function buildPatterns(
  entries: { key: string; views: number }[],
  baseline: number,
): CreatorPattern[] {
  const grouped = new Map<string, number[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.key) ?? [];
    list.push(entry.views);
    grouped.set(entry.key, list);
  }
  return [...grouped.entries()]
    .map(([key, views]) => ({
      key,
      label: key,
      sampleSize: views.length,
      relativePerformance: baseline > 0 ? (median(views) ?? 0) / baseline : 0,
    }))
    .filter((pattern) => pattern.sampleSize >= 2)
    .sort((a, b) => b.relativePerformance - a.relativePerformance)
    .slice(0, 4);
}

/**
 * Derives weight multipliers from the correlation between a dimension-like
 * observed signal and reach. Only signals actually measured on the platform
 * (retention, shares, comments) can influence weights — the rest keep the
 * general defaults.
 */
function learnWeights(
  observations: ObservedPerformance[],
  confidence: number,
): Partial<Record<ClipDimensionKey, number>> | undefined {
  if (confidence <= 0) return undefined;

  const withViews = observations.filter((entry) => (entry.views ?? 0) > 0);
  if (withViews.length < CREATOR_MIN_SAMPLE) return undefined;

  const baseline = median(withViews.map((entry) => entry.views ?? 0)) ?? 0;
  if (baseline <= 0) return undefined;

  const overperformers = withViews.filter((entry) => (entry.views ?? 0) >= baseline);

  const signal = (pick: (entry: ObservedPerformance) => number | null): number | null => {
    const all = withViews.map(pick).filter((value): value is number => value !== null);
    const top = overperformers.map(pick).filter((value): value is number => value !== null);
    if (all.length < CREATOR_MIN_SAMPLE || top.length < 2) return null;
    const allMedian = median(all) ?? 0;
    if (allMedian <= 0) return null;
    return (median(top) ?? 0) / allMedian;
  };

  const ratios: Partial<Record<ClipDimensionKey, number>> = {};
  const apply = (key: ClipDimensionKey, ratio: number | null) => {
    if (ratio === null || !Number.isFinite(ratio)) return;
    const base = CLIP_DIMENSIONS.find((dimension) => dimension.key === key)?.weight ?? 1;
    // The learned lift is damped by confidence and capped at ±40%.
    const lift = Math.max(-0.4, Math.min(0.4, (ratio - 1) * confidence));
    ratios[key] = Number((base * (1 + lift)).toFixed(3));
  };

  apply(
    "retentionPotentialScore",
    signal((entry) => entry.retentionRate ?? entry.completionRate),
  );
  apply(
    "shareabilityScore",
    signal((entry) => (entry.views ? ((entry.shares ?? 0) / entry.views) * 100 : null)),
  );
  apply(
    "commentPotentialScore",
    signal((entry) => (entry.views ? ((entry.comments ?? 0) / entry.views) * 100 : null)),
  );

  return Object.keys(ratios).length > 0 ? ratios : undefined;
}

export function buildCreatorIntelligence(params: {
  creatorKey: string;
  observations: ObservedPerformance[];
}): CreatorIntelligence {
  const { creatorKey, observations } = params;
  const sampleSize = observations.length;
  const confidence =
    sampleSize <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (sampleSize - CREATOR_MIN_SAMPLE + 1) / (CREATOR_FULL_SAMPLE - CREATOR_MIN_SAMPLE + 1),
          ),
        );

  const baselineViews = median(
    observations.map((entry) => entry.views ?? 0).filter((views) => views > 0),
  );

  const usable = confidence > 0 && baselineViews !== null && baselineViews > 0;

  const durationEntries = usable
    ? observations.flatMap((entry) => {
        const bucket = durationBucket(entry.clipDurationSeconds);
        return bucket && entry.views ? [{ key: bucket, views: entry.views }] : [];
      })
    : [];

  const platformEntries = usable
    ? observations.flatMap((entry) => (entry.views ? [{ key: entry.platform, views: entry.views }] : []))
    : [];

  const topicEntries = usable
    ? observations.flatMap((entry) =>
        entry.hashtags.length && entry.views
          ? entry.hashtags.slice(0, 3).map((tag) => ({ key: tag, views: entry.views as number }))
          : [],
      )
    : [];

  const bestDurations = buildPatterns(durationEntries, baselineViews ?? 0);
  const bestPlatforms = buildPatterns(platformEntries, baselineViews ?? 0);
  const bestTopics = buildPatterns(topicEntries, baselineViews ?? 0);

  const summary =
    sampleSize === 0
      ? "Nenhum resultado real registrado ainda. As previsões usam apenas o conhecimento geral de performance."
      : confidence === 0
        ? `${sampleSize} publicação(ões) registrada(s). São necessárias ${CREATOR_MIN_SAMPLE} para começar a aprender padrões deste criador.`
        : `Padrões aprendidos com ${sampleSize} publicação(ões) reais (confiança ${Math.round(
            confidence * 100,
          )}%).`;

  return {
    creatorKey,
    sampleSize,
    confidence,
    baselineViews,
    bestDurations,
    bestTopics,
    bestPlatforms,
    weights: learnWeights(observations, confidence),
    summary,
  };
}
