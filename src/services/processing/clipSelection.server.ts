/**
 * Real moment selection + Clip Intelligence for the "Cortes curtos" output.
 *
 * Two clearly separated responsibilities:
 *
 * 1. Selection — the model receives the timestamped transcript plus everything
 *    the user configured (context, content types, criteria, duration limits,
 *    speech priority) and returns candidate ranges with real timestamps.
 * 2. Evaluation — for every candidate the model scores the Clip Intelligence
 *    dimensions (hook, contexto, emoção, narrativa, retenção, expansão de
 *    alcance…) and justifies them in structured text.
 *
 * The final score and the selected set are computed locally by
 * `@/services/intelligence` (composition + ranking), so every number shown in
 * the UI is explainable and no "virality formula" is hidden inside a prompt.
 * Timestamps are always validated and clamped against the real timeline —
 * nothing is invented locally and nothing is simulated.
 */

import { chatJson } from "./gateway.server";
import type { AnalysisJobRequest } from "@/services/analysis/contracts";
import type { TranscriptSegment } from "./transcription.server";
import {
  CLIP_DIMENSIONS,
  clamp01,
  type ClipScoreComposition,
  type ClipScores,
} from "@/services/intelligence/clipIntelligence";
import {
  minimumClipCount,
  rankCandidates,
  type RankableCandidate,
} from "@/services/intelligence/ranking";

export interface ClipCandidate extends RankableCandidate {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  title: string;
  reason: string | null;
  criteria: string[];
  topic: string | null;
  category: string | null;
  hasSpeech: boolean;
  keywords: string[];
  /** Structured justification of the evaluation, written by the model. */
  explanation: string | null;
  /** How much context from the live the clip requires: low | medium | high. */
  contextRequirement: string | null;
  /** Model's own confidence in its evaluation (0–1). */
  analysisConfidence: number | null;
  diversityGroup: string | null;
  scores: Partial<ClipScores>;

  /* filled locally by the ranking pass */
  composition: ClipScoreComposition;
  clipScore: number;
  diversityPenalty: number;
  selected: boolean;
  selectionRank: number;
  selectionReason: string;
  topSignals: string[];
}

interface RawCandidate {
  start?: number;
  end?: number;
  title?: string;
  reason?: string;
  criteria?: string[];
  topic?: string;
  category?: string;
  diversityGroup?: string;
  keywords?: string[];
  hasSpeech?: boolean;
  contextRequirement?: string;
  confidence?: number;
  explanation?: string;
  scores?: Record<string, number>;
}

const SYSTEM_PROMPT =
  "Você é um editor de vídeo e analista de performance de conteúdo curto. " +
  "Você seleciona os melhores trechos de uma gravação longa e avalia cada trecho em várias dimensões. " +
  "Trabalhe apenas com os timestamps reais fornecidos na transcrição. " +
  "Nunca invente trechos fora do intervalo do vídeo e nunca invente falas. " +
  "Seja honesto: notas baixas são esperadas para trechos fracos. " +
  "Responda SOMENTE com JSON válido.";

function transcriptToText(segments: TranscriptSegment[]): string {
  return segments
    .map(
      (segment) =>
        `[${segment.startSeconds.toFixed(1)} - ${segment.endSeconds.toFixed(1)}] ${segment.text}`,
    )
    .join("\n");
}

/** The dimensions are described to the model from the single source of truth. */
function dimensionBriefing(): string {
  return CLIP_DIMENSIONS.map(
    (dimension) => `- ${dimension.key} (${dimension.label}): ${dimension.question}`,
  ).join("\n");
}

