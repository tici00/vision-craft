/**
 * Real timestamped transcription through Vision Craft's external AI provider.
 *
 * Audio is processed in small chunks and timestamps are offset back onto the
 * source timeline, so every returned second still refers to the original
 * recording. No Lovable AI Gateway is involved.
 */

import { fetchMp3Chunk, type Mp3ChunkPlanEntry } from "./audioChunker.server";
import { transcribeAudio } from "./gateway.server";
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

/**
 * Transcribes ONE planned MP3 chunk of the remote audio produced by the worker.
 *
 * Only the bytes of that chunk are fetched (HTTP Range) and sent to the external
 * transcription provider, so the full multi-hour MP3 never reaches memory nor
 * the model. Returned timestamps are already offset onto the original timeline.
 */
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
