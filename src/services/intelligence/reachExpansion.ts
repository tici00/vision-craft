/**
 * Reach Expansion Intelligence (client-safe, pure).
 *
 * A clip can be excellent for the creator's existing audience and still be
 * unable to travel beyond it. This module separates the two questions using
 * dimensions that were already evaluated per candidate:
 *
 * - core appeal: how well the clip serves the people who already watch
 *   (creator fit + emotion + narrative);
 * - expansion potential: how well it works for someone who does not know the
 *   creator (context clarity + hook + novelty + shareability + growth);
 * - context barrier: how much prior knowledge the clip demands.
 *
 * Nothing is predicted about a platform's algorithm. Every number here is a
 * transparent combination of scores the model already justified, so the UI can
 * always answer "why?".
 */

import { clamp01, type ClipScores } from "./clipIntelligence";
import type { CreatorIntelligence } from "./creatorIntelligence";

export type ReachAudience = "core" | "balanced" | "expansion";

export interface ReachExpansionAssessment {
  /** 0–1 appeal to the audience the creator already has. */
  coreAppeal: number | null;
  /** 0–1 ability to reach people outside the usual audience. */
  expansionPotential: number | null;
  /** 0–1 how much the clip depends on knowing the live/creator (higher = worse). */
  contextBarrier: number | null;
  audience: ReachAudience | null;
  /** Concrete, data-derived reasons — never generic advice. */
  reasons: string[];
  /** Whether real creator history contributed to this reading. */
  usedCreatorHistory: boolean;
}

const AUDIENCE_LABEL: Record<ReachAudience, string> = {
  core: "Público atual",
  balanced: "Público atual + expansão",
  expansion: "Potencial de expansão",
};

export function reachAudienceLabel(audience: ReachAudience | null): string {
  return audience ? AUDIENCE_LABEL[audience] : "Sem avaliação";
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function assessReachExpansion(params: {
  scores: Partial<ClipScores>;
  contextRequirement?: string | null;
  durationSeconds?: number | null;
  creator?: CreatorIntelligence | null;
}): ReachExpansionAssessment {
  const { scores, contextRequirement, durationSeconds, creator } = params;
  const s = (key: keyof ClipScores) => clamp01(scores[key]);

  const coreAppeal = average([s("creatorFitScore"), s("emotionScore"), s("storyScore")]);

  const expansionRaw = average([
    s("contextScore"),
    s("hookScore"),
    s("noveltyScore"),
    s("shareabilityScore"),
    s("growthPotentialScore"),
  ]);

  const barrierFromRequirement =
    contextRequirement === "high" ? 0.85 : contextRequirement === "medium" ? 0.5 : contextRequirement === "low" ? 0.2 : null;
  const contextScore = s("contextScore");
  const contextBarrier =
    barrierFromRequirement !== null
      ? barrierFromRequirement
      : contextScore !== null
        ? 1 - contextScore
        : null;

  // A high context barrier caps how far a clip can travel, regardless of hook.
  const expansionPotential =
    expansionRaw === null
      ? null
      : Math.max(0, Math.min(1, expansionRaw * (1 - 0.5 * (contextBarrier ?? 0))));

  const reasons: string[] = [];
  if (contextBarrier !== null && contextBarrier >= 0.7) {
    reasons.push("Depende muito do contexto da gravação, o que limita quem está de fora.");
  }
  if (contextBarrier !== null && contextBarrier <= 0.3) {
    reasons.push("É compreensível sem conhecer a live, o que favorece novos espectadores.");
  }
  const hook = s("hookScore");
  if (hook !== null && hook >= 0.7) reasons.push("Abertura forte o suficiente para reter quem não conhece o criador.");
  if (hook !== null && hook <= 0.4) reasons.push("Abertura fraca: quem não conhece o criador tende a sair antes.");
  const share = s("shareabilityScore");
  if (share !== null && share >= 0.7) reasons.push("Tem motivo concreto de compartilhamento, o principal vetor de alcance novo.");
  const novelty = s("noveltyScore");
  if (novelty !== null && novelty <= 0.4) reasons.push("Pouca novidade: tende a agradar mais quem já acompanha.");
  if (durationSeconds && durationSeconds > 90) {
    reasons.push("Duração longa para vídeo curto, o que costuma reduzir o alcance fora do público fiel.");
  }

  let usedCreatorHistory = false;
  if (creator && creator.confidence > 0 && durationSeconds) {
    const bucketWinner = creator.bestDurations[0];
    if (bucketWinner && bucketWinner.relativePerformance > 1.1) {
      usedCreatorHistory = true;
      reasons.push(
        `No histórico real deste criador, cortes de ${bucketWinner.label} alcançam ${Math.round(
          bucketWinner.relativePerformance * 100,
        )}% da mediana de views.`,
      );
    }
  }

  const audience: ReachAudience | null =
    coreAppeal === null && expansionPotential === null
      ? null
      : (expansionPotential ?? 0) - (coreAppeal ?? 0) > 0.12
        ? "expansion"
        : (coreAppeal ?? 0) - (expansionPotential ?? 0) > 0.12
          ? "core"
          : "balanced";

  return {
    coreAppeal,
    expansionPotential,
    contextBarrier,
    audience,
    reasons: reasons.slice(0, 4),
    usedCreatorHistory,
  };
}
