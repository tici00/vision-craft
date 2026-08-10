import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  Film,
  Languages,
  Loader2,
  MessageSquareText,
  Scissors,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfigSection, FieldLabel, OptionChips, SummaryLine } from "@/components/analysis/ConfigSection";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDurationLabel } from "@/lib/format";
import {
  ANALYSIS_MODES,
  ANALYSIS_MODE_LABEL,
  AUDIO_VIDEO_FLAGS,
  CLIP_CRITERIA,
  CLIP_DURATION_OPTIONS,
  CLIP_DURATION_RANGE,
  CLIP_QUANTITY_PRESETS,
  CLIPS_MAX_QUANTITY,
  CONTENT_TYPES,
  CONTEXT_LEVELS,
  CONTEXT_TEXT_MAX,
  DEFAULT_ANALYSIS_CONFIG,
  HIGHLIGHT_CRITERIA,
  HIGHLIGHT_PRESET_MINUTES,
  HIGHLIGHT_STYLES,
  HIGHLIGHTS_MAX_MINUTES,
  LANGUAGES,
  LONG_EDIT_INTENSITIES,
  LONG_EDIT_REMOVE_FLAGS,
  NOTES_TEXT_MAX,
  PRESERVE_CONTEXT_LEVELS,
  SILENCE_MAX_SECONDS,
  SPEECH_PRIORITY_OPTIONS,
  languageLabel,
  optionLabels,
} from "@/lib/analysis-options";
import { projectQueries } from "@/services/queries";
import { videoProcessingService } from "@/services/videoProcessingService";
import type { EditConfiguration } from "@/types/video-editor";

