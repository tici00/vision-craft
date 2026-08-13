/**
 * Clip Intelligence — model definition (client-safe).
 *
 * This module owns *what* is evaluated and *how* the dimensions combine into a
 * final score. It contains no prompts and no HTTP calls, so both the server
 * pipeline and the UI describe scores with exactly the same vocabulary.
 *
 * Design rules:
 * - Every dimension is an independent signal in the 0–1 range. Nothing here is
 *   a copied "virality formula": the dimensions describe *why* a moment tends
 *   to perform, and the weights are data, not hard-coded logic.
 * - The final score is decomposable: `composeClipScore` returns the weighted
 *   contribution of every dimension plus the diversity penalty, so any number
 *   shown in the UI can be explained.
 * - Weights can be recalibrated later (per creator, per platform, or from real
 *   observed performance) without touching the pipeline.
 */

export const CLIP_INTELLIGENCE_VERSION = "clip-intelligence-1";

export type ClipDimensionKey =
  | "hookScore"
  | "contextScore"
  | "emotionScore"
  | "storyScore"
  | "noveltyScore"
  | "shareabilityScore"
  | "commentPotentialScore"
  | "retentionPotentialScore"
  | "creatorFitScore"
  | "platformFitScore"
  | "growthPotentialScore";

export interface ClipDimension {
  key: ClipDimensionKey;
  /** Column name in `clip_candidates`. */
  column: string;
  label: string;
  /** What the signal asks about the moment — also used to brief the model. */
  question: string;
  /** Default weight in the final composition (relative, normalised at runtime). */
  weight: number;
}

export const CLIP_DIMENSIONS: ClipDimension[] = [
  {
    key: "hookScore",
    column: "hook_score",
    label: "Hook",
    question:
      "Existe um motivo forte nos primeiros segundos para a pessoa continuar assistindo?",
    weight: 1.4,
  },
  {
    key: "retentionPotentialScore",
    column: "retention_potential_score",
    label: "Retenção",
    question:
      "O momento cria curiosidade, expectativa, surpresa ou progressão que sustenta a atenção até o fim?",
    weight: 1.3,
  },
  {
    key: "contextScore",
    column: "context_score",
    label: "Clareza / contexto",
    question:
      "O corte é compreensível para quem não assistiu à live, sem exigir conhecimento excessivo?",
    weight: 1.2,
  },
  {
    key: "emotionScore",
    column: "emotion_score",
    label: "Emoção",
    question:
      "Existe reação emocional genuína (surpresa, humor, tensão, conquista, frustração, identificação, admiração)?",
    weight: 1.1,
  },
  {
    key: "storyScore",
    column: "story_score",
    label: "Narrativa",
    question: "Existe começo, desenvolvimento e payoff dentro do próprio corte?",
    weight: 1.0,
  },
  {
    key: "noveltyScore",
    column: "novelty_score",
    label: "Novidade",
    question: "Existe algo inesperado, incomum ou genuinamente interessante?",
    weight: 0.9,
  },
  {
    key: "shareabilityScore",
    column: "shareability_score",
    label: "Compartilhamento",
    question: "Existe um motivo concreto para alguém enviar esse vídeo para outra pessoa?",
    weight: 0.9,
  },
  {
    key: "commentPotentialScore",
    column: "comment_potential_score",
    label: "Conversa",
    question: "O momento estimula naturalmente comentários, opiniões ou identificação?",
    weight: 0.7,
  },
  {
    key: "creatorFitScore",
    column: "creator_fit_score",
    label: "Identidade do criador",
    question:
      "O corte representa bem a personalidade, o estilo e o conteúdo desse criador, segundo o contexto informado?",
    weight: 0.8,
  },
  {
    key: "platformFitScore",
    column: "platform_fit_score",
    label: "Formato / plataforma",
    question:
      "O momento tem características (ritmo, duração, enquadramento da fala) que funcionam bem em vídeo curto vertical?",
    weight: 0.7,
  },
  {
    key: "growthPotentialScore",
    column: "growth_potential_score",
    label: "Potencial de expansão",
    question:
      "Além de agradar o público habitual, o corte tem características capazes de alcançar pessoas fora desse público?",
    weight: 1.1,
  },
];

export const CLIP_DIMENSION_BY_KEY: Record<ClipDimensionKey, ClipDimension> = Object.fromEntries(
  CLIP_DIMENSIONS.map((dimension) => [dimension.key, dimension]),
) as Record<ClipDimensionKey, ClipDimension>;

export type ClipScores = Record<ClipDimensionKey, number | null>;

export interface ClipScoreContribution {
  key: ClipDimensionKey;
  label: string;
  score: number;
  weight: number;
  /** Share of the final score explained by this dimension (0–1). */
  contribution: number;
}

export interface ClipScoreComposition {
  /** Final, explainable score in 0–1. */
  clipScore: number;
  /** Score before the diversity penalty is applied. */
  intrinsicScore: number;
  diversityPenalty: number;
  contributions: ClipScoreContribution[];
  /** Dimensions that pulled the score up the most. */
  topSignals: string[];
  /** Dimensions that clearly held the score back. */
  weakSignals: string[];
  version: string;
  weights: Record<string, number>;
}

/** Minimum final score for a clip to be considered high quality. */
export const QUALITY_THRESHOLD = 0.62;
/** Extra clips beyond the minimum are only produced above this bar. */
export const EXTRA_CLIP_THRESHOLD = 0.72;

export function clamp01(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return null;
  const normalised = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, normalised));
}

/**
 * Combines the dimensions into a final score. Missing dimensions are simply
 * left out of the weighting instead of being guessed, so a partial evaluation
 * still yields an honest (and explainable) number.
 */
export function composeClipScore(
  scores: Partial<ClipScores>,
  options: {
    weights?: Partial<Record<ClipDimensionKey, number>>;
    diversityPenalty?: number;
  } = {},
): ClipScoreComposition {
  const weights: Record<string, number> = {};
  const present = CLIP_DIMENSIONS.map((dimension) => {
    const score = clamp01(scores[dimension.key]);
    const weight = options.weights?.[dimension.key] ?? dimension.weight;
    weights[dimension.key] = weight;
    return { dimension, score, weight };
  }).filter((entry): entry is { dimension: ClipDimension; score: number; weight: number } =>
    entry.score !== null,
  );

  const totalWeight = present.reduce((sum, entry) => sum + entry.weight, 0);
  const intrinsic =
    totalWeight > 0
      ? present.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight
      : 0;

  const contributions: ClipScoreContribution[] = present
    .map((entry) => ({
      key: entry.dimension.key,
      label: entry.dimension.label,
      score: entry.score,
      weight: entry.weight,
      contribution: totalWeight > 0 ? (entry.score * entry.weight) / totalWeight : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const diversityPenalty = Math.max(0, Math.min(0.5, options.diversityPenalty ?? 0));
  const clipScore = Math.max(0, Math.min(1, intrinsic * (1 - diversityPenalty)));

  return {
    clipScore,
    intrinsicScore: intrinsic,
    diversityPenalty,
    contributions,
    topSignals: contributions
      .filter((entry) => entry.score >= 0.7)
      .slice(0, 4)
      .map((entry) => entry.label),
    weakSignals: contributions
      .filter((entry) => entry.score <= 0.4)
      .slice(-3)
      .map((entry) => entry.label),
    version: CLIP_INTELLIGENCE_VERSION,
    weights,
  };
}
