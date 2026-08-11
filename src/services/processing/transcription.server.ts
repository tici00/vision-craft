/**
 * Real timestamped transcription.
 *
 * The audio (or the original short video, which carries its audio track) is
 * sent to a multimodal model that returns speech segments with real start/end
 * timestamps. Timestamps from chunked audio are offset back onto the source
 * timeline, so every returned second refers to the original recording.
 */

import { chatJson, type ContentPart } from "./gateway.server";
import { fetchInlineMedia, type AudioChunk } from "./media.server";

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TranscriptionResult {
  language: string | null;
  segments: TranscriptSegment[];
  text: string;
  transcribedSeconds: number;
}

interface RawTranscription {
  language?: string | null;
  segments?: { start?: number; end?: number; text?: string }[];
}

const SYSTEM_PROMPT =
  "Você transcreve mídia com precisão de tempo. Responda SOMENTE com JSON válido. " +
  "Nunca invente fala: se não houver fala audível, retorne segments vazio. " +
  "Os tempos devem ser em segundos, relativos ao início da mídia enviada.";

function buildUserPrompt(languageHint: string | null, offsetSeconds: number): string {
  return [
    "Transcreva a fala presente nesta mídia.",
    languageHint
      ? `O idioma informado pelo usuário é "${languageHint}" — use-o como referência principal.`
      : "Detecte o idioma automaticamente.",
    `Esta mídia começa em ${offsetSeconds.toFixed(2)}s do vídeo original, mas use tempos relativos a esta mídia (começando em 0).`,
    'Formato: {"language":"<código ISO>","segments":[{"start":<segundos>,"end":<segundos>,"text":"<fala>"}]}',
    "Quebre em segmentos curtos (uma frase ou até ~15 segundos).",
  ].join(" ");
}

async function transcribeInline(params: {
  data: string;
  format: string;
  offsetSeconds: number;
  languageHint: string | null;
}): Promise<{ language: string | null; segments: TranscriptSegment[] }> {
  const parts: ContentPart[] = [
    { type: "text", text: buildUserPrompt(params.languageHint, params.offsetSeconds) },
    { type: "input_audio", input_audio: { data: params.data, format: params.format } },
  ];

  const raw = await chatJson<RawTranscription>({ system: SYSTEM_PROMPT, parts });
  const segments = (raw.segments ?? [])
    .map((segment) => ({
      startSeconds: Math.max(0, Number(segment.start ?? 0)) + params.offsetSeconds,
      endSeconds: Math.max(0, Number(segment.end ?? 0)) + params.offsetSeconds,
      text: (segment.text ?? "").trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.endSeconds > segment.startSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  return { language: raw.language?.trim() || null, segments };
}

/** Transcribes the original file inline (short sources only). */
export async function transcribeDirectSource(params: {
  sourceUrl: string;
  format: string;
  languageHint: string | null;
  durationSeconds: number | null;
}): Promise<TranscriptionResult> {
  const media = await fetchInlineMedia(params.sourceUrl, params.format);
  const { language, segments } = await transcribeInline({
    data: media.data,
    format: media.format,
    offsetSeconds: 0,
    languageHint: params.languageHint,
  });
  return {
    language,
    segments,
    text: segments.map((segment) => segment.text).join(" "),
    transcribedSeconds:
      params.durationSeconds ?? (segments.length ? segments[segments.length - 1]!.endSeconds : 0),
  };
}

/** Transcribes audio chunks produced by the external media worker. */
export async function transcribeAudioChunks(params: {
  chunks: AudioChunk[];
  languageHint: string | null;
}): Promise<TranscriptionResult> {
  const all: TranscriptSegment[] = [];
  let language: string | null = null;
  let transcribedSeconds = 0;

  for (const chunk of params.chunks) {
    const media = await fetchInlineMedia(chunk.downloadUrl, chunk.format);
    const result = await transcribeInline({
      data: media.data,
      format: media.format,
      offsetSeconds: chunk.startSeconds,
      languageHint: params.languageHint ?? language,
    });
    language = language ?? result.language;
    all.push(...result.segments);
    transcribedSeconds =
      chunk.durationSeconds != null
        ? transcribedSeconds + chunk.durationSeconds
        : Math.max(
            transcribedSeconds,
            result.segments.length ? result.segments[result.segments.length - 1]!.endSeconds : 0,
          );
  }

  all.sort((a, b) => a.startSeconds - b.startSeconds);
  return {
    language,
    segments: all,
    text: all.map((segment) => segment.text).join(" "),
    transcribedSeconds,
  };
}