export const Route = createFileRoute("/projects/$projectId/configure")({
  head: () => ({
    meta: [
      { title: "Configurar análise — AI Video Editor" },
      {
        name: "description",
        content:
          "Defina idioma, contexto do vídeo, modo de análise e as configurações de cada resultado antes de enviar o projeto para processamento.",
      },
      { property: "og:title", content: "Configurar análise — AI Video Editor" },
      {
        property: "og:description",
        content:
          "Idioma, contexto, modo de análise e configurações de cortes, highlights e vídeo editado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigurePage;
});

type FormState = Omit<EditConfiguration, "id" | "projectId">;

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ConfigurePage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const project = useQuery(projectQueries.detail(projectId));
  const existing = useQuery(projectQueries.configuration(projectId));

  const [form, setForm] = useState<FormState>(DEFAULT_ANALYSIS_CONFIG);
  const [silenceMode, setSilenceMode] = useState<"off" | "preset" | "custom">("preset");

  useEffect(() => {
    const config = existing.data;
    if (!config) return;
    const { id: _id, projectId: _projectId, ...rest } = config;
    setForm(rest);
    if (!config.removeSilences) setSilenceMode("off");
    else if ([5, 10, 20].includes(config.silenceThresholdSeconds ?? 10)) setSilenceMode("preset");
    else setSilenceMode("custom");
  }, [existing.data]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectedCount = [form.wantShortClips, form.wantHighlights, form.wantLongEdit].filter(
    Boolean,
  ).length;

  const highlightsSeconds = useMemo(
    () => Math.max(1, form.highlightsDurationMinutes ?? 15) * 60,
    [form.highlightsDurationMinutes],
  );

  const clipRange = CLIP_DURATION_RANGE[form.clipsDurationPreference];

  const buildPayload = () => ({
    projectId,
    ...form,
    highlightsTargetSeconds: form.wantHighlights ? highlightsSeconds : null,
    clipMinSeconds: clipRange.min,
    clipMaxSeconds: clipRange.max,
    transcriptionLanguage:
      form.languageMode === "auto" ? null : (form.transcriptionLanguage ?? form.primaryLanguage),
    videoContext: form.videoContext?.trim() ? form.videoContext.trim().slice(0, CONTEXT_TEXT_MAX) : null,
    mainActivity: form.mainActivity?.trim() ? form.mainActivity.trim().slice(0, 200) : null,
    analysisNotes: form.analysisNotes?.trim()
      ? form.analysisNotes.trim().slice(0, NOTES_TEXT_MAX)
      : null,
  });

  const saveDraft = useMutation({
    mutationFn: () => videoProcessingService.saveConfiguration(buildPayload()),
    onSuccess: () => {
      toast.success("Configuração salva");
      void existing.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startProcessing = useMutation({
    mutationFn: async () => {
      await videoProcessingService.saveConfiguration(buildPayload());
      return videoProcessingService.createProcessingJob(projectId);
    },
    onSuccess: () => {
      toast.success("Projeto enviado para a fila de processamento");
      void navigate({ to: "/projects/$projectId/processing", params: { projectId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = saveDraft.isPending || startProcessing.isPending;

  return (
    <>
      <TopBar
        title={project.data?.name ?? "Configurar análise"}
        subtitle="Etapa 2 de 2 · Configuração da análise"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => saveDraft.mutate()}
            >
              {saveDraft.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar configuração
            </Button>
            <Button
              size="sm"
              disabled={selectedCount === 0 || busy}
              onClick={() => startProcessing.mutate()}
            >
              {startProcessing.isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar para processamento
            </Button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1280px] px-6 py-10 lg:px-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Configurar análise
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Estas informações orientam a análise do vídeo{" "}
          <span className="text-foreground">
            {project.isLoading ? "…" : (project.data?.sourceFileName ?? "deste projeto")}
          </span>
          {project.data?.durationSeconds != null && (
            <> · {formatDurationLabel(project.data.durationSeconds)}</>
          )}
          . Quanto mais contexto você fornecer, melhor a seleção dos trechos.
        </p>

        {existing.isLoading ? (
          <div className="mt-10 space-y-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {/* ---------------------------------------------- language */}
            <ConfigSection
              step={1}
              icon={<Languages className="size-4" />}
              title="Idioma do vídeo"
              description="Usado para a transcrição da fala e para interpretar o conteúdo falado."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel>Definição do idioma</FieldLabel>
                  <OptionChips
                    options={[
                      { value: "manual", label: "Informar idioma" },
                      { value: "auto", label: "Detectar automaticamente" },
                    ]}
                    selected={[form.languageMode]}
                    onSelect={(value) => set("languageMode", value as FormState["languageMode"])}
                  />
                </div>
                {form.languageMode === "manual" && (
                  <div>
                    <FieldLabel>Idioma principal</FieldLabel>
                    <OptionChips
                      options={LANGUAGES.filter((option) => option.value !== "auto")}
                      selected={[form.primaryLanguage]}
                      onSelect={(value) => {
                        set("primaryLanguage", value);
                        set("transcriptionLanguage", value);
                      }}
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    O vídeo tem mais de um idioma
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    A transcrição considera os idiomas adicionais informados.
                  </span>
                </span>
                <Switch
                  checked={form.hasMultipleLanguages}
                  onCheckedChange={(checked) => set("hasMultipleLanguages", checked)}
                />
              </label>

              {form.hasMultipleLanguages && (
                <div>
                  <FieldLabel>Idiomas adicionais</FieldLabel>
                  <OptionChips
                    options={LANGUAGES.filter(
                      (option) => option.value !== "auto" && option.value !== form.primaryLanguage,
                    )}
                    selected={form.secondaryLanguages}
                    onSelect={(value) =>
                      set("secondaryLanguages", toggleIn(form.secondaryLanguages, value))
                    }
                    multiple
                  />
                </div>
              )}
            </ConfigSection>

            {/* ----------------------------------------------- context */}
            <ConfigSection
              step={2}
              icon={<MessageSquareText className="size-4" />}
              title="Contexto do vídeo"
              description="Descreva o conteúdo para que a análise entenda o que é relevante."
            >
              <div>
                <FieldLabel hint="Selecione todos que se aplicam.">Tipo de conteúdo</FieldLabel>
                <OptionChips
                  options={CONTENT_TYPES}
                  selected={form.contentTypes}
                  onSelect={(value) => set("contentTypes", toggleIn(form.contentTypes, value))}
                  multiple
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <Label htmlFor="main-activity" className="text-xs">
                    Atividade principal (opcional)
                  </Label>
                  <Input
                    id="main-activity"
                    className="mt-2"
                    maxLength={200}
                    placeholder="Ex.: jogando Minecraft com amigos"
                    value={form.mainActivity ?? ""}
                    onChange={(event) => set("mainActivity", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="analysis-notes" className="text-xs">
                    Observações para a análise (opcional)
                  </Label>
                  <Input
                    id="analysis-notes"
                    className="mt-2"
                    maxLength={NOTES_TEXT_MAX}
                    placeholder="Ex.: ignorar os primeiros minutos de espera"
                    value={form.analysisNotes ?? ""}
                    onChange={(event) => set("analysisNotes", event.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="video-context" className="text-xs">
                  Sobre o que é este vídeo? (opcional)
                </Label>
                <Textarea
                  id="video-context"
                  className="mt-2 min-h-28"
                  maxLength={CONTEXT_TEXT_MAX}
                  placeholder="Explique o que acontece no vídeo, quem aparece e o que deve ser valorizado."
                  value={form.videoContext ?? ""}
                  onChange={(event) => set("videoContext", event.target.value)}
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground/80">
                  {(form.videoContext ?? "").length}/{CONTEXT_TEXT_MAX}
                </p>
              </div>

              <div>
                <FieldLabel hint="Ajuda a evitar cortes errados em áudio e imagem.">
                  Informações importantes
                </FieldLabel>
                <OptionChips
                  options={AUDIO_VIDEO_FLAGS}
                  selected={form.importantAudioVideoFlags}
                  onSelect={(value) =>
                    set("importantAudioVideoFlags", toggleIn(form.importantAudioVideoFlags, value))
                  }
                  multiple
                  columns
                />
              </div>

              <div>
                <FieldLabel hint="Define quais sinais a análise vai combinar.">
                  Modo de análise
                </FieldLabel>
                <OptionChips
                  options={ANALYSIS_MODES}
                  selected={[form.analysisMode]}
                  onSelect={(value) => set("analysisMode", value)}
                  columns
                />
              </div>
            </ConfigSection>

            {/* ----------------------------------------------- results */}
            <ConfigSection
              step={3}
              icon={<Wand2 className="size-4" />}
              title="Resultados desejados"
              description="Escolha um ou mais resultados. As configurações de cada um aparecem ao ativá-lo."
            >
              <div className="grid gap-6 lg:grid-cols-3">
                <GoalCard
                  icon={<Scissors className="size-5" />}
                  title="Cortes curtos"
                  description="Momentos independentes prontos para publicar."
                  selected={form.wantShortClips}
                  onToggle={() => set("wantShortClips", !form.wantShortClips)}
                >
                  {form.wantShortClips && (
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Quantidade</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          <MiniChip
                            active={form.clipsQuantityMode === "auto"}
                            onClick={() => {
                              set("clipsQuantityMode", "auto");
                              set("clipsQuantity", null);
                            }}
                          >
                            Automático
                          </MiniChip>
                          {CLIP_QUANTITY_PRESETS.map((preset) => (
                            <MiniChip
                              key={preset}
                              active={
                                form.clipsQuantityMode === "fixed" && form.clipsQuantity === preset
                              }
                              onClick={() => {
                                set("clipsQuantityMode", "fixed");
                                set("clipsQuantity", preset);
                              }}
                            >
                              {preset}
                            </MiniChip>
                          ))}
                          <MiniChip
                            active={form.clipsQuantityMode === "custom"}
                            onClick={() => set("clipsQuantityMode", "custom")}
                          >
                            Personalizado
                          </MiniChip>
                        </div>
                        {form.clipsQuantityMode === "custom" && (
                          <Input
                            type="number"
                            min={1}
                            max={CLIPS_MAX_QUANTITY}
                            className="mt-2"
                            value={form.clipsQuantity ?? ""}
                            onChange={(event) =>
                              set(
                                "clipsQuantity",
                                event.target.value
                                  ? Math.min(
                                      CLIPS_MAX_QUANTITY,
                                      Math.max(1, Number(event.target.value)),
                                    )
                                  : null,
                              )
                            }
                          />
                        )}
                      </div>

                      <div>
                        <FieldLabel>Duração preferida</FieldLabel>
                        <OptionChips
                          options={CLIP_DURATION_OPTIONS}
                          selected={[form.clipsDurationPreference]}
                          onSelect={(value) => set("clipsDurationPreference", value)}
                        />
                      </div>

                      <div>
                        <FieldLabel>Critérios de seleção</FieldLabel>
                        <OptionChips
                          options={CLIP_CRITERIA}
                          selected={form.clipsSelectionCriteria}
                          onSelect={(value) =>
                            set(
                              "clipsSelectionCriteria",
                              toggleIn(form.clipsSelectionCriteria, value),
                            )
                          }
                          multiple
                        />
                      </div>

                      <div>
                        <FieldLabel>Precisa conter fala?</FieldLabel>
                        <OptionChips
                          options={SPEECH_PRIORITY_OPTIONS}
                          selected={[form.speechPriority]}
                          onSelect={(value) => set("speechPriority", value)}
                        />
                      </div>

                      <ToggleRow
                        label="Evitar cortes muito parecidos"
                        checked={form.avoidSimilarClips}
                        onChange={(checked) => set("avoidSimilarClips", checked)}
                      />
                    </div>
                  )}
                </GoalCard>

                <GoalCard
                  icon={<Sparkles className="size-5" />}
                  title="Vídeo de highlights"
                  description="Um vídeo condensado com os melhores momentos."
                  selected={form.wantHighlights}
                  onToggle={() => set("wantHighlights", !form.wantHighlights)}
                >
                  {form.wantHighlights && (
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Duração desejada</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {HIGHLIGHT_PRESET_MINUTES.map((minutes) => (
                            <MiniChip
                              key={minutes}
                              active={
                                form.highlightsDurationMode === "preset" &&
                                form.highlightsDurationMinutes === minutes
                              }
                              onClick={() => {
                                set("highlightsDurationMode", "preset");
                                set("highlightsDurationMinutes", minutes);
                              }}
                            >
                              {minutes} min
                            </MiniChip>
                          ))}
                          <MiniChip
                            active={form.highlightsDurationMode === "custom"}
                            onClick={() => set("highlightsDurationMode", "custom")}
                          >
                            Personalizado
                          </MiniChip>
                        </div>
                        {form.highlightsDurationMode === "custom" && (
                          <Input
                            type="number"
                            min={1}
                            max={HIGHLIGHTS_MAX_MINUTES}
                            className="mt-2"
                            value={form.highlightsDurationMinutes ?? ""}
                            onChange={(event) =>
                              set(
                                "highlightsDurationMinutes",
                                event.target.value
                                  ? Math.min(
                                      HIGHLIGHTS_MAX_MINUTES,
                                      Math.max(1, Number(event.target.value)),
                                    )
                                  : null,
                              )
                            }
                          />
                        )}
                      </div>

                      <div>
                        <FieldLabel>Estilo de edição</FieldLabel>
                        <OptionChips
                          options={HIGHLIGHT_STYLES}
                          selected={[form.highlightsEditingStyle]}
                          onSelect={(value) => set("highlightsEditingStyle", value)}
                        />
                      </div>

                      <div>
                        <FieldLabel>Critérios</FieldLabel>
                        <OptionChips
                          options={HIGHLIGHT_CRITERIA}
                          selected={form.highlightsCriteria}
                          onSelect={(value) =>
                            set("highlightsCriteria", toggleIn(form.highlightsCriteria, value))
                          }
                          multiple
                        />
                      </div>

                      <div>
                        <FieldLabel>Contexto entre os momentos</FieldLabel>
                        <OptionChips
                          options={CONTEXT_LEVELS}
                          selected={[form.highlightsContextLevel]}
                          onSelect={(value) => set("highlightsContextLevel", value)}
                        />
                      </div>
                    </div>
                  )}
                </GoalCard>

                <GoalCard
                  icon={<Film className="size-5" />}
                  title="Vídeo editado longo"
                  description="O vídeo completo sem os trechos de baixo valor."
                  selected={form.wantLongEdit}
                  onToggle={() => set("wantLongEdit", !form.wantLongEdit)}
                >
                  {form.wantLongEdit && (
                    <div className="space-y-4">
                      <div>
                        <FieldLabel>Intensidade da remoção</FieldLabel>
                        <OptionChips
                          options={LONG_EDIT_INTENSITIES}
                          selected={[form.longEditIntensity ?? "balanced"]}
                          onSelect={(value) => set("longEditIntensity", value)}
                        />
                      </div>

                      <div>
                        <FieldLabel>O que remover</FieldLabel>
                        <OptionChips
                          options={LONG_EDIT_REMOVE_FLAGS}
                          selected={form.longEditRemoveFlags}
                          onSelect={(value) =>
                            set("longEditRemoveFlags", toggleIn(form.longEditRemoveFlags, value))
                          }
                          multiple
                        />
                      </div>

                      <div>
                        <FieldLabel>Silêncios</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          <MiniChip
                            active={silenceMode === "off"}
                            onClick={() => {
                              setSilenceMode("off");
                              set("removeSilences", false);
                              set("silenceThresholdSeconds", null);
                            }}
                          >
                            Não remover
                          </MiniChip>
                          {[5, 10, 20].map((seconds) => (
                            <MiniChip
                              key={seconds}
                              active={
                                silenceMode === "preset" &&
                                form.removeSilences &&
                                form.silenceThresholdSeconds === seconds
                              }
                              onClick={() => {
                                setSilenceMode("preset");
                                set("removeSilences", true);
                                set("silenceThresholdSeconds", seconds);
                              }}
                            >
                              &gt; {seconds}s
                            </MiniChip>
                          ))}
                          <MiniChip
                            active={silenceMode === "custom"}
                            onClick={() => {
                              setSilenceMode("custom");
                              set("removeSilences", true);
                            }}
                          >
                            Personalizado
                          </MiniChip>
                        </div>
                        {silenceMode === "custom" && (
                          <Input
                            type="number"
                            min={1}
                            max={SILENCE_MAX_SECONDS}
                            className="mt-2"
                            value={form.silenceThresholdSeconds ?? ""}
                            onChange={(event) =>
                              set(
                                "silenceThresholdSeconds",
                                event.target.value
                                  ? Math.min(
                                      SILENCE_MAX_SECONDS,
                                      Math.max(1, Number(event.target.value)),
                                    )
                                  : null,
                              )
                            }
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <ToggleRow
                          label="Remover tempo de espera"
                          checked={form.removeWaiting}
                          onChange={(checked) => set("removeWaiting", checked)}
                        />
                        <ToggleRow
                          label="Remover repetições"
                          checked={form.removeRepetitions}
                          onChange={(checked) => set("removeRepetitions", checked)}
                        />
                        <ToggleRow
                          label="Remover trechos sem atividade relevante"
                          checked={form.removeLowActivity}
                          onChange={(checked) => set("removeLowActivity", checked)}
                        />
                        <ToggleRow
                          label="Preservar eventos visuais importantes"
                          checked={form.preserveVisualEvents}
                          onChange={(checked) => set("preserveVisualEvents", checked)}
                        />
                        <ToggleRow
                          label="Preservar reações na webcam"
                          checked={form.preserveWebcamReactions}
                          onChange={(checked) => set("preserveWebcamReactions", checked)}
                        />
                      </div>

                      <div>
                        <FieldLabel>Quanto contexto preservar</FieldLabel>
                        <OptionChips
                          options={PRESERVE_CONTEXT_LEVELS}
                          selected={[form.preserveContextLevel]}
                          onSelect={(value) => set("preserveContextLevel", value)}
                        />
                      </div>
                    </div>
                  )}
                </GoalCard>
              </div>
            </ConfigSection>

            {/* ----------------------------------------------- summary */}
            <ConfigSection
              step={4}
              icon={<Check className="size-4" />}
              title="Resumo da configuração"
              description="Este é exatamente o pedido que será enviado ao processamento."
            >
              {selectedCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Selecione ao menos um resultado para enviar o projeto para processamento.
                </p>
              ) : (
                <div className="grid gap-x-10 lg:grid-cols-2">
                  <div>
                    <SummaryLine
                      label="Idioma"
                      value={
                        form.languageMode === "auto"
                          ? "Detecção automática"
                          : [
                              languageLabel(form.primaryLanguage),
                              ...(form.hasMultipleLanguages
                                ? form.secondaryLanguages.map(languageLabel)
                                : []),
                            ].join(" · ")
                      }
                    />
                    <SummaryLine
                      label="Tipo de conteúdo"
                      value={
                        form.contentTypes.length
                          ? optionLabels(CONTENT_TYPES, form.contentTypes).join(", ")
                          : "Não informado"
                      }
                    />
                    <SummaryLine
                      label="Modo de análise"
                      value={ANALYSIS_MODE_LABEL[form.analysisMode]}
                    />
                    <SummaryLine
                      label="Contexto informado"
                      value={form.videoContext?.trim() ? "Sim" : "Não"}
                    />
                  </div>
                  <div>
                    {form.wantShortClips && (
                      <SummaryLine
                        label="Cortes curtos"
                        value={`${
                          form.clipsQuantityMode === "auto"
                            ? "Quantidade automática"
                            : `${form.clipsQuantity ?? "—"} cortes`
                        } · ${
                          CLIP_DURATION_OPTIONS.find(
                            (option) => option.value === form.clipsDurationPreference,
                          )?.label
                        }`}
                      />
                    )}
                    {form.wantHighlights && (
                      <SummaryLine
                        label="Highlights"
                        value={`${formatDurationLabel(highlightsSeconds)} · ${
                          HIGHLIGHT_STYLES.find(
                            (style) => style.value === form.highlightsEditingStyle,
                          )?.label
                        }`}
                      />
                    )}
                    {form.wantLongEdit && (
                      <SummaryLine
                        label="Vídeo editado longo"
                        value={`${
                          LONG_EDIT_INTENSITIES.find(
                            (option) => option.value === form.longEditIntensity,
                          )?.label
                        }${
                          form.removeSilences
                            ? ` · silêncios > ${form.silenceThresholdSeconds ?? 10}s`
                            : " · silêncios preservados"
                        }`}
                      />
                    )}
                  </div>
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground/80">
                O processamento real (transcrição, análise e renderização) ainda não está conectado.
                O projeto fica na fila com esta configuração salva até que um worker de
                processamento a consuma — nenhum progresso é simulado.
              </p>
            </ConfigSection>
          </div>
        )}
      </main>
    </>
  );
}

function MiniChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="text-xs text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function GoalCard({
  icon,
  title,
  description,
  selected,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card/60 p-5 text-left transition-colors",
        selected ? "border-primary/60 ring-1 ring-primary/25" : "border-border",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex items-start justify-between gap-3 text-left"
      >
        <span className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <span>
            <span className="block text-base font-semibold text-foreground">{title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {description}
            </span>
          </span>
        </span>
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
      </button>
      {children}
    </div>
  );
}
