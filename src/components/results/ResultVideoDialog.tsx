import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, VideoOff } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDurationLabel, formatTimecode } from "@/lib/format";

export interface VideoPreviewResult {
  id: string;
  title: string;
  durationSeconds: number | null;
  sourceStartSeconds?: number | null;
  videoUrl: string | null;
}

interface ResultVideoDialogProps {
  result: VideoPreviewResult | null;
  onOpenChange: (open: boolean) => void;
  refreshUrl: (result: VideoPreviewResult) => Promise<string | null>;
}

type PlaybackState = "loading" | "ready" | "playing" | "error" | "unavailable";

export function ResultVideoDialog({ result, onOpenChange, refreshUrl }: ResultVideoDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");

  useEffect(() => {
    if (!result) return;

    let active = true;
    setPlaybackUrl(null);
    setPlaybackState("loading");

    refreshUrl(result)
      .then((url) => {
        if (!active) return;
        setPlaybackUrl(url);
        setPlaybackState(url ? "loading" : "unavailable");
        if (!url) {
          console.error("[results-player] arquivo indisponível", { resultId: result.id });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[results-player] falha ao renovar URL assinada", {
          resultId: result.id,
          error,
        });
        setPlaybackState("error");
      });

    return () => {
      active = false;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [refreshUrl, result]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={Boolean(result)} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(94vw,960px)] max-w-none gap-5 p-5 sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle>{result?.title ?? "Preview"}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1">
            {result?.durationSeconds != null && (
              <span>Duração: {formatDurationLabel(result.durationSeconds)}</span>
            )}
            {result?.sourceStartSeconds != null && (
              <span>Origem: {formatTimecode(result.sourceStartSeconds)}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg border border-border bg-surface-raised">
          {playbackUrl ? (
            <video
              ref={videoRef}
              key={playbackUrl}
              src={playbackUrl}
              controls
              playsInline
              preload="metadata"
              className="size-full bg-background object-contain"
              onLoadedMetadata={() => setPlaybackState("ready")}
              onCanPlay={() => setPlaybackState((state) => (state === "playing" ? state : "ready"))}
              onPlay={() => setPlaybackState("playing")}
              onPause={() => setPlaybackState((state) => (state === "error" ? state : "ready"))}
              onError={(event) => {
                console.error("[results-player] falha ao carregar mídia", {
                  resultId: result?.id,
                  mediaErrorCode: event.currentTarget.error?.code,
                  mediaErrorMessage: event.currentTarget.error?.message,
                });
                setPlaybackState("error");
              }}
            />
          ) : playbackState === "unavailable" ? (
            <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-muted-foreground">
              <VideoOff className="size-8" />
              <p className="text-sm">O arquivo deste resultado não está disponível no armazenamento.</p>
            </div>
          ) : playbackState === "error" ? (
            <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-muted-foreground">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm">Não foi possível carregar este vídeo. Tente novamente mais tarde.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Carregando vídeo…
            </div>
          )}

          {playbackUrl && playbackState === "loading" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/70 text-muted-foreground">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="size-5 animate-spin" />
                Carregando vídeo…
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}