export async function selectShortClipCandidates(params: {
  request: AnalysisJobRequest;
  transcript: TranscriptSegment[];
  durationSeconds: number | null;
  /** Learned per-creator weights, when real performance data already exists. */
  weights?: Partial<Record<keyof ClipScores, number>> | undefined;
}): Promise<{ candidates: ClipCandidate[]; minimumClipCount: number; evaluatedCount: number }> {
  const { request, transcript, durationSeconds } = params;
  const output = request.outputs.shortClips;
  const minSeconds = output.minSeconds ?? 15;
  const maxSeconds = output.maxSeconds ?? 90;

  if (transcript.length === 0) {
    return { candidates: [], minimumClipCount: 0, evaluatedCount: 0 };
  }

  const timelineEnd =
    durationSeconds ?? Math.max(...transcript.map((segment) => segment.endSeconds), 0);

  const explicitQuantity =
    output.quantityMode !== "auto" && output.quantity ? output.quantity : null;
  const minimum = minimumClipCount(timelineEnd || durationSeconds, explicitQuantity);
  // Candidates are generated with slack so the ranking has real choices to make.
  const askFor = explicitQuantity ? Math.ceil(explicitQuantity * 1.8) : Math.ceil(minimum * 2);

  const instructions = [
    "Analise a transcrição com timestamps e selecione os melhores momentos para cortes curtos.",
    `Proponha aproximadamente ${askFor} candidatos (nunca menos de ${minimum}), incluindo opções alternativas, porque a seleção final é feita depois com base nas suas notas.`,
    `Cada corte deve durar entre ${minSeconds} e ${maxSeconds} segundos.`,
    `O vídeo termina em ${timelineEnd.toFixed(1)} segundos; nenhum corte pode passar desse limite.`,
    output.selectionCriteria.length
      ? `Priorize estes critérios do usuário: ${output.selectionCriteria.join(", ")}.`
      : "Priorize momentos com valor próprio, que funcionem fora de contexto.",
    output.avoidSimilar
      ? "Cubra momentos diferentes da gravação; use o campo diversityGroup para identificar cortes do mesmo tema."
      : "Cortes com temas parecidos são aceitáveis.",
    `Prioridade de fala: ${output.speechPriority}.`,
    request.context.contentTypes.length
      ? `Tipo de conteúdo: ${request.context.contentTypes.join(", ")}.`
      : "",
    request.context.mainActivity ? `Atividade principal: ${request.context.mainActivity}.` : "",
    request.context.description ? `Contexto do vídeo: ${request.context.description}` : "",
    request.context.additionalInstructions
      ? `Instruções adicionais: ${request.context.additionalInstructions}`
      : "",
    request.context.audioVideoFlags.length
      ? `Sinais importantes indicados: ${request.context.audioVideoFlags.join(", ")}.`
      : "",
    "Cada corte deve começar e terminar em fronteiras naturais de fala.",
    "",
    "Para CADA candidato, avalie estas dimensões com nota de 0 a 1 (use a escala inteira, não concentre tudo entre 0,7 e 0,9):",
    dimensionBriefing(),
    "",
    "Em 'explanation', justifique em 2 a 4 frases citando o que acontece no trecho e por que as notas altas e baixas foram dadas.",
    "Em 'contextRequirement', responda low, medium ou high conforme o quanto o espectador precisa conhecer da gravação.",
    "Em 'confidence', informe sua confiança na avaliação (0 a 1).",
    'Formato: {"clips":[{"start":<segundos>,"end":<segundos>,"title":"<título curto>","reason":"<por que este trecho>","explanation":"<justificativa das notas>","criteria":["<critério>"],"topic":"<tema>","category":"<categoria>","diversityGroup":"<tema para diversidade>","keywords":["<palavra>"],"hasSpeech":true,"contextRequirement":"low","confidence":0.8,"scores":{"hookScore":0.0,"contextScore":0.0,"emotionScore":0.0,"storyScore":0.0,"noveltyScore":0.0,"shareabilityScore":0.0,"commentPotentialScore":0.0,"retentionPotentialScore":0.0,"creatorFitScore":0.0,"platformFitScore":0.0,"growthPotentialScore":0.0}}]}',
    "",
    "TRANSCRIÇÃO:",
    transcriptToText(transcript),
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chatJson<{ clips?: RawCandidate[] }>({
    system: SYSTEM_PROMPT,
    parts: [{ type: "text", text: instructions }],
  });

  const parsed: Omit<
    ClipCandidate,
    | "composition"
    | "clipScore"
    | "diversityPenalty"
    | "selected"
    | "selectionRank"
    | "selectionReason"
    | "topSignals"
  >[] = [];

  for (const item of raw.clips ?? []) {
    const start = Math.max(0, Number(item.start ?? 0));
    const end = Math.min(timelineEnd || Number(item.end ?? 0), Number(item.end ?? 0));
    const duration = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0) continue;
    if (duration < Math.max(1, minSeconds * 0.5) || duration > maxSeconds * 1.5) continue;

    const scores: Partial<ClipScores> = {};
    for (const dimension of CLIP_DIMENSIONS) {
      const value = clamp01(item.scores?.[dimension.key]);
      if (value !== null) scores[dimension.key] = value;
    }

    parsed.push({
      startSeconds: start,
      endSeconds: end,
      durationSeconds: duration,
      title: (item.title ?? "").trim() || "Corte sem título",
      reason: item.reason?.trim() || null,
      explanation: item.explanation?.trim() || null,
      criteria: Array.isArray(item.criteria) ? item.criteria.filter(Boolean).slice(0, 6) : [],
      keywords: Array.isArray(item.keywords) ? item.keywords.filter(Boolean).slice(0, 10) : [],
      topic: item.topic?.trim() || null,
      category: item.category?.trim() || item.topic?.trim() || null,
      diversityGroup: item.diversityGroup?.trim() || item.topic?.trim() || null,
      hasSpeech: item.hasSpeech ?? true,
      contextRequirement: item.contextRequirement?.trim().toLowerCase() || null,
      analysisConfidence: clamp01(item.confidence),
      scores,
    });
  }

  const ranked = rankCandidates(parsed, {
    minimumClipCount: minimum,
    maximumClipCount: explicitQuantity ?? parsed.length,
    avoidSimilar: output.avoidSimilar,
    ...(params.weights ? { weights: params.weights } : {}),
  });

  const candidates: ClipCandidate[] = ranked.map((entry) => ({
    ...entry.candidate,
    diversityGroup: entry.diversityGroup,
    composition: entry.composition,
    clipScore: entry.composition.clipScore,
    diversityPenalty: entry.diversityPenalty,
    selected: entry.selected,
    selectionRank: entry.rank,
    selectionReason: entry.selectionReason,
    topSignals: entry.composition.topSignals,
  }));

  return { candidates, minimumClipCount: minimum, evaluatedCount: parsed.length };
}
