import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Loader2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/layout/TopBar";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { projectQueries } from "@/services/queries";
import { videoProcessingService } from "@/services/videoProcessingService";
import type { Project } from "@/types/video-editor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Projects — AI Video Editor" },
      {
        name: "description",
        content:
          "Manage long-form video projects: upload recordings, configure outputs and review generated clips, highlights and long edits.",
      },
      { property: "og:title", content: "Projects — AI Video Editor" },
      {
        property: "og:description",
        content: "Manage long-form video editing projects and AI output configurations.",
      },
    ],
  }),
  component: ProjectsDashboard,
});

function ProjectsDashboard() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const projects = useQuery(projectQueries.all());

  const deleteProject = useMutation({
    mutationFn: (projectId: string) => videoProcessingService.deleteProject(projectId),
    onSuccess: () => {
      toast.success("Project deleted");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPendingDelete(null),
  });

  const activeCount =
    projects.data?.filter((project) =>
      ["queued", "processing", "analyzing", "generating_clips", "rendering"].includes(
        project.status,
      ),
    ).length ?? 0;
  const completedCount = projects.data?.filter((p) => p.status === "completed").length ?? 0;

  return (
    <>
      <TopBar title="Projects" subtitle="All long-form editing projects in this workspace" />

      <main className="mx-auto w-full max-w-[1680px] px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Your projects
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Upload a long recording, choose the outputs you need, and review clips, highlights and
              tightened long edits in one place.
            </p>
          </div>
          <div className="flex gap-8">
            <Stat label="Total" value={projects.data?.length ?? 0} loading={projects.isLoading} />
            <Stat label="In pipeline" value={activeCount} loading={projects.isLoading} />
            <Stat label="Completed" value={completedCount} loading={projects.isLoading} />
          </div>
        </div>

        {projects.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="panel overflow-hidden">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.isError ? (
          <EmptyState
            icon={<TriangleAlert className="size-5" />}
            title="Couldn't load projects"
            description={(projects.error as Error).message}
            action={
              <Button variant="outline" onClick={() => void projects.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (projects.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-5" />}
            title="No projects yet"
            description="Create your first project to upload a long recording and generate short clips, a highlights video or a tighter long edit."
            action={
              <Button asChild>
                <Link to="/projects/new">
                  <Plus className="size-4" />
                  New project
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.data?.map((project) => (
              <ProjectCard key={project.id} project={project} onDelete={setPendingDelete} />
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={pendingDelete != null} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project record, its configuration, jobs, segments, results and the
              uploaded source video. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteProject.mutate(pendingDelete.id);
              }}
            >
              {deleteProject.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-10" />
      ) : (
        <p className="text-timecode mt-1 text-2xl font-semibold text-foreground">{value}</p>
      )}
    </div>
  );
}
