import { useCallback, useRef, useState } from "react";
import { FileVideo, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationLabel, formatFileSize } from "@/lib/format";

export interface SelectedVideo {
  file: File;
  durationSeconds: number | null;
  objectUrl: string;
}

const ACCEPTED = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/mpeg"];
const MAX_BYTES = 8 * 1024 * 1024 * 1024;

/** Reads real duration metadata from the browser video decoder. */
function readDuration(objectUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => resolve(null);
    video.src = objectUrl;
  });
}

export function VideoDropzone({
  value,
  onChange,
  disabled,
}: {
  value: SelectedVideo | null;
  onChange: (value: SelectedVideo | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      setError(null);
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith("video/") || (file.type && !ACCEPTED.includes(file.type))) {
        setError("Unsupported file type. Use MP4, MOV, MKV, WebM or MPEG.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File is larger than the 8 GB limit.");
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const durationSeconds = await readDuration(objectUrl);
      onChange({ file, durationSeconds, objectUrl });
    },
    [onChange],
  );

  if (value) {
    return (
      <div className="panel overflow-hidden">
        <div className="aspect-video w-full bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={value.objectUrl} controls className="size-full" />
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <FileVideo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{value.file.name}</p>
            <p className="text-timecode mt-0.5 text-xs text-muted-foreground">
              {formatFileSize(value.file.size)} · {formatDurationLabel(value.durationSeconds)} ·{" "}
              {value.file.type || "unknown type"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="text-destructive hover:text-destructive"
              onClick={() => {
                URL.revokeObjectURL(value.objectUrl);
                onChange(null);
              }}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-20 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border-strong bg-surface/40 hover:border-primary/50",
        )}
      >
        <div
          className={cn(
            "grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground transition-colors",
            dragging && "bg-primary/15 text-primary",
          )}
        >
          <UploadCloud className="size-7" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-foreground">Drop your recording here</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Long-form recordings, livestreams and webinars. MP4, MOV, MKV, WebM or MPEG up to 8 GB.
        </p>
        <Button className="mt-6" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Select file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
