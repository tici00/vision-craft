/**
 * Catalogs for the "Configurar análise" step.
 * Pure presentation/domain data — no persistence logic lives here so the same
 * option codes can be consumed later by the analysis pipeline services.
 */

import type {
  AnalysisMode,
  ClipsDurationPreference,
  ContextLevel,
  EditConfiguration,
  EditIntensity,
  HighlightsStyle,
  SpeechPriority,
} from "@/types/video-editor";

export interface Option<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export const LANGUAGES: Option[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
  { value: "fr", label: "Francês" },
  { value: "de", label: "Alemão" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japonês" },
  { value: "ko", label: "Coreano" },
  { value: "other", label: "Outro" },
  { value: "auto", label: "Detectar automaticamente" },
];

export const DEFAULT_LANGUAGE = "pt-BR";

export function languageLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return LANGUAGES.find((language) => language.value === code)?.label ?? code;
}

export const CONTENT_TYPES: Option[] = [
  { value: "live", label: "Live / transmissão ao vivo" },
  { value: "gameplay", label: "Gameplay" },
  { value: "commentary", label: "Comentário" },
  { value: "reaction", label: "Reação" },
  { value: "chat", label: "Conversa / bate-papo" },
  { value: "podcast", label: "Podcast" },
  { value: "tutorial", label: "Tutorial" },
  { value: "educational", label: "Vídeo educativo" },
  { value: "vlog", label: "Vlog" },
  { value: "interview", label: "Entrevista" },
  { value: "review", label: "Review" },
  { value: "entertainment", label: "Conteúdo de entretenimento" },
  { value: "other", label: "Outro" },
];

export const AUDIO_VIDEO_FLAGS: Option[] = [
  { value: "game_audio_voices", label: "O áudio do jogo pode conter vozes" },
  { value: "background_music", label: "Há música de fundo" },
  { value: "frequent_app_sounds", label: "Há sons frequentes do jogo ou aplicativo" },
  { value: "other_people_speaking", label: "Há outras pessoas falando" },
  { value: "visual_moments_without_speech", label: "Há momentos sem fala visualmente importantes" },
  { value: "on_screen_text", label: "O vídeo contém leitura de textos na tela" },
  { value: "has_webcam", label: "O conteúdo possui webcam" },
  { value: "screen_plus_webcam", label: "O conteúdo possui tela principal + webcam" },
  { value: "other", label: "Outro" },
];

export const CLIP_CRITERIA: Option[] = [
  { value: "funny", label: "Momentos engraçados" },
  { value: "reactions", label: "Reações" },
  { value: "interesting_talk", label: "Conversas interessantes" },
  { value: "high_energy", label: "Momentos de maior energia" },
  { value: "key_events", label: "Jogadas ou acontecimentos importantes" },
  { value: "surprising", label: "Momentos surpreendentes" },
  { value: "strong_quotes", label: "Frases marcantes" },
  { value: "shareable", label: "Maior potencial de compartilhamento" },
  { value: "topic_diversity", label: "Diversidade de assuntos" },
  { value: "auto_balanced", label: "Escolha automática equilibrada" },
];

export const HIGHLIGHT_CRITERIA: Option[] = [
  { value: "entertainment", label: "Entretenimento" },
  { value: "humor", label: "Humor" },
  { value: "reactions", label: "Reações" },
  { value: "key_moments", label: "Momentos importantes" },
  { value: "interesting_talk", label: "Conversas interessantes" },
  { value: "story_development", label: "Desenvolvimento de acontecimentos" },
  { value: "best_performance", label: "Melhor desempenho no jogo ou atividade" },
  { value: "diversity", label: "Diversidade" },
  { value: "auto", label: "Escolha automática" },
];

export const LONG_EDIT_REMOVE_FLAGS: Option[] = [
  { value: "long_silences", label: "Silêncios longos" },
  { value: "idle_pauses", label: "Pausas sem interação" },
  { value: "waiting_time", label: "Tempo de espera" },
  { value: "repetitions", label: "Repetições" },
  { value: "no_relevant_activity", label: "Momentos sem atividade relevante" },
  { value: "loading_screens", label: "Telas de carregamento" },
  { value: "breaks", label: "Intervalos" },
  { value: "low_energy", label: "Momentos de baixa energia" },
  { value: "no_speech_no_visual", label: "Trechos sem fala e sem evento visual relevante" },
];

export const CLIP_DURATION_OPTIONS: Option<ClipsDurationPreference>[] = [
  { value: "15_30", label: "15 a 30 segundos" },
  { value: "30_60", label: "30 a 60 segundos" },
  { value: "60_90", label: "60 a 90 segundos" },
  { value: "up_to_180", label: "Até 3 minutos" },
  { value: "auto", label: "Automático" },
];

export const CLIP_DURATION_RANGE: Record<
  ClipsDurationPreference,
  { min: number | null; max: number | null }
> = {
  "15_30": { min: 15, max: 30 },
  "30_60": { min: 30, max: 60 },
  "60_90": { min: 60, max: 90 },
  up_to_180: { min: 20, max: 180 },
  auto: { min: null, max: null },
};

