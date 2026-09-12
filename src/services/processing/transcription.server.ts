/**
 * Real timestamped transcription through Vision Craft's provider router.
 *
 * The active provider is selected by AI_PROVIDER and can be OpenAI, Gemini,
 * or a self-hosted OpenAI-compatible local server. No Lovable AI Gateway.
 */

import { fetchMp3Chunk, type Mp3ChunkPlanEntry } from "./audioChunker.server";
import { transcribeAudio } from "./aiRouter.server";
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

function buildTranscriptionPrompt(languageHint: string | null): string {
  return [
    "Transcreva fielmente a fala audível.",
    languageHint ? `O idioma esperado é ${languageHint}.` : "Detecte o idioma automaticamente.",
    "Preserve nomes próprios, termos técnicos e palavras incomuns quando forem audíveis.",
  ].join(" ");
}

async function transcribeInline(params: {
  data: string;
  format: string;
  offsetSeconds: number;
  languageHint: string | null;
}): Promise<{ language: string | null; segments: TranscriptSegment[] }> {
  const raw = await transcribeAudio({
    data: params.data,
    format: params.format,
    languageHint: params.languageHint,
    prompt: buildTranscriptionPrompt(params.languageHint),
  });

  const segments = raw.segments
    .map((segment) => ({
      startSeconds: Math.max(0, Number(segment.start)) + params.offsetSeconds,
      endSeconds: Math.max(0, Number(segment.end)) + params.offsetSeconds,
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.endSeconds > segment.startSeconds)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  return { language: raw.language, segments };
}

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
    transcribedSeconds: params.durationSeconds ?? (segments.length ? segments[segments.length - 1]!.endSeconds : 0),
  };
}

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
    transcribedSeconds = chunk.durationSeconds != null
      ? transcribedSeconds + chunk.durationSeconds
      : Math.max(transcribedSeconds, result.segments.length ? result.segments[result.segments.length - 1]!.endSeconds : 0);
  }

  all.sort((a, b) => a.startSeconds - b.startSeconds);
  return {
    language,
    segments: all,
    text: all.map((segment) => segment.text).join(" "),
    transcribedSeconds,
  };
}

export async function transcribeMp3Chunk(params: {
  audioUrl: string;
  chunk: Mp3ChunkPlanEntry;
  languageHint: string | null;
}): Promise<{ language: string | null; segments: TranscriptSegment[]; bytes: number }> {
  const { data, bytes } = await fetchMp3Chunk(params.audioUrl, params.chunk);
  const { language, segments } = await transcribeInline({
    data,
    format: "mp3",
    offsetSeconds: params.chunk.startSeconds,
    languageHint: params.languageHint,
  });
  return { language, segments, bytes };
}
