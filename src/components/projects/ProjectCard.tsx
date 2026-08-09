import { Link } from "@tanstack/react-router";
import { Clock, Film, MoreHorizontal, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { formatDate, formatDurationLabel } from "@/lib/format";
import { PROCESSING_TYPE_LABEL, type Project } from "@/types/video-editor";

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (project: Project) => void;
}) {
  return (
    <article className="panel hover-lift group relative overflow-hidden">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="block focus-visible:outline-none"
      >
        <div className="relative aspect-video w-full overflow-hidden border-b border-border bg-surface-raised">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={`${project.name} thumbnail`}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Film className="size-7 opacity-50" />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <StatusBadge status={project.status} />
          </div>
          {project.durationSeconds != null && (
            <div className="text-timecode absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 text-[11px] text-foreground">
              {formatDurationLabel(project.durationSeconds)}
            </div>
          )}
        </div>

        <div className="space-y-3 p-5">
          <div>
            <h3 className="truncate text-[15px] font-semibold text-foreground">{project.name}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {project.sourceFileName ?? "No source video selected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {project.processingTypes.length === 0 ? (
              <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                No outputs configured
              </span>
            ) : (
              project.processingTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {PROCESSING_TYPE_LABEL[type]}
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <Clock className="size-3.5" />
            {formatDate(project.createdAt)}
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="size-8 bg-background/80"
              aria-label={`Actions for ${project.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onDelete(project);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
