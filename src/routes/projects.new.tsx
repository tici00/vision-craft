import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VideoDropzone, type SelectedVideo } from "@/components/projects/VideoDropzone";
import { videoProcessingService } from "@/services/videoProcessingService";
import { formatDurationLabel, formatFileSize } from "@/lib/format";

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

function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [video, setVideo] = useState<SelectedVideo | null>(null);

  const createAndUpload = useMutation({
    mutationFn: async () => {
      if (!video) throw new Error("Select a video first");
      const projectName = name.trim() || video.file.name.replace(/\.[^.]+$/, "");
      const project = await videoProcessingService.createProject({ name: projectName });
      await videoProcessingService.uploadVideo({
        projectId: project.id,
        file: video.file,
        durationSeconds: video.durationSeconds,
      });
      return project;
    },
    onSuccess: (project) => {
      toast.success("Source video uploaded");
      void navigate({ to: "/projects/$projectId/configure", params: { projectId: project.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canContinue = video != null && !createAndUpload.isPending;

  return (
    <>
      <TopBar
        title="New project"
        subtitle="Step 1 of 2 · Source video"
        actions={
          <Button disabled={!canContinue} onClick={() => createAndUpload.mutate()}>
            {createAndUpload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {createAndUpload.isPending ? "Uploading…" : "Continue to configuration"}
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Start a new project
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add the full recording. Nothing is analysed at this stage — the file is stored and the
          project is created so you can choose the outputs you want next.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <VideoDropzone
            value={video}
            onChange={setVideo}
            disabled={createAndUpload.isPending}
          />

          <aside className="space-y-6">
            <div className="panel space-y-4 p-5">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={name}
                  maxLength={120}
                  placeholder={video ? video.file.name.replace(/\.[^.]+$/, "") : "Weekly livestream"}
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
                <Detail label="File" value={video?.file.name ?? "—"} />
                <Detail label="Size" value={video ? formatFileSize(video.file.size) : "—"} />
                <Detail
                  label="Duration"
                  value={video ? formatDurationLabel(video.durationSeconds) : "—"}
                />
                <Detail label="Type" value={video?.file.type || "—"} />
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
      <dd className="text-timecode max-w-[60%] truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
