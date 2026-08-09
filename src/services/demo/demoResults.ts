/**
 * DEMO DATA — NOT PRODUCTION LOGIC.
 *
 * This module exists only so the results and timeline UI can be inspected
 * before a real analysis/render worker is connected. It writes clearly labelled
 * placeholder rows derived from the source duration; it does NOT analyse the
 * video and must never be called from `videoProcessingService`. Deleting this
 * file has no effect on the real processing layer.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EditConfiguration, Project } from "@/types/video-editor";

const CATEGORIES = ["Key insight", "Q&A", "Demo", "Story", "Announcement"];

export async function seedDemoResults(project: Project, config: EditConfiguration | null) {
  const total = project.durationSeconds ?? 3600;
  const segmentCount = Math.min(24, Math.max(8, Math.round(total / 300)));
  const slice = total / segmentCount;

  await Promise.all([
    supabase.from("video_segments").delete().eq("project_id", project.id),
    supabase.from("short_clips").delete().eq("project_id", project.id),
    supabase.from("generated_videos").delete().eq("project_id", project.id),
  ]);

  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const score = Number((0.25 + ((index * 37) % 70) / 100).toFixed(2));
    const start = index * slice;
    return {
      project_id: project.id,
      start_seconds: start,
      end_seconds: start + slice,
      duration_seconds: slice,
      decision: (score >= 0.55 ? "keep" : "cut") as "keep" | "cut",
      score,
      reason:
        score >= 0.55
          ? "Demo placeholder: marked as high-value for UI review."
          : "Demo placeholder: marked as low-value for UI review.",
      category: CATEGORIES[index % CATEGORIES.length] ?? "Demo",
    };
  });

  const { data: insertedSegments } = await supabase
    .from("video_segments")
    .insert(segments)
    .select("id, start_seconds, duration_seconds, decision, category, score");

  const kept = (insertedSegments ?? []).filter((s: any) => s.decision === "keep");

  if (config?.wantShortClips !== false) {
    const clips = kept.slice(0, 6).map((segment: any, index: number) => ({
      project_id: project.id,
      title: `Demo clip ${index + 1}`,
      duration_seconds: Math.min(60, Number(segment.duration_seconds)),
      source_start_seconds: Number(segment.start_seconds),
      category: segment.category,
      confidence: segment.score,
      kept: true,
    }));
    if (clips.length > 0) await supabase.from("short_clips").insert(clips);
  }

  const keptSeconds = kept.reduce((sum: number, s: any) => sum + Number(s.duration_seconds), 0);

  if (config?.wantHighlights !== false) {
    await supabase.from("generated_videos").insert({
      project_id: project.id,
      kind: "highlights",
      original_duration_seconds: total,
      final_duration_seconds: Math.min(config?.highlightsTargetSeconds ?? 900, keptSeconds),
      removed_seconds: total - Math.min(config?.highlightsTargetSeconds ?? 900, keptSeconds),
      cuts_count: kept.length,
      segment_ids: kept.slice(0, 12).map((s: any) => s.id),
    });
  }

  if (config?.wantLongEdit !== false) {
    await supabase.from("generated_videos").insert({
      project_id: project.id,
      kind: "long_edit",
      original_duration_seconds: total,
      final_duration_seconds: keptSeconds,
      removed_seconds: total - keptSeconds,
      cuts_count: segments.length - kept.length,
      segment_ids: kept.map((s: any) => s.id),
    });
  }
}
