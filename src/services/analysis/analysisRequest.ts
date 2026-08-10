/**
 * Builds the structured request the future worker consumes. Derived only from
 * persisted project + configuration data, so the pipeline never depends on UI
 * state.
 */

import { CLIP_DURATION_RANGE } from "@/lib/analysis-options";
import type { AnalysisJobRequest } from "@/services/analysis/contracts";
import type { AnalysisSource, EditConfiguration, Project } from "@/types/video-editor";

export function analysisSourcesFor(config: EditConfiguration): AnalysisSource[] {
  switch (config.analysisMode) {
    case "audio_only":
      return ["audio"];
    case "audio_speech":
      return ["audio", "transcript", "context"];
    case "multimodal":
    default:
      return ["audio", "transcript", "video", "context"];
  }
}

export function buildAnalysisJobRequest(
  project: Project,
  config: EditConfiguration,
): AnalysisJobRequest {
  const range = CLIP_DURATION_RANGE[config.clipsDurationPreference];

  return {
    version: 1,
    sourceVideo: {
      projectId: project.id,
      storagePath: project.sourceStoragePath,
      fileName: project.sourceFileName,
      mimeType: project.sourceMimeType,
      format: project.sourceFormat,
      sizeBytes: project.sourceFileSize,
      durationSeconds: project.durationSeconds,
    },
    language: {
      mode: config.languageMode,
      primary: config.primaryLanguage,
      secondary: config.secondaryLanguages,
      hasMultiple: config.hasMultipleLanguages,
      transcriptionLanguage: config.transcriptionLanguage ?? config.primaryLanguage,
      preferManualChoice: true,
    },
    context: {
      contentTypes: config.contentTypes,
      description: config.videoContext,
      mainActivity: config.mainActivity,
      audioVideoFlags: config.importantAudioVideoFlags,
      additionalInstructions: config.analysisNotes,
    },
    analysis: {
      mode: config.analysisMode,
      sources: analysisSourcesFor(config),
    },
    outputs: {
      shortClips: {
        enabled: config.wantShortClips,
        quantityMode: config.clipsQuantityMode,
        quantity: config.clipsQuantity,
        durationPreference: config.clipsDurationPreference,
        minSeconds: config.clipMinSeconds ?? range.min,
        maxSeconds: config.clipMaxSeconds ?? range.max,
        selectionCriteria: config.clipsSelectionCriteria,
        avoidSimilar: config.avoidSimilarClips,
        speechPriority: config.speechPriority,
      },
      highlights: {
        enabled: config.wantHighlights,
        targetSeconds: config.highlightsTargetSeconds ?? config.highlightsDurationMinutes * 60,
        editingStyle: config.highlightsEditingStyle,
        criteria: config.highlightsCriteria,
        contextLevel: config.highlightsContextLevel,
      },
      longEdit: {
        enabled: config.wantLongEdit,
        intensity: config.longEditIntensity ?? "balanced",
        removeFlags: config.longEditRemoveFlags,
        removeSilences: config.removeSilences,
        silenceThresholdSeconds: config.removeSilences ? config.silenceThresholdSeconds : null,
        removeWaiting: config.removeWaiting,
        removeRepetitions: config.removeRepetitions,
        removeLowActivity: config.removeLowActivity,
        preserveVisualEvents: config.preserveVisualEvents,
        preserveWebcamReactions: config.preserveWebcamReactions,
        preserveContextLevel: config.preserveContextLevel,
      },
    },
  };
}