export const SPEECH_PRIORITY_OPTIONS: Option<SpeechPriority>[] = [
  { value: "always", label: "Sempre" },
  { value: "preferred", label: "Preferencialmente" },
  { value: "optional", label: "Não é obrigatório" },
];

export const HIGHLIGHT_PRESET_MINUTES = [5, 10, 15, 20, 30];

export const HIGHLIGHT_STYLES: Option<HighlightsStyle>[] = [
  {
    value: "dynamic",
    label: "Mais dinâmico",
    description: "Prioriza os momentos mais fortes e reduz transições.",
  },
  {
    value: "balanced",
    label: "Equilibrado",
    description: "Mantém variedade e contexto suficiente.",
  },
  {
    value: "complete",
    label: "Mais completo",
    description: "Preserva mais desenvolvimento entre os melhores momentos.",
  },
];

export const CONTEXT_LEVELS: Option<ContextLevel>[] = [
  { value: "minimal", label: "Mínimo" },
  { value: "balanced", label: "Equilibrado" },
  { value: "high", label: "Alto" },
];

export const PRESERVE_CONTEXT_LEVELS: Option<ContextLevel>[] = [
  { value: "minimal", label: "Pouco" },
  { value: "balanced", label: "Equilibrado" },
  { value: "high", label: "Muito" },
];

export const LONG_EDIT_INTENSITIES: Option<EditIntensity>[] = [
  {
    value: "conservative",
    label: "Conservador",
    description: "Remove apenas silêncios claros e trechos obviamente vazios.",
  },
  {
    value: "balanced",
    label: "Equilibrado",
    description: "Corta trechos de baixo valor preservando o contexto do conteúdo.",
  },
  {
    value: "aggressive",
    label: "Agressivo",
    description: "Mantém somente o material mais forte; resultado mais curto.",
  },
];

export const SILENCE_OPTIONS: Option[] = [
  { value: "off", label: "Não remover automaticamente" },
  { value: "5", label: "Remover silêncios acima de 5 segundos" },
  { value: "10", label: "Remover silêncios acima de 10 segundos" },
  { value: "20", label: "Remover silêncios acima de 20 segundos" },
  { value: "custom", label: "Personalizado" },
];

export const ANALYSIS_MODES: Option<AnalysisMode>[] = [
  {
    value: "audio_only",
    label: "Somente áudio",
    description: "Usa energia, silêncio e sons. Mais rápido, menos preciso.",
  },
  {
    value: "audio_speech",
    label: "Áudio + fala",
    description: "Considera áudio e transcrição da fala.",
  },
  {
    value: "multimodal",
    label: "Multimodal (recomendado)",
    description: "Combina áudio, fala, imagem e o contexto informado por você.",
  },
];

export const ANALYSIS_MODE_LABEL: Record<AnalysisMode, string> = {
  audio_only: "Áudio",
  audio_speech: "Áudio + fala",
  multimodal: "Áudio + fala + imagem + contexto",
};

export const CLIP_QUANTITY_PRESETS = [3, 5, 10, 15];

export const CLIPS_MAX_QUANTITY = 50;
export const HIGHLIGHTS_MAX_MINUTES = 240;
export const SILENCE_MAX_SECONDS = 600;

export function optionLabels(options: Option[], values: string[]): string[] {
  return values.map((value) => options.find((option) => option.value === value)?.label ?? value);
}

/** Smart defaults used for brand-new projects. */
export const DEFAULT_ANALYSIS_CONFIG: Omit<EditConfiguration, "id" | "projectId"> = {
  wantShortClips: true,
  wantHighlights: false,
  wantLongEdit: false,

  languageMode: "manual",
  primaryLanguage: DEFAULT_LANGUAGE,
  secondaryLanguages: [],
  hasMultipleLanguages: false,
  transcriptionLanguage: DEFAULT_LANGUAGE,

  contentTypes: [],
  videoContext: null,
  mainActivity: null,
  analysisNotes: null,
  importantAudioVideoFlags: [],
  analysisMode: "multimodal",

  clipsQuantityMode: "auto",
  clipsQuantity: null,
  clipsDurationPreference: "auto",
  clipsSelectionCriteria: ["auto_balanced"],
  avoidSimilarClips: true,
  speechPriority: "preferred",
  clipMinSeconds: null,
  clipMaxSeconds: null,

  highlightsDurationMode: "preset",
  highlightsDurationMinutes: 15,
  highlightsTargetSeconds: 900,
  highlightsEditingStyle: "balanced",
  highlightsCriteria: ["auto"],
  highlightsContextLevel: "balanced",

  longEditIntensity: "balanced",
  longEditRemoveFlags: ["long_silences", "waiting_time", "no_relevant_activity"],
  removeSilences: true,
  silenceThresholdSeconds: 10,
  removeWaiting: true,
  removeRepetitions: false,
  removeLowActivity: true,
  preserveVisualEvents: true,
  preserveWebcamReactions: true,
  preserveContextLevel: "balanced",
};

export const CONTEXT_TEXT_MAX = 2000;
export const NOTES_TEXT_MAX = 1000;
