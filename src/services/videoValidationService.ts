/**
 * videoValidationService — decides whether a selected file can enter the
 * pipeline. Pure, side-effect free and independent from the UI so the same
 * rules can later run on a server worker.
 */

export interface AcceptedVideoFormat {
  /** Lowercase extension without the dot. */
  extension: string;
  /** MIME types browsers report for this container. */
  mimeTypes: string[];
  label: string;
}

/**
 * Format registry — add an entry here to support another container.
 * Nothing else in the codebase needs to change.
 */
export const ACCEPTED_VIDEO_FORMATS: AcceptedVideoFormat[] = [
  { extension: "mp4", mimeTypes: ["video/mp4"], label: "MP4" },
  { extension: "m4v", mimeTypes: ["video/mp4", "video/x-m4v"], label: "M4V" },
  { extension: "mov", mimeTypes: ["video/quicktime"], label: "MOV" },
  { extension: "mkv", mimeTypes: ["video/x-matroska", "video/matroska"], label: "MKV" },
  { extension: "webm", mimeTypes: ["video/webm"], label: "WebM" },
];

export const ACCEPTED_EXTENSIONS = ACCEPTED_VIDEO_FORMATS.map((format) => format.extension);
export const ACCEPTED_MIME_TYPES = Array.from(
  new Set(ACCEPTED_VIDEO_FORMATS.flatMap((format) => format.mimeTypes)),
);
/** Value for the file input `accept` attribute. */
export const FILE_INPUT_ACCEPT = [
  ...ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`),
  ...ACCEPTED_MIME_TYPES,
].join(",");

export const ACCEPTED_FORMATS_LABEL = ACCEPTED_VIDEO_FORMATS.map((f) => f.label).join(", ");

export type VideoValidationCode =
  | "empty_file"
  | "unsupported_format"
  | "unreadable_video";

export interface VideoValidationResult {
  valid: boolean;
  code?: VideoValidationCode;
  message?: string;
}

const MESSAGES: Record<VideoValidationCode, string> = {
  empty_file: "O arquivo selecionado está vazio ou corrompido.",
  unsupported_format: `Este formato de arquivo ainda não é suportado. Use ${ACCEPTED_FORMATS_LABEL}.`,
  unreadable_video: "Não foi possível ler este arquivo de vídeo.",
};

export function getFileExtension(fileName: string): string {
  const match = /\.([^.\\/]+)$/.exec(fileName);
  return match ? match[1]!.toLowerCase() : "";
}

/** Resolves the registry entry for a file, by extension first and MIME second. */
export function resolveFormat(file: File): AcceptedVideoFormat | null {
  const extension = getFileExtension(file.name);
  const byExtension = ACCEPTED_VIDEO_FORMATS.find((format) => format.extension === extension);
  if (byExtension) return byExtension;
  if (!file.type) return null;
  return (
    ACCEPTED_VIDEO_FORMATS.find((format) => format.mimeTypes.includes(file.type.toLowerCase())) ??
    null
  );
}

export const videoValidationService = {
  messageFor(code: VideoValidationCode): string {
    return MESSAGES[code];
  },

  /**
   * Structural validation that runs before any metadata read or upload.
   * No artificial size ceiling: this product targets multi-hour recordings, so
   * size limits are only enforced by the storage backend itself.
   */
  validateFile(file: File): VideoValidationResult {
    if (file.size <= 0) {
      return { valid: false, code: "empty_file", message: MESSAGES.empty_file };
    }
    if (!resolveFormat(file)) {
      return { valid: false, code: "unsupported_format", message: MESSAGES.unsupported_format };
    }
    return { valid: true };
  },

  /** Result of the browser decoder probe (see videoMetadataService). */
  validateDecodable(decodable: boolean): VideoValidationResult {
    return decodable
      ? { valid: true }
      : { valid: false, code: "unreadable_video", message: MESSAGES.unreadable_video };
  },
};
