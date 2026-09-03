/**
 * Frame-accurate MP3 chunking for multi-hour sources.
 *
 * The media worker returns the whole audio track of the recording as a single
 * MP3 file. A 4–8 hour live produces hundreds of megabytes, which cannot be
 * sent to the transcription model in one request. This module walks the real
 * MP3 frame headers of the remote file and produces a chunk plan where every
 * chunk is:
 *
 *  - cut exactly on a frame boundary (so each chunk is a valid MP3), and
 *  - annotated with the exact start/duration derived from the frame headers,
 *    so transcript timestamps map back onto the original timeline with no
 *    estimation or interpolation.
 *
 * Nothing here is simulated: the plan is built from the bytes of the real file
 * and each chunk is fetched with an HTTP Range request when it is transcribed.
 */

const ID3_HEADER = 0x494433; // "ID3"

const BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
};

export interface Mp3ChunkPlanEntry {
  index: number;
  byteStart: number;
  /** Inclusive last byte of the chunk (HTTP Range semantics). */
  byteEnd: number;
  startSeconds: number;
  durationSeconds: number;
}

export interface Mp3ChunkPlan {
  chunks: Mp3ChunkPlanEntry[];
  totalSeconds: number;
  totalBytes: number;
}

interface FrameInfo {
  length: number;
  seconds: number;
}

/** Decodes one MPEG audio frame header; returns null when it is not a frame. */
function readFrame(bytes: Uint8Array, offset: number): FrameInfo | null {
  if (offset + 4 > bytes.length) return null;
  const b0 = bytes[offset]!;
  const b1 = bytes[offset + 1]!;
  const b2 = bytes[offset + 2]!;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  if (layerBits !== 0x01) return null; // Layer III only (worker outputs MP3)

  const sampleRates = SAMPLE_RATES[versionBits];
  if (!sampleRates) return null;

  const sampleRateIndex = (b2 >> 2) & 0x03;
  const sampleRate = sampleRates[sampleRateIndex];
  if (!sampleRate) return null;

  const bitrateIndex = (b2 >> 4) & 0x0f;
  const bitrateTable = versionBits === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3;
  const bitrate = bitrateTable[bitrateIndex];
  if (!bitrate) return null;

  const padding = (b2 >> 1) & 0x01;
  const samplesPerFrame = versionBits === 3 ? 1152 : 576;
  const length =
    Math.floor(((versionBits === 3 ? 144 : 72) * bitrate * 1000) / sampleRate) + padding;
  if (length < 24) return null;

  return { length, seconds: samplesPerFrame / sampleRate };
}

function id3Size(bytes: Uint8Array): number {
  if (bytes.length < 10) return 0;
  const tag = (bytes[0]! << 16) | (bytes[1]! << 8) | bytes[2]!;
  if (tag !== ID3_HEADER) return 0;
  const size =
    ((bytes[6]! & 0x7f) << 21) |
    ((bytes[7]! & 0x7f) << 14) |
    ((bytes[8]! & 0x7f) << 7) |
    (bytes[9]! & 0x7f);
  return size + 10;
}

export interface Mp3PlanOptions {
  /** Upper bound of a single chunk in bytes (keeps the inline payload valid). */
  targetBytes?: number;
  /** Upper bound of a single chunk in seconds of audio. */
  maxSeconds?: number;
}

/**
 * Streams the remote MP3 once and produces the chunk plan. Only frame headers
 * are inspected; audio payloads are discarded, so memory stays flat regardless
 * of the file length.
 */
export async function planMp3Chunks(
  url: string,
  options: Mp3PlanOptions = {},
): Promise<Mp3ChunkPlan> {
  const targetBytes = options.targetBytes ?? 10 * 1024 * 1024;
  const maxSeconds = options.maxSeconds ?? 15 * 60;

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `Não foi possível ler o áudio extraído pelo serviço de mídia (${response.status}).`,
    );
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();

  const chunks: Mp3ChunkPlanEntry[] = [];
  let buffer = new Uint8Array(0);
  /** Absolute file offset of buffer[0]. */
  let bufferOffset = 0;
  let absolutePosition = 0;
  let totalSeconds = 0;
  let headerChecked = false;

  let chunkByteStart: number | null = null;
  let chunkStartSeconds = 0;
  let chunkSeconds = 0;

  const flush = (byteEndExclusive: number) => {
    if (chunkByteStart == null || byteEndExclusive <= chunkByteStart) return;
    chunks.push({
      index: chunks.length,
      byteStart: chunkByteStart,
      byteEnd: byteEndExclusive - 1,
      startSeconds: chunkStartSeconds,
      durationSeconds: chunkSeconds,
    });
    chunkByteStart = null;
    chunkSeconds = 0;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value?.length) {
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer, 0);
      merged.set(value, buffer.length);
      buffer = merged;

      if (!headerChecked && buffer.length >= 10) {
        headerChecked = true;
        const skip = id3Size(buffer);
        if (skip > 0 && skip < buffer.length) {
          buffer = buffer.subarray(skip);
          bufferOffset += skip;
          absolutePosition = bufferOffset;
        }
      }

      // Walk complete frames inside the buffer.
      for (;;) {
        const local = absolutePosition - bufferOffset;
        if (local + 4 > buffer.length) break;
        const frame = readFrame(buffer, local);
        if (!frame) {
          // Resync: advance one byte until the next frame header appears.
          absolutePosition += 1;
          continue;
        }
        if (local + frame.length > buffer.length) break;

        if (chunkByteStart == null) {
          chunkByteStart = absolutePosition;
          chunkStartSeconds = totalSeconds;
        }

        absolutePosition += frame.length;
        totalSeconds += frame.seconds;
        chunkSeconds += frame.seconds;

        const chunkBytes = absolutePosition - chunkByteStart;
        if (chunkBytes >= targetBytes || chunkSeconds >= maxSeconds) {
          flush(absolutePosition);
        }
      }

      // Drop already-consumed bytes.
      const consumed = absolutePosition - bufferOffset;
      if (consumed > 0) {
        buffer = buffer.subarray(consumed);
        bufferOffset = absolutePosition;
      }
    }
    if (done) break;
  }

  flush(absolutePosition);

  if (chunks.length === 0) {
    throw new Error(
      "O áudio extraído pelo serviço de mídia não contém quadros MP3 válidos; a transcrição não pode ser executada.",
    );
  }

  return { chunks, totalSeconds, totalBytes: absolutePosition };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

/** Downloads one planned chunk with a Range request and returns it inline. */
export async function fetchMp3Chunk(
  url: string,
  chunk: Mp3ChunkPlanEntry,
): Promise<{ data: string; bytes: number }> {
  const response = await fetch(url, {
    headers: { Range: `bytes=${chunk.byteStart}-${chunk.byteEnd}` },
  });
  if (!(response.status === 206 || response.status === 200)) {
    throw new Error(
      `O serviço de mídia não permitiu ler o trecho ${chunk.index + 1} do áudio (${response.status}).`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error(`O trecho ${chunk.index + 1} do áudio veio vazio do serviço de mídia.`);
  }
  return { data: toBase64(bytes), bytes: bytes.byteLength };
}
