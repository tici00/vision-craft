import { Link2Off, TrendingUp } from "lucide-react";

import { CREATOR_MIN_SAMPLE, type CreatorIntelligence } from "@/services/intelligence/creatorIntelligence";
import { PLATFORM_FORMATS, isPlatformConnected } from "@/services/publishing/contracts";

/**
 * Creator Intelligence, shown strictly as far as the real data allows: with no
 * observed publications the panel says so instead of displaying patterns.
 * Platform integrations are listed with their real connection state.
 */
export function CreatorIntelligencePanel({ creator }: { creator: CreatorIntelligence }) {
  const hasPatterns =
    creator.bestDurations.length > 0 ||
    creator.bestTopics.length > 0 ||
    creator.bestPlatforms.length > 0;

  return (
    <section className="panel p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Creator Intelligence</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {creator.summary}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {creator.sampleSize}
          </p>
          <p className="text-[11px] text-muted-foreground">publicações medidas</p>
        </div>
      </header>

      {hasPatterns ? (
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <PatternList title="Durações que performam" patterns={creator.bestDurations} />
          <PatternList title="Temas que performam" patterns={creator.bestTopics} />
          <PatternList title="Plataformas" patterns={creator.bestPlatforms} />
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-border bg-surface-raised/50 p-4 text-xs leading-relaxed text-muted-foreground">
          Ainda não há resultados reais suficientes ({CREATOR_MIN_SAMPLE} publicações medidas) para
          aprender padrões deste criador. Até lá, as notas usam apenas o conhecimento geral de
          performance e as características do conteúdo atual — nada é estimado.
        </p>
      )}

      {creator.weights && (
        <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-success">
          <TrendingUp className="size-3.5" />
          Pesos das dimensões já ajustados pelo histórico real deste criador.
        </p>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Plataformas</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A arquitetura de integração está pronta; nenhuma conta está conectada, portanto nenhum
          número é importado automaticamente.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {PLATFORM_FORMATS.map((format) => (
            <li
              key={format.platform}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised/50 px-3 py-2.5"
            >
              <div>
                <p className="text-xs font-medium text-foreground">{format.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format.aspectRatio} · {format.minSeconds}–{format.maxSeconds}s
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Link2Off className="size-3" />
                {isPlatformConnected(format.platform) ? "Conectado" : "Não conectado"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PatternList({
  title,
  patterns,
}: {
  title: string;
  patterns: CreatorIntelligence["bestDurations"];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {patterns.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Sem dados suficientes.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {patterns.map((pattern) => (
            <li key={pattern.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{pattern.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(pattern.relativePerformance * 100)}% · n={pattern.sampleSize}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
