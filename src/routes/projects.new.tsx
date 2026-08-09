import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { VideoDropzone, type SelectedVideo } from "@/components/projects/VideoDropzone";
import { videoProcessingService } from "@/services/videoProcessingService";
import { UploadCancelledError, type UploadProgress } from "@/services/videoUploadService";
import { formatDurationLabel, formatFileSize } from "@/lib/format";
import type { UploadStatus } from "@/types/video-editor";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [
      { title: "New project — AI Video Editor" },
      {
        name: "description",
        content: "Upload a long recording or livestream and start a new AI editing project.",
      },
      { property: "og:title", content: "New project — AI Video Editor" },
      {
        property: "og:description",
        content: "Upload a long recording and start a new AI editing project.",
      },
    ],
  }),
  component: NewProjectPage,
});

const PHASE_LABEL: Record<UploadStatus, string> = {
  none: "Arquivo selecionado",
  preparing: "Preparando upload",
  uploading: "Enviando vídeo",
  finalizing: "Finalizando",
  uploaded: "Upload concluído",
  error: "Erro no upload",
};

function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("none");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Kept across retries so a failed upload never loses the created project. */
  const projectIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!video) throw new Error("Selecione um vídeo primeiro.");
      setErrorMessage(null);
      setUploadStatus("preparing");
      setProgress(null);

      const projectName = name.trim() || video.metadata.fileName.replace(/\.[^.]+$/, "");
      if (!projectIdRef.current) {
        const created = await videoProcessingService.createProject({ name: projectName });
        projectIdRef.current = created.id;
      } else {
        await videoProcessingService.renameProject(projectIdRef.current, projectName);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const project = await videoProcessingService.uploadVideo({
        projectId: projectIdRef.current,
        file: video.file,
        metadata: video.metadata,
        signal: controller.signal,
        onProgress: (value) => {
          setProgress(value);
          setUploadStatus(value.phase);
        },
      });
      setUploadStatus("uploaded");
      return project;
    },
    onSuccess: (project) => {
      toast.success("Vídeo enviado e projeto criado");
      void navigate({ to: "/projects/$projectId/configure", params: { projectId: project.id } });
    },
    onError: (error: Error) => {
      if (error instanceof UploadCancelledError) {
        setUploadStatus("none");
        setProgress(null);
        toast.info("Upload cancelado");
        return;
      }
      setUploadStatus("error");
      setErrorMessage(error.message);
      toast.error(error.message);
    },
  });

  const busy = upload.isPending;
  const canStart = video != null && !busy;

  return (
    <>
      <TopBar
        title="New project"
        subtitle="Step 1 of 2 · Source video"
        actions={
          busy ? (
            <Button
              variant="outline"
              onClick={() => {
                abortRef.current?.abort();
              }}
            >
              <X className="size-4" />
              Cancelar upload
            </Button>
          ) : (
            <Button disabled={!canStart} onClick={() => upload.mutate()}>
              <ArrowRight className="size-4" />
              {uploadStatus === "error" ? "Tentar novamente" : "Enviar e continuar"}
            </Button>
          )
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Start a new project
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          O arquivo é enviado para o armazenamento do projeto e apenas a referência e os metadados
          reais são gravados no banco. Nada é analisado nesta etapa.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <VideoDropzone value={video} onChange={setVideo} disabled={busy} />

            {(busy || uploadStatus === "error" || uploadStatus === "uploaded") && (
              <div className="panel space-y-4 p-5">
                <div className="flex items-center gap-3 text-sm">
                  {uploadStatus === "error" ? (
                    <AlertCircle className="size-4 text-destructive" />
                  ) : uploadStatus === "uploaded" ? (
                    <CheckCircle2 className="size-4 text-keep" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  )}
                  <span className="font-medium text-foreground">{PHASE_LABEL[uploadStatus]}</span>
                  {progress && uploadStatus === "uploading" && (
                    <span className="text-timecode ml-auto text-xs text-muted-foreground">
                      {formatFileSize(progress.bytesUploaded)} /{" "}
                      {formatFileSize(progress.bytesTotal)} · {Math.floor(progress.percent)}%
                    </span>
                  )}
                </div>

                {progress ? (
                  <Progress value={progress.percent} />
                ) : (
                  uploadStatus !== "error" &&
                  uploadStatus !== "uploaded" && (
                    <p className="text-xs text-muted-foreground">
                      Progresso em bytes aparece assim que a transferência começa.
                    </p>
                  )
                )}

                {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
                {uploadStatus === "error" && (
                  <p className="text-xs text-muted-foreground">
                    O projeto e o arquivo selecionado foram mantidos — use “Tentar novamente”.
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="panel space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={name}
                  maxLength={120}
                  disabled={busy}
                  placeholder={
                    video ? video.metadata.fileName.replace(/\.[^.]+$/, "") : "Weekly livestream"
                  }
                  onChange={(event) => setName(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to the file name when left empty.
                </p>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="text-sm font-semibold text-foreground">Source details</h2>
              <dl className="mt-4 space-y-3 text-xs">
                <Detail label="File" value={video?.metadata.fileName ?? "—"} />
                <Detail
                  label="Size"
                  value={video ? formatFileSize(video.metadata.sizeBytes) : "—"}
                />
                <Detail
                  label="Duration"
                  value={
                    video
                      ? video.metadata.durationSeconds != null
                        ? formatDurationLabel(video.metadata.durationSeconds)
                        : "Indisponível"
                      : "—"
                  }
                />
                <Detail
                  label="Format"
                  value={video ? video.metadata.format.toUpperCase() : "—"}
                />
                <Detail label="MIME" value={video?.metadata.mimeType ?? "—"} />
                <Detail
                  label="Resolution"
                  value={
                    video?.metadata.width && video.metadata.height
                      ? `${video.metadata.width}×${video.metadata.height}`
                      : video
                        ? "Indisponível"
                        : "—"
                  }
                />
                <Detail label="Upload" value={PHASE_LABEL[uploadStatus]} />
              </dl>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
