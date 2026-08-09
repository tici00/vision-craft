import { useCallback, useRef, useState } from "react";
import { AlertCircle, FileVideo, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationLabel, formatFileSize } from "@/lib/format";
import {
  ACCEPTED_FORMATS_LABEL,
  FILE_INPUT_ACCEPT,
  videoValidationService,
} from "@/services/videoValidationService";
import { videoMetadataService, type VideoFileMetadata } from "@/services/videoMetadataService";

export interface SelectedVideo {
  file: File;
  metadata: VideoFileMetadata;
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
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      setError(null);
      const file = files?.[0];
      if (!file) return;

      const structural = videoValidationService.validateFile(file);
      if (!structural.valid) {
        setError(structural.message ?? "Arquivo inválido.");
        return;
      }

      setReading(true);
      try {
        const metadata = await videoMetadataService.read(file);
        // A container the browser cannot decode at all is rejected; a decodable
        // file with no duration is accepted and shown as "unavailable".
        if (!metadata.decodable && metadata.format !== "mkv") {
          videoMetadataService.release(metadata);
          setError(videoValidationService.messageFor("unreadable_video"));
          return;
        }
        if (value) videoMetadataService.release(value.metadata);
        onChange({ file, metadata });
      } finally {
        setReading(false);
      }
    },
    [onChange, value],
  );

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={FILE_INPUT_ACCEPT}
      hidden
      onChange={(event) => {
        void handleFiles(event.target.files);
        event.target.value = "";
      }}
    />
  );

  if (value) {
    const { metadata } = value;
    return (
      <div className="panel overflow-hidden">
        <div className="aspect-video w-full bg-black">
          {metadata.decodable ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={metadata.objectUrl} controls className="size-full" />
          ) : (
            <div className="grid size-full place-items-center px-6 text-center text-muted-foreground">
              <div>
                <FileVideo className="mx-auto size-8 opacity-50" />
                <p className="mt-3 text-sm">
                  Prévia indisponível neste navegador para arquivos .{metadata.format}. O upload e o
                  processamento no servidor não são afetados.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <FileVideo className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{metadata.fileName}</p>
            <p className="text-timecode mt-0.5 text-xs text-muted-foreground">
              {formatFileSize(metadata.sizeBytes)} ·{" "}
              {metadata.durationSeconds != null
                ? formatDurationLabel(metadata.durationSeconds)
                : "duração indisponível"}{" "}
              · {metadata.format.toUpperCase()}
              {metadata.width && metadata.height ? ` · ${metadata.width}×${metadata.height}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || reading}
              onClick={() => inputRef.current?.click()}
            >
              Substituir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || reading}
              className="text-destructive hover:text-destructive"
              onClick={() => {
                videoMetadataService.release(metadata);
                onChange(null);
              }}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          </div>
        </div>
        {error && (
          <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
          </p>
        )}
        {fileInput}
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
          if (disabled) return;
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
        <h3 className="mt-5 text-lg font-semibold text-foreground">
          {reading ? "Lendo o arquivo…" : "Arraste sua gravação aqui"}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Gravações longas, lives e webinars. Formatos suportados: {ACCEPTED_FORMATS_LABEL}. Sem
          limite artificial de duração ou tamanho.
        </p>
        <Button
          className="mt-6"
          disabled={disabled || reading}
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivo
        </Button>
        {fileInput}
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
    </div>
  );
}
