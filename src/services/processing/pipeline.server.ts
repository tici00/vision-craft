/**
 * The real processing pipeline for the "Cortes curtos" output.
 *
 * `advanceJob` executes exactly one stage per call and persists everything it
 * did on the job record, so progress always reflects work that really happened.
 * Nothing here fabricates progress, transcripts, timestamps or results: when a
 * capability is missing (ffmpeg for long sources or for rendering) the job fails
 * with an explicit message describing what must be connected.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAnalysisJobRequest } from "@/services/analysis/analysisRequest";
import type { AnalysisJobRequest } from "@/services/analysis/contracts";
import type { AnalysisStage, ProcessingStep } from "@/types/video-editor";

import { selectShortClipCandidates } from "./clipSelection.server";
import {
  CLIPS_BUCKET,
  DIRECT_MEDIA_LIMIT_BYTES,
  createSignedSourceUrl,
  formatForFile,
  getSourceObjectSize,
  storeClipFromUrl,
} from "./media.server";

import {
  RENDER_BATCH_SIZE,
  WORKER_SETUP_MESSAGE,
  checkWorkerHealth,
  extractAudio,
  getWorkerConfig,
  isWorkerConfigured,
  renderClips,
  type RenderClipRequest,
} from "@/services/worker/workerClient.server";
import { transcribeAudioChunks, transcribeDirectSource } from "./transcription.server";

/* -------------------------------------------------------------------- types */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface JobSnapshot {
  jobId: string;
  projectId: string;
  status: string;
  stage: AnalysisStage;
  progress: number;
  currentStep: string | null;
  stageMessage: string | null;
  errorMessage: string | null;
  finished: boolean;
}

const STAGE_PROGRESS: Partial<Record<AnalysisStage, number>> = {
  queued: 0,
  preparing: 8,
  extracting_audio: 18,
  transcribing: 30,
  combining_signals: 58,
  scoring_segments: 66,
  preparing_outputs: 84,
  rendering: 92,
  completed: 100,
};

const STAGE_LABEL: Partial<Record<AnalysisStage, string>> = {
  preparing: "Preparando vídeo",
  extracting_audio: "Extraindo áudio",
  transcribing: "Transcrevendo o vídeo",
  scoring_segments: "Selecionando os melhores momentos",
  preparing_outputs: "Preparando os cortes",
  rendering: "Gerando os arquivos dos cortes",
  completed: "Concluído",
};

/* ------------------------------------------------------------------ helpers */

function withSteps(
  steps: ProcessingStep[],
  updates: Record<string, ProcessingStep["status"]>,
): ProcessingStep[] {
  return steps.map((step) => (updates[step.key] ? { ...step, status: updates[step.key]! } : step));
}

