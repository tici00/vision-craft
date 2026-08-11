/**
 * Real moment selection for the "Cortes curtos" output.
 *
 * The model receives the timestamped transcript plus everything the user
 * configured (context, content types, criteria, duration limits, speech
 * priority) and returns candidate ranges with real timestamps, a title, the
 * reason it was chosen and a relevance score. Results are then validated and
 * clamped against the transcript/video timeline — nothing is invented locally.
 */

import { chatJson } from "./gateway.server";
import type { AnalysisJobRequest } from "@/services/analysis/contracts";
import type { TranscriptSegment } from "./transcription.server";

export interface ClipCandidate {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  title: string;
  reason: string | null;
  criteria: string[];
  topic: string | null;
  hasSpeech: boolean;
  score: number | null;
}

interface RawCandidate {
  start?: number;
  end?: number;
  title?: string;
  reason?: string;
  criteria?: string[];
  topic?: string;
  hasSpeech?: boolean;
  score?: number;
}

const SYSTEM_PROMPT =
  "Você é um editor de vídeo que seleciona os melhores trechos para cortes curtos. " +
  "Trabalhe apenas com os timestamps reais fornecidos na transcrição. " +
  "Nunca invente trechos fora do intervalo do vídeo e nunca invente falas. " +
  "Responda SOMENTE com JSON válido.";

function transcriptToText(segments: TranscriptSegment[]): string {
  return segments
    .map(
      (segment) =>
        `[${segment.startSeconds.toFixed(1)} - ${segment.endSeconds.toFixed(1)}] ${segment.text}`,
    )
    .join("\n");
}

function targetQuantity(request: AnalysisJobRequest, durationSeconds: number | null): string {
  const output = request.outputs.shortClips;
  if (output.quantityMode !== "auto" && output.quantity) {
    return `Selecione exatamente ${output.quantity} cortes, se houver material suficiente.`;
  }
  const minutes = durationSeconds ? durationSeconds / 60 : null;
  const suggested = minutes ? Math.max(3, Math.min(20, Math.round(minutes / 4))) : 6;
  return `Decida a quantidade pelo conteúdo (aproximadamente ${suggested} cortes) e descarte trechos fracos.`;
}

export async function selectShortClipCandidates(params: {
  request: AnalysisJobRequest;
  transcript: TranscriptSegment[];
  durationSeconds: number | null;
}): Promise<ClipCandidate[]> {
  const { request, transcript, durationSeconds } = params;
  const output = request.outputs.shortClips;
  const minSeconds = output.minSeconds ?? 15;
  const maxSeconds = output.maxSeconds ?? 90;

  if (transcript.length === 0) return [];

  const timelineEnd =
    durationSeconds ?? Math.max(...transcript.map((segment) => segment.endSeconds), 0);

  const instructions = [
    "Analise a transcrição com timestamps e selecione os melhores momentos para cortes curtos.",
    targetQuantity(request, durationSeconds),
    `Cada corte deve durar entre ${minSeconds} e ${maxSeconds} segundos.`,
    `O vídeo termina em ${timelineEnd.toFixed(1)} segundos; nenhum corte pode passar desse limite.`,
    output.selectionCriteria.length
      ? `Priorize estes critérios do usuário: ${output.selectionCriteria.join(", ")}.`
      : "Priorize momentos com valor próprio, que funcionem fora de contexto.",
    output.avoidSimilar
      ? "Evite cortes redundantes ou muito parecidos entre si."
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
    'Formato: {"clips":[{"start":<segundos>,"end":<segundos>,"title":"<título curto>","reason":"<por que este trecho>","criteria":["<critério>"],"topic":"<tema>","hasSpeech":true,"score":<0 a 1>}]}',
    "Ordene por relevância decrescente.",
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

  const candidates: ClipCandidate[] = [];
  for (const item of raw.clips ?? []) {
    const start = Math.max(0, Number(item.start ?? 0));
    const end = Math.min(timelineEnd || Number(item.end ?? 0), Number(item.end ?? 0));
    const duration = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0) continue;
    if (duration < Math.max(1, minSeconds * 0.5) || duration > maxSeconds * 1.5) continue;

    candidates.push({
      startSeconds: start,
      endSeconds: end,
      durationSeconds: duration,
      title: (item.title ?? "").trim() || "Corte sem título",
      reason: item.reason?.trim() || null,
      criteria: Array.isArray(item.criteria) ? item.criteria.filter(Boolean).slice(0, 6) : [],
      topic: item.topic?.trim() || null,
      hasSpeech: item.hasSpeech ?? true,
      score:
        item.score == null ? null : Math.max(0, Math.min(1, Number(item.score))) || null,
    });
  }

  const deduped = candidates
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .filter((candidate, index, list) =>
      list
        .slice(0, index)
        .every(
          (other) =>
            candidate.startSeconds >= other.endSeconds || candidate.endSeconds <= other.startSeconds,
        ),
    );

  const limit =
    output.quantityMode !== "auto" && output.quantity ? output.quantity : deduped.length;
  return deduped.slice(0, limit).sort((a, b) => a.startSeconds - b.startSeconds);
}
