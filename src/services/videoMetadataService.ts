import { getFileExtension, resolveFormat } from "@/services/videoValidationService";

/**
 * videoMetadataService — reads REAL metadata from a selected file.
 *
 * Only values the browser actually reports are returned. Anything the browser
 * cannot decode (common for MKV) stays `null` and is surfaced in the UI as
 * "unavailable" — never invented.
 */

export interface VideoFileMetadata {
  fileName: string;
  /** Bytes reported by the file system. */
  sizeBytes: number;
  /** MIME type reported by the browser, may be empty for some containers. */
  mimeType: string;
  /** Lowercase container extension, e.g. "mp4". */
  format: string;
  /** Seconds, or null when the browser could not decode the container. */
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  /** True when the browser decoded the file well enough to read metadata. */
  decodable: boolean;
  /** Local blob URL for the in-browser preview. Must be revoked by the caller. */
  objectUrl: string;
}

interface ProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  decodable: boolean;
}

/** Loads metadata through the browser's video decoder. Never throws. */
function probe(objectUrl: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const finish = (result: ProbeResult) => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      resolve(result);
    };

    const timeout = window.setTimeout(
      () => finish({ durationSeconds: null, width: null, height: null, decodable: false }),
      15000,
    );

    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      finish({
        durationSeconds: duration,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        decodable: true,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timeout);
      finish({ durationSeconds: null, width: null, height: null, decodable: false });
    };

    video.src = objectUrl;
  });
}

export const videoMetadataService = {
  /** Reads everything available locally. Caller owns `objectUrl` lifetime. */
  async read(file: File): Promise<VideoFileMetadata> {
    const objectUrl = URL.createObjectURL(file);
    const probed = await probe(objectUrl);
    const format = resolveFormat(file)?.extension ?? getFileExtension(file.name);

    return {
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type || `video/${format || "unknown"}`,
      format,
      durationSeconds: probed.durationSeconds,
      width: probed.width,
      height: probed.height,
      decodable: probed.decodable,
      objectUrl,
    };
  },

  release(metadata: Pick<VideoFileMetadata, "objectUrl"> | null) {
    if (metadata?.objectUrl) URL.revokeObjectURL(metadata.objectUrl);
  },

  /**
   * Thumbnail extraction is intentionally not implemented: a real frame grab
   * belongs to the server-side pipeline (ffmpeg) so it also works for
   * containers the browser cannot decode. No placeholder image is ever stored.
   */
  thumbnailSupported: false,
};
