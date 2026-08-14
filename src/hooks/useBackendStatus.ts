import { useQuery } from "@tanstack/react-query";

import { getProcessingCapabilities } from "@/lib/processing.functions";

export type BackendStatusLevel = "ok" | "degraded" | "offline";

export interface BackendStatus {
  level: BackendStatusLevel;
  title: string;
  detail: string;
  aiConfigured: boolean;
  workerConfigured: boolean;
  workerHealthy: boolean;
  workerFfmpeg: string | null;
}

/**
 * Single source of truth for what the UI is allowed to claim about the backend.
 * Every status shown to the user comes from a real, verified health check —
 * there are no hardcoded statements about workers anywhere in the interface.
 */
export function useBackendStatus() {
  const query = useQuery({
    queryKey: ["backend-status"],
    queryFn: () => getProcessingCapabilities(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = query.data;
  const ffmpeg = data?.workerFfmpeg ? (/\d+[\w.+-]*/.exec(data.workerFfmpeg)?.[0] ?? null) : null;
  const status: BackendStatus | null = data
    ? {
        level: !data.mediaWorkerConfigured
          ? "offline"
          : data.workerHealthy && data.aiConfigured
            ? "ok"
            : "degraded",
        title: !data.mediaWorkerConfigured
          ? "Serviço de mídia não configurado"
          : data.workerHealthy
            ? data.aiConfigured
              ? "Análise e renderização conectadas"
              : "Renderização conectada, análise indisponível"
            : "Serviço de mídia iniciando ou indisponível",
        detail: !data.mediaWorkerConfigured
          ? data.mediaWorkerSetupMessage
          : data.workerHealthy
            ? `ffmpeg ${ffmpeg ?? "disponível"} · transcrição e cortes reais habilitados.`
            : (data.workerError ??
              "O serviço pode estar acordando após inatividade. A verificação é repetida automaticamente."),
        aiConfigured: data.aiConfigured,
        workerConfigured: data.mediaWorkerConfigured,
        workerHealthy: data.workerHealthy,
        workerFfmpeg: ffmpeg,
      }
    : null;

  return { ...query, status };
}
