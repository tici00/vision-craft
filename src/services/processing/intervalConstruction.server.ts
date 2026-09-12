import type { TranscriptSegment } from "./transcription.server";

export type ContextRequirement = "low" | "medium" | "high";

export interface ClipIntervalSeed {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  hasSpeech: boolean;
  contextRequirement: string | null;
}

export interface IntervalConstructionOptions {
  minSeconds: number;
  maxSeconds: number;
  timelineEnd: number;
}

interface PaddingPlan {
  leadSeconds: number;
  tailSeconds: number;
}

/**
 * Context expansion is deliberately conservative. The AI first identifies the
 * semantic core of a moment; this layer then tries to include the beginning of
 * the thought and its immediate resolution without pulling unrelated speech
 * into the render. All final boundaries are snapped to real transcript
 * boundaries whenever possible.
 */
const PADDING_BY_CONTEXT: Record<ContextRequirement, PaddingPlan> = {
  low: { leadSeconds: 2.5, tailSeconds: 3.5 },
  medium: { leadSeconds: 5, tailSeconds: 6 },
  high: { leadSeconds: 7, tailSeconds: 9 },
};

function normalizeRequirement(value: string | null): ContextRequirement {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function findContainingSegment(
  transcript: TranscriptSegment[],
  timeSeconds: number,
): TranscriptSegment | null {
  return (
    transcript.find(
      (segment) => segment.startSeconds <= timeSeconds && segment.endSeconds >= timeSeconds,
    ) ?? null
  );
}

function snapStart(
  transcript: TranscriptSegment[],
  coreStart: number,
  desiredStart: number,
): number {
  const containing = findContainingSegment(transcript, coreStart);
  if (containing && containing.startSeconds >= desiredStart) return containing.startSeconds;

  const previous = transcript
    .filter((segment) => segment.endSeconds <= coreStart && segment.startSeconds >= desiredStart)
    .sort((a, b) => b.endSeconds - a.endSeconds)[0];

  if (previous && coreStart - previous.endSeconds <= 1.5) return previous.startSeconds;
  return coreStart;
}

function snapEnd(
  transcript: TranscriptSegment[],
  coreEnd: number,
  desiredEnd: number,
): number {
  const containing = findContainingSegment(transcript, coreEnd);
  if (containing && containing.endSeconds <= desiredEnd) return containing.endSeconds;

  const next = transcript
    .filter((segment) => segment.startSeconds >= coreEnd && segment.endSeconds <= desiredEnd)
    .sort((a, b) => a.startSeconds - b.startSeconds)[0];

  if (next && next.startSeconds - coreEnd <= 1.5) return next.endSeconds;
  return coreEnd;
}

export function constructClipInterval(
  seed: ClipIntervalSeed,
  transcript: TranscriptSegment[],
  options: IntervalConstructionOptions,
): { startSeconds: number; endSeconds: number; durationSeconds: number } {
  const timelineEnd = Math.max(0, options.timelineEnd);
  const coreStart = clamp(seed.startSeconds, 0, timelineEnd);
  const coreEnd = clamp(seed.endSeconds, coreStart, timelineEnd);
  const coreDuration = coreEnd - coreStart;

  if (!seed.hasSpeech || coreDuration <= 0 || transcript.length === 0) {
    return {
      startSeconds: coreStart,
      endSeconds: coreEnd,
      durationSeconds: coreDuration,
    };
  }

  const padding = PADDING_BY_CONTEXT[normalizeRequirement(seed.contextRequirement)];
  const availableExpansion = Math.max(0, options.maxSeconds - coreDuration);

  if (availableExpansion <= 0) {
    return {
      startSeconds: coreStart,
      endSeconds: coreEnd,
      durationSeconds: coreDuration,
    };
  }

  const requestedTotal = padding.leadSeconds + padding.tailSeconds;
  const scale = Math.min(1, availableExpansion / requestedTotal);
  const lead = padding.leadSeconds * scale;
  const tail = padding.tailSeconds * scale;

  const desiredStart = Math.max(0, coreStart - lead);
  const desiredEnd = Math.min(timelineEnd, coreEnd + tail);
  const start = snapStart(transcript, coreStart, desiredStart);
  const end = snapEnd(transcript, coreEnd, desiredEnd);

  // A boundary snap can add a little more than the requested padding. Never let
  // the context layer exceed the configured maximum just because of that snap.
  if (end - start > options.maxSeconds) {
    const excess = end - start - options.maxSeconds;
    const startTrim = Math.min(excess, Math.max(0, coreStart - start));
    const trimmedStart = start + startTrim;
    const remainingExcess = excess - startTrim;
    const trimmedEnd = end - Math.min(remainingExcess, Math.max(0, end - coreEnd));
    if (trimmedEnd > trimmedStart) {
      return {
        startSeconds: trimmedStart,
        endSeconds: trimmedEnd,
        durationSeconds: trimmedEnd - trimmedStart,
      };
    }
  }

  const finalStart = clamp(start, 0, coreStart);
  const finalEnd = clamp(end, coreEnd, timelineEnd);
  return {
    startSeconds: finalStart,
    endSeconds: finalEnd,
    durationSeconds: finalEnd - finalStart,
  };
}
