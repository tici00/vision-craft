/**
 * Candidate ranking (client-safe, pure functions).
 *
 * Ranking is deliberately separate from the model call: the AI evaluates each
 * moment independently, and this module decides which of those moments become
 * clips. That keeps the trade-off between *quality* and *diversity* inspectable
 * and testable without any network access.
 *
 * Rules encoded here:
 * - A minimum number of clips is always honoured when there is material for it,
 *   filling with the best remaining candidates even if they are below the ideal
 *   bar (each one records why it was included).
 * - Beyond the minimum, only genuinely strong candidates are added.
 * - Repetition of the same topic/emotion is penalised progressively, so the
 *   final set covers different moments of the live instead of five variations of
 *   the same joke.
 */

import {
  EXTRA_CLIP_THRESHOLD,
  QUALITY_THRESHOLD,
  composeClipScore,
  type ClipScoreComposition,
  type ClipScores,
} from "./clipIntelligence";

export interface RankableCandidate {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  scores: Partial<ClipScores>;
  /** Topic/emotion bucket used for diversity control. */
  diversityGroup: string | null;
  topic: string | null;
}

export interface RankedCandidate<T extends RankableCandidate> {
  candidate: T;
  rank: number;
  selected: boolean;
  composition: ClipScoreComposition;
  diversityPenalty: number;
  diversityGroup: string;
  selectionReason: string;
}

export interface RankingOptions {
  /** Clips the project must deliver whenever material exists. */
  minimumClipCount: number;
  /** Hard cap (explicit user quantity, or the number of candidates). */
  maximumClipCount: number;
  /** User asked to avoid similar clips. */
  avoidSimilar: boolean;
  weights?: Record<string, number>;
}

/** Diversity penalty applied to the Nth clip of an already-used group. */
const GROUP_PENALTY = [0, 0.08, 0.18, 0.3];

function groupOf(candidate: RankableCandidate): string {
  const raw = candidate.diversityGroup ?? candidate.topic;
  return (raw ?? "geral").trim().toLowerCase() || "geral";
}

function overlaps(a: RankableCandidate, b: RankableCandidate): boolean {
  return a.startSeconds < b.endSeconds && b.startSeconds < a.endSeconds;
}

/**
 * Derives the minimum number of clips for a source. Long recordings must not
 * yield two clips just because the model was conservative.
 */
export function minimumClipCount(
  durationSeconds: number | null,
  explicitQuantity: number | null,
): number {
  if (explicitQuantity && explicitQuantity > 0) return explicitQuantity;
  if (!durationSeconds || durationSeconds <= 0) return 3;
  const minutes = durationSeconds / 60;
  if (minutes <= 10) return 2;
  if (minutes <= 30) return 4;
  if (minutes <= 60) return 6;
  if (minutes <= 180) return 10;
  return Math.min(30, Math.round(minutes / 18));
}

/**
 * Ranks candidates balancing intrinsic quality and diversity, then marks which
 * ones are selected. Overlapping ranges are never selected twice.
 */
export function rankCandidates<T extends RankableCandidate>(
  candidates: T[],
  options: RankingOptions,
): RankedCandidate<T>[] {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      composition: composeClipScore(candidate.scores, { weights: options.weights }),
      group: groupOf(candidate),
    }))
    .sort((a, b) => b.composition.intrinsicScore - a.composition.intrinsicScore);

  const groupUsage = new Map<string, number>();
  const selected: T[] = [];
  const results: RankedCandidate<T>[] = [];

  // Pass 1: strong, diverse candidates.
  for (const entry of scored) {
    const used = groupUsage.get(entry.group) ?? 0;
    const penalty = options.avoidSimilar
      ? (GROUP_PENALTY[Math.min(used, GROUP_PENALTY.length - 1)] ?? 0.3)
      : 0;
    const composition = composeClipScore(entry.candidate.scores, {
      weights: options.weights,
      diversityPenalty: penalty,
    });

    const conflicting = selected.some((other) => overlaps(entry.candidate, other));
    const bar = selected.length < options.minimumClipCount ? QUALITY_THRESHOLD : EXTRA_CLIP_THRESHOLD;
    const canSelect =
      !conflicting && selected.length < options.maximumClipCount && composition.clipScore >= bar;

    if (canSelect) {
      selected.push(entry.candidate);
      groupUsage.set(entry.group, used + 1);
    }

    results.push({
      candidate: entry.candidate,
      rank: 0,
      selected: canSelect,
      composition,
      diversityPenalty: penalty,
      diversityGroup: entry.group,
      selectionReason: canSelect
        ? penalty > 0
          ? `Selecionado por qualidade (${Math.round(composition.clipScore * 100)}) mesmo com tema repetido.`
          : `Selecionado por qualidade (${Math.round(composition.clipScore * 100)}) e por trazer um tema novo.`
        : conflicting
          ? "Descartado: sobrepõe um corte melhor já selecionado."
          : composition.clipScore < bar
            ? `Abaixo do mínimo de qualidade (${Math.round(composition.clipScore * 100)} < ${Math.round(bar * 100)}).`
            : "Limite de cortes já alcançado.",
    });
  }

  // Pass 2: honour the minimum count with the best remaining candidates.
  if (selected.length < options.minimumClipCount) {
    const remaining = results
      .filter((entry) => !entry.selected)
      .sort((a, b) => b.composition.clipScore - a.composition.clipScore);
    for (const entry of remaining) {
      if (selected.length >= Math.min(options.minimumClipCount, options.maximumClipCount)) break;
      if (selected.some((other) => overlaps(entry.candidate, other))) continue;
      selected.push(entry.candidate);
      entry.selected = true;
      entry.selectionReason = `Incluído para atingir o mínimo de ${options.minimumClipCount} corte(s); qualidade ${Math.round(
        entry.composition.clipScore * 100,
      )}.`;
    }
  }

  return results
    .sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return b.composition.clipScore - a.composition.clipScore;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