async function loadJob(jobId: string): Promise<Row> {
  const { data, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job de processamento não encontrado.");
  return data;
}

function snapshot(job: Row): JobSnapshot {
  return {
    jobId: job.id,
    projectId: job.project_id,
    status: job.status,
    stage: (job.stage ?? "queued") as AnalysisStage,
    progress: Number(job.progress ?? 0),
    currentStep: job.current_step ?? null,
    stageMessage: job.stage_message ?? null,
    errorMessage: job.error_message ?? null,
    finished: ["completed", "cancelled", "error"].includes(job.status),
  };
}

async function updateJob(jobId: string, patch: Record<string, unknown>): Promise<Row> {
  const { data, error } = await supabaseAdmin
    .from("processing_jobs")
    .update({ ...patch, last_heartbeat_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function appendLog(job: Row, message: string): Promise<Row["logs"]> {
  const logs = Array.isArray(job.logs) ? job.logs : [];
  return [...logs, { at: new Date().toISOString(), stage: job.stage, message }].slice(-100);
}

async function moveTo(
  job: Row,
  stage: AnalysisStage,
  options: { steps?: Record<string, ProcessingStep["status"]>; message?: string | null } = {},
): Promise<Row> {
  const steps = withSteps((job.steps ?? []) as ProcessingStep[], options.steps ?? {});
  const progress = STAGE_PROGRESS[stage] ?? Number(job.progress ?? 0);
  const updated = await updateJob(job.id, {
    stage,
    status: stage === "completed" ? "completed" : "running",
    progress,
    current_step: STAGE_LABEL[stage] ?? job.current_step,
    stage_message: options.message ?? null,
    steps,
    waiting_for_worker: false,
    started_at: job.started_at ?? new Date().toISOString(),
    ...(stage === "completed" ? { finished_at: new Date().toISOString() } : {}),
    logs: await appendLog(job, options.message ?? STAGE_LABEL[stage] ?? stage),
  });

  await supabaseAdmin
    .from("projects")
    .update({
      analysis_status: stage === "completed" ? "completed" : "running",
      analysis_stage: stage,
      analysis_progress: progress,
      analysis_error: null,
      status:
        stage === "completed" ? "completed" : stage === "rendering" ? "rendering" : "analyzing",
      ...(stage === "completed" ? { analysis_completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", job.project_id);

  return updated;
}

async function failJob(job: Row, stage: AnalysisStage, message: string): Promise<JobSnapshot> {
  const failed = await updateJob(job.id, {
    status: "error",
    stage,
    failed_stage: stage,
    error_message: message,
    stage_message: message,
    finished_at: new Date().toISOString(),
    waiting_for_worker: false,
    steps: withSteps((job.steps ?? []) as ProcessingStep[], { [stageStepKey(stage)]: "error" }),
    logs: await appendLog(job, `Falha: ${message}`),
  });
  await supabaseAdmin
    .from("projects")
    .update({ analysis_status: "error", analysis_error: message, status: "error" })
    .eq("id", job.project_id);
  return snapshot(failed);
}

function stageStepKey(stage: AnalysisStage): string {
  switch (stage) {
    case "preparing":
      return "prepare";
    case "scoring_segments":
      return "scoring_segments";
    default:
      return stage;
  }
}

async function requestPayload(job: Row): Promise<AnalysisJobRequest> {
  if (job.request_payload) return job.request_payload as AnalysisJobRequest;
  const [{ data: project }, { data: configuration }] = await Promise.all([
    supabaseAdmin.from("projects").select("*").eq("id", job.project_id).maybeSingle(),
    supabaseAdmin
      .from("edit_configurations")
      .select("*")
      .eq("project_id", job.project_id)
      .maybeSingle(),
  ]);
  if (!project || !configuration) {
    throw new Error("Configuração do projeto não encontrada para este job.");
  }
  // Rebuilt only from persisted rows; mappers live in the client service, so the
  // minimal shape needed by the pipeline is derived here.
  return buildAnalysisJobRequest(
    {
      id: project.id,
      sourceStoragePath: project.source_storage_path,
      sourceFileName: project.source_file_name,
      sourceMimeType: project.source_mime_type,
      sourceFormat: project.source_format,
      sourceFileSize: project.source_file_size,
      durationSeconds: project.duration_seconds == null ? null : Number(project.duration_seconds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,

    {
      ...configuration,
      wantShortClips: configuration.want_short_clips,
      wantHighlights: configuration.want_highlights,
      wantLongEdit: configuration.want_long_edit,
      languageMode: configuration.language_mode,
      primaryLanguage: configuration.primary_language,
      secondaryLanguages: configuration.secondary_languages ?? [],
      hasMultipleLanguages: configuration.has_multiple_languages,
      transcriptionLanguage: configuration.transcription_language,
      contentTypes: configuration.content_types ?? [],
      videoContext: configuration.video_context,
      mainActivity: configuration.main_activity,
      analysisNotes: configuration.analysis_notes,
      importantAudioVideoFlags: configuration.important_audio_video_flags ?? [],
      analysisMode: configuration.analysis_mode,
      clipsQuantityMode: configuration.clips_quantity_mode,
      clipsQuantity: configuration.clips_quantity,
      clipsDurationPreference: configuration.clips_duration_preference,
      clipsSelectionCriteria: configuration.clips_selection_criteria ?? [],
      avoidSimilarClips: configuration.avoid_similar_clips,
      speechPriority: configuration.speech_priority,
      clipMinSeconds: configuration.clip_min_seconds,
      clipMaxSeconds: configuration.clip_max_seconds,
      highlightsDurationMinutes: configuration.highlights_duration_minutes,
      highlightsTargetSeconds: configuration.highlights_target_seconds,
      highlightsEditingStyle: configuration.highlights_editing_style,
      highlightsCriteria: configuration.highlights_criteria ?? [],
      highlightsContextLevel: configuration.highlights_context_level,
      longEditIntensity: configuration.long_edit_intensity,
      longEditRemoveFlags: configuration.long_edit_remove_flags ?? [],
      removeSilences: configuration.remove_silences,
      silenceThresholdSeconds: configuration.silence_threshold_seconds,
      removeWaiting: configuration.remove_waiting,
      removeRepetitions: configuration.remove_repetitions,
      removeLowActivity: configuration.remove_low_activity,
      preserveVisualEvents: configuration.preserve_visual_events,
      preserveWebcamReactions: configuration.preserve_webcam_reactions,
      preserveContextLevel: configuration.preserve_context_level,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  );
}

/* ------------------------------------------------------------ stage runners */

async function runPreparing(job: Row): Promise<Row> {
  const request = await requestPayload(job);
  const storagePath = request.sourceVideo.storagePath;
  if (!storagePath) {
    throw new Error("O projeto não tem um vídeo enviado. Faça o upload antes de processar.");
  }
  if (!request.outputs.shortClips.enabled) {
    throw new Error(
      "Nesta versão o processamento real cobre apenas o resultado “Cortes curtos”. Ative esse resultado na configuração.",
    );
  }

  const size = (await getSourceObjectSize(storagePath)) ?? request.sourceVideo.sizeBytes ?? null;
  const workerConfigured = isWorkerConfigured();

  // The worker is the real path for any duration. Direct inline analysis is only
  // a fallback for small files when no worker is reachable.
  let message: string;
  if (workerConfigured) {
    const health = await checkWorkerHealth();
    message = `Serviço de mídia disponível (${health.ffmpeg?.split(" ").slice(0, 3).join(" ")}). O áudio será extraído no servidor.`;
  } else if (size != null && size <= DIRECT_MEDIA_LIMIT_BYTES) {
    message =
      "Serviço de mídia não configurado: este arquivo é pequeno e será analisado diretamente pelo modelo.";
  } else {
    throw new Error(WORKER_SETUP_MESSAGE);
  }

  const requestedOutputs = [
    ...(request.outputs.shortClips.enabled ? ["short_clips"] : []),
    ...(request.outputs.highlights.enabled ? ["highlights"] : []),
    ...(request.outputs.longEdit.enabled ? ["long_edit"] : []),
  ];

  await supabaseAdmin
    .from("processing_jobs")
    .update({
      request_payload: request as unknown as Row,
      // Snapshot of the exact configuration used, so results stay auditable.
      configuration_snapshot: request as unknown as Row,
      requested_outputs: requestedOutputs,
      worker_stage: workerConfigured ? "ready" : "not_configured",
      worker_last_sync_at: new Date().toISOString(),
      attempt_count: Number(job.attempt_count ?? 0) + 1,
    })
    .eq("id", job.id);

  return moveTo(job, "extracting_audio", { steps: { prepare: "done" }, message });
}

async function runExtractingAudio(job: Row): Promise<Row> {
  const request = await requestPayload(job);
  const storagePath = request.sourceVideo.storagePath!;
  const size = (await getSourceObjectSize(storagePath)) ?? request.sourceVideo.sizeBytes ?? null;

  if (!isWorkerConfigured()) {
    if (size == null || size > DIRECT_MEDIA_LIMIT_BYTES) throw new Error(WORKER_SETUP_MESSAGE);
    return moveTo(job, "transcribing", {
      steps: { extracting_audio: "skipped" },
      message: "Sem serviço de mídia: o áudio original do arquivo será analisado diretamente.",
    });
  }

  // Signed for long enough to cover multi-hour sources.
  const sourceUrl = await createSignedSourceUrl(storagePath, 12 * 3600);
  const { chunks, durationSeconds } = await extractAudio({
    sourceUrl,
    fileName: request.sourceVideo.fileName ?? "source.mp4",
  });


  await updateJob(job.id, {
    // Chunk descriptors are kept on the job so transcription can resume.
    request_payload: { ...request, audioChunks: chunks } as unknown as Row,
    worker_stage: "audio_extracted",
    worker_last_sync_at: new Date().toISOString(),
    worker_payload: { chunks, durationSeconds } as unknown as Row,
  });

  return moveTo(job, "transcribing", {
    steps: { extracting_audio: "done" },
    message: `Áudio extraído pelo serviço de mídia em ${chunks.length} trecho(s) interno(s)${
      durationSeconds ? ` · ${Math.round(durationSeconds / 60)} min de mídia` : ""
    }.`,
  });
}

async function runTranscribing(job: Row): Promise<Row> {
  const payload = (await requestPayload(job)) as AnalysisJobRequest & {
    audioChunks?: Parameters<typeof transcribeAudioChunks>[0]["chunks"];
  };
  const storagePath = payload.sourceVideo.storagePath!;
  const languageHint =
    payload.language.mode === "manual"
      ? (payload.language.transcriptionLanguage ?? payload.language.primary)
      : null;

  const result = payload.audioChunks?.length
    ? await transcribeAudioChunks({ chunks: payload.audioChunks, languageHint })
    : await transcribeDirectSource({
        sourceUrl: await createSignedSourceUrl(storagePath, 3600),
        format: formatForFile(payload.sourceVideo.fileName, payload.sourceVideo.format ?? "mp4"),
        languageHint,
        durationSeconds: payload.sourceVideo.durationSeconds,
      });

  if (result.segments.length === 0) {
    throw new Error(
      "Nenhuma fala foi encontrada no vídeo. Para este tipo de material é necessária a análise de áudio/imagem pelo serviço de mídia externo.",
    );
  }

  await supabaseAdmin.from("transcriptions").delete().eq("project_id", job.project_id);
  await supabaseAdmin.from("transcriptions").insert({
    project_id: job.project_id,
    job_id: job.id,
    requested_language: languageHint,
    detected_language: result.language,
    language: languageHint ?? result.language,
    text: result.text,
    segments: result.segments as unknown as Row,
    provider: "lovable-ai",
    model: "google/gemini-3.6-flash",
    source_kind: payload.audioChunks?.length ? "extracted_audio" : "source_video",
    source_storage_path: storagePath,
    duration_seconds: result.transcribedSeconds,
  });

  await supabaseAdmin
    .from("projects")
    .update({
      detected_language: result.language,
      ...(payload.language.mode === "auto" ? {} : {}),
    })
    .eq("id", job.project_id);

  return moveTo(job, "scoring_segments", {
    steps: {
      detecting_language: "done",
      transcribing: "done",
      analyzing_audio: "done",
      analyzing_video: payload.analysis.sources.includes("video") ? "skipped" : "skipped",
      combining_signals: "done",
    },
    message: `${result.segments.length} trecho(s) de fala transcrito(s)${
      result.language ? ` · idioma ${result.language}` : ""
    }. A análise de imagem depende do serviço de mídia externo e não foi executada.`,
  });
}

async function runScoringSegments(job: Row): Promise<Row> {
  const request = await requestPayload(job);
  const { data: transcription } = await supabaseAdmin
    .from("transcriptions")
    .select("*")
    .eq("project_id", job.project_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!transcription) throw new Error("Transcrição não encontrada para este job.");
  const transcript = (transcription.segments ?? []) as {
    startSeconds: number;
    endSeconds: number;
    text: string;
  }[];

  const selection = await selectShortClipCandidates({
    request,
    transcript,
    durationSeconds:
      request.sourceVideo.durationSeconds ??
      (transcription.duration_seconds == null ? null : Number(transcription.duration_seconds)),
  });
  const candidates = selection.candidates;

  if (candidates.filter((candidate) => candidate.selected).length === 0) {
    throw new Error(
      "A análise não encontrou nenhum trecho que atenda aos critérios configurados. Ajuste os critérios ou a duração dos cortes.",
    );
  }

  /** Real transcript text inside the candidate range — the base for the evaluation. */
  const excerptFor = (startSeconds: number, endSeconds: number): string =>
    transcript
      .filter((segment) => segment.endSeconds > startSeconds && segment.startSeconds < endSeconds)
      .map((segment) => segment.text)
      .join(" ")
      .slice(0, 4000);

  await supabaseAdmin.from("clip_candidates").delete().eq("project_id", job.project_id);
  const { data: inserted, error } = await supabaseAdmin
    .from("clip_candidates")
    .insert(
      candidates.map((candidate, index) => ({
        project_id: job.project_id,
        job_id: job.id,
        start_seconds: candidate.startSeconds,
        end_seconds: candidate.endSeconds,
        duration_seconds: candidate.durationSeconds,
        title: candidate.title,
        reason: candidate.reason,
        explanation: candidate.explanation,
        criteria: candidate.criteria,
        keywords: candidate.keywords,
        topic: candidate.topic,
        category: candidate.category,
        has_speech: candidate.hasSpeech,
        context_requirement: candidate.contextRequirement,
        analysis_confidence: candidate.analysisConfidence,
        // Final, explainable score plus every dimension behind it.
        score: candidate.clipScore,
        clip_score: candidate.clipScore,
        relevance_score: candidate.clipScore,
        quality_score: candidate.composition.intrinsicScore,
        hook_score: candidate.scores.hookScore ?? null,
        context_score: candidate.scores.contextScore ?? null,
        emotion_score: candidate.scores.emotionScore ?? null,
        story_score: candidate.scores.storyScore ?? null,
        novelty_score: candidate.scores.noveltyScore ?? null,
        shareability_score: candidate.scores.shareabilityScore ?? null,
        comment_potential_score: candidate.scores.commentPotentialScore ?? null,
        retention_potential_score: candidate.scores.retentionPotentialScore ?? null,
        creator_fit_score: candidate.scores.creatorFitScore ?? null,
        platform_fit_score: candidate.scores.platformFitScore ?? null,
        growth_potential_score: candidate.scores.growthPotentialScore ?? null,
        top_signals: candidate.topSignals,
        score_breakdown: candidate.composition as unknown as Row,
        score_weights: candidate.composition.weights as unknown as Row,
        intelligence_version: candidate.composition.version,
        diversity_penalty: candidate.diversityPenalty,
        diversity_group: candidate.diversityGroup,
        selected: candidate.selected,
        selection_rank: candidate.selectionRank,
        selection_reason: candidate.selectionReason,
        transcript_excerpt: excerptFor(candidate.startSeconds, candidate.endSeconds),
        analysis_sources: ["transcript", "context"],
        evaluations: { dimensions: candidate.scores } as unknown as Row,
        evaluated_at: new Date().toISOString(),
        order_index: index,
        status: candidate.selected ? "selected" : "discarded",
      })),
    )
    .select("*");
  if (error) throw new Error(error.message);

  // Only the selected candidates become timeline segments / renderable clips.
  const selectedRows = (inserted ?? []).filter((candidate: Row) => candidate.selected);

  await supabaseAdmin.from("video_segments").delete().eq("project_id", job.project_id);
  await supabaseAdmin.from("video_segments").insert(
    selectedRows.map((candidate: Row) => ({
      project_id: job.project_id,
      start_seconds: candidate.start_seconds,
      end_seconds: candidate.end_seconds,
      duration_seconds: candidate.duration_seconds,
      decision: "keep",
      score: candidate.score,
      overall_score: candidate.score,
      transcript_score: candidate.score,
      reason: candidate.explanation ?? candidate.reason,
      reason_summary: candidate.reason,
      category: candidate.category ?? candidate.topic,
      reason_codes: candidate.criteria ?? [],
      analysis_sources: ["transcript", "context"],
    })),
  );

  return moveTo(job, "preparing_outputs", {
    steps: { scoring_segments: "done" },
    message: `${selectedRows.length} de ${selection.evaluatedCount} candidato(s) avaliado(s) foram selecionados (mínimo alvo: ${selection.minimumClipCount}), com notas de hook, contexto, emoção, narrativa, retenção e expansão de alcance.`,
  });
}


async function runPreparingOutputs(job: Row): Promise<Row> {
  const { data: candidates } = await supabaseAdmin
    .from("clip_candidates")
    .select("*")
    .eq("project_id", job.project_id)
    .order("order_index", { ascending: true });

  if (!candidates?.length) throw new Error("Nenhum corte selecionado para preparar.");

  await supabaseAdmin.from("short_clips").delete().eq("project_id", job.project_id);
  const { error } = await supabaseAdmin.from("short_clips").insert(
    candidates.map((candidate, index) => ({
      project_id: job.project_id,
      job_id: job.id,
      candidate_id: candidate.id,
      title: candidate.title,
      duration_seconds: candidate.duration_seconds,
      source_start_seconds: candidate.start_seconds,
      source_end_seconds: candidate.end_seconds,
      category: candidate.topic,
      confidence: candidate.score,
      reason: candidate.reason,
      criteria: candidate.criteria ?? [],
      order_index: index,
      render_status: "pending",
      kept: true,
    })),
  );
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("processing_usage").insert({
    project_id: job.project_id,
    job_id: job.id,
    source_duration_seconds: (await requestPayload(job)).sourceVideo.durationSeconds,
    transcribed_seconds: null,
    rendered_clips: 0,
  });

  return moveTo(job, "rendering", {
    steps: { preparing_outputs: "done" },
    message: `${candidates.length} corte(s) pronto(s) para renderização.`,
  });
}

async function runRendering(job: Row): Promise<Row> {
  if (!isWorkerConfigured()) throw new Error(WORKER_SETUP_MESSAGE);

  const { data: clips } = await supabaseAdmin
    .from("short_clips")
    .select("*")
    .eq("project_id", job.project_id)
    .order("order_index", { ascending: true });

  if (!clips?.length) throw new Error("Nenhum corte encontrado para renderizar.");

  const pending = clips.filter((clip: Row) => clip.render_status === "pending");
  const alreadyRendered = clips.filter((clip: Row) => clip.render_status === "rendered").length;

  if (pending.length === 0) {
    if (alreadyRendered === 0) {
      throw new Error(
        "O serviço de mídia não conseguiu gerar nenhum arquivo de corte. Verifique os logs do serviço de mídia.",
      );
    }
    await supabaseAdmin
      .from("processing_usage")
      .update({ rendered_clips: alreadyRendered })
      .eq("job_id", job.id);
    return moveTo(job, "completed", {
      steps: { rendering: "done" },
      message: `${alreadyRendered} arquivo(s) de corte gerado(s) pelo serviço de mídia.`,
    });
  }

  await checkWorkerHealth();

  const request = await requestPayload(job);
  const sourceUrl = await createSignedSourceUrl(request.sourceVideo.storagePath!, 12 * 3600);

  // Rendered in batches so multi-hour sources report real, incremental progress.
  const batch = pending.slice(0, RENDER_BATCH_SIZE);
  const targets: RenderClipRequest[] = batch.map((clip: Row) => ({
    id: clip.id,
    startSeconds: Number(clip.source_start_seconds),
    endSeconds: Number(clip.source_end_seconds ?? clip.source_start_seconds),
    title: clip.title,
  }));

  const results = await renderClips({
    sourceUrl,
    fileName: request.sourceVideo.fileName ?? "source.mp4",
    clips: targets,
  });

  let rendered = 0;
  for (const result of results) {
    if (result.error || !result.downloadUrl) {
      await supabaseAdmin
        .from("short_clips")
        .update({ render_status: "error", render_error: result.error ?? "Falha na renderização." })
        .eq("id", result.id);
      continue;
    }

    // The worker only serves the file temporarily, so it is persisted here.
    let stored: { path: string; sizeBytes: number };
    try {
      stored = await storeClipFromUrl(`${job.project_id}/${result.id}.mp4`, result.downloadUrl);
    } catch (error) {
      await supabaseAdmin
        .from("short_clips")
        .update({
          render_status: "error",
          render_error: error instanceof Error ? error.message : "Falha ao salvar o corte.",
        })
        .eq("id", result.id);
      continue;
    }

    rendered += 1;
    const duration =
      result.startSeconds != null && result.endSeconds != null
        ? Math.max(0, result.endSeconds - result.startSeconds)
        : null;
    await supabaseAdmin
      .from("short_clips")
      .update({
        render_status: "rendered",
        render_error: null,
        video_storage_path: stored.path,
        file_size_bytes: stored.sizeBytes,
        ...(duration ? { duration_seconds: duration } : {}),
      })
      .eq("id", result.id);
    const candidateId = clips.find((clip: Row) => clip.id === result.id)?.candidate_id;
    if (candidateId) {
      await supabaseAdmin
        .from("clip_candidates")
        .update({ status: "rendered" })
        .eq("id", candidateId);
    }
  }


  const totalRendered = alreadyRendered + rendered;
  const remaining = pending.length - batch.length;

  await supabaseAdmin
    .from("processing_usage")
    .update({ rendered_clips: totalRendered })
    .eq("job_id", job.id);

  if (remaining > 0) {
    // Stays on the rendering stage: the next advance call renders the next batch.
    const progress = 92 + Math.round((totalRendered / clips.length) * 6);
    return updateJob(job.id, {
      stage: "rendering",
      status: "running",
      progress: Math.min(98, progress),
      current_step: "Gerando os arquivos dos cortes",
      stage_message: `${totalRendered} de ${clips.length} corte(s) gerado(s) pelo serviço de mídia.`,
      worker_stage: "rendering",
      worker_last_sync_at: new Date().toISOString(),
      logs: await appendLog(job, `Lote renderizado: ${totalRendered}/${clips.length}.`),
    });
  }

  if (totalRendered === 0) {
    throw new Error(
      "O serviço de mídia não conseguiu gerar nenhum arquivo de corte. Verifique os logs do serviço de mídia.",
    );
  }

  return moveTo(job, "completed", {
    steps: { rendering: "done" },
    message: `${totalRendered} arquivo(s) de corte gerado(s) em ${CLIPS_BUCKET}.`,
  });
}

/* --------------------------------------------------------------- public API */

/** Runs the next pending stage of a job and returns the persisted state. */
export async function advanceJob(jobId: string): Promise<JobSnapshot> {
  let job = await loadJob(jobId);

  if (["completed", "cancelled", "error"].includes(job.status)) return snapshot(job);

  if (job.cancel_requested) {
    const cancelled = await updateJob(job.id, {
      status: "cancelled",
      finished_at: new Date().toISOString(),
      stage_message: "Processamento cancelado pelo usuário.",
      logs: await appendLog(job, "Cancelado pelo usuário."),
    });
    await supabaseAdmin
      .from("projects")
      .update({ status: "ready", analysis_status: "configured" })
      .eq("id", job.project_id);
    return snapshot(cancelled);
  }

  const stage = (job.stage ?? "queued") as AnalysisStage;

  try {
    switch (stage) {
      case "queued":
        job = await moveTo(job, "preparing", { message: "Validando o vídeo de origem." });
        break;
      case "preparing":
        job = await runPreparing(job);
        break;
      case "extracting_audio":
        job = await runExtractingAudio(job);
        break;
      case "detecting_language":
      case "transcribing":
        job = await runTranscribing(job);
        break;
      case "analyzing_audio":
      case "analyzing_video":
      case "combining_signals":
      case "scoring_segments":
        job = await runScoringSegments(job);
        break;
      case "preparing_outputs":
        job = await runPreparingOutputs(job);
        break;
      case "rendering":
        job = await runRendering(job);
        break;
      default:
        return snapshot(job);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha inesperada durante o processamento.";
    return failJob(job, stage, message);
  }

  return snapshot(job);
}

/** Which real capabilities are currently connected (verified, not assumed). */
export async function getCapabilities() {
  const worker = getWorkerConfig();
  let workerHealthy = false;
  let workerFfmpeg: string | null = null;
  let workerError: string | null = null;

  if (worker) {
    try {
      const health = await checkWorkerHealth();
      workerHealthy = health.ok;
      workerFfmpeg = health.ffmpeg;
    } catch (error) {
      workerError = error instanceof Error ? error.message : "Serviço de mídia inacessível.";
    }
  }

  return {
    aiConfigured: Boolean(process.env["LOVABLE_API_KEY"]),
    mediaWorkerConfigured: Boolean(worker),
    workerHealthy,
    workerFfmpeg,
    workerError,
    workerAuthenticated: Boolean(worker?.token),
    directMediaLimitBytes: DIRECT_MEDIA_LIMIT_BYTES,
    mediaWorkerSetupMessage: WORKER_SETUP_MESSAGE,
    renderWorkerSetupMessage: workerError ?? WORKER_SETUP_MESSAGE,
  };
}
