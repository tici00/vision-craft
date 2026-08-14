import { ChevronDown, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/format";
import { CLIP_DIMENSIONS } from "@/services/intelligence/clipIntelligence";
import type { ClipIntelligenceEntry } from "@/services/intelligence/intelligenceService";
import { reachAudienceLabel } from "@/services/intelligence/reachExpansion";

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)}`;
}

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const width = value === null || value === undefined ? 0 : Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{pct(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            width >= 70 ? "bg-success" : width >= 45 ? "bg-warning" : "bg-destructive/80",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Renders the real Clip Intelligence stored for a candidate: composed score,
 * every dimension, the model's written justification, the selection decision
 * and the Reach Expansion reading. Nothing is computed for display purposes.
 */
export function ClipIntelligenceCard({ entry }: { entry: ClipIntelligenceEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="panel p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                entry.selected
                  ? "bg-success/15 text-success"
                  : "bg-surface-raised text-muted-foreground",
              )}
            >
              {entry.selected ? `Selecionado #${entry.selectionRank ?? "—"}` : "Não selecionado"}
            </span>
            {entry.topic && (
              <span className="truncate text-[11px] text-muted-foreground">{entry.topic}</span>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-foreground">{entry.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatTimecode(entry.startSeconds)} – {formatTimecode(entry.endSeconds)} ·{" "}
            {Math.round(entry.durationSeconds)}s
            {entry.analysisConfidence !== null
              ? ` · confiança da análise ${pct(entry.analysisConfidence)}%`
              : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {pct(entry.clipScore)}
          </p>
          <p className="text-[11px] text-muted-foreground">Clip score</p>
        </div>
      </header>

      {entry.topSignals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {entry.topSignals.map((signal) => (
            <span
              key={signal}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            >
              <Sparkles className="size-3" />
              {signal}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <ScoreBar label="Público atual" value={entry.reach.coreAppeal} />
        <ScoreBar label="Expansão de alcance" value={entry.reach.expansionPotential} />
        <ScoreBar label="Dependência de contexto" value={entry.reach.contextBarrier} />
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Users className="size-3.5" />
        {reachAudienceLabel(entry.reach.audience)}
        {entry.reach.usedCreatorHistory ? " · usa histórico real do criador" : ""}
      </p>

      {entry.explanation && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{entry.explanation}</p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-4 -ml-2 text-xs text-muted-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? "Ocultar detalhes" : "Ver todas as dimensões"}
      </Button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-border pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {CLIP_DIMENSIONS.map((dimension) => (
              <ScoreBar
                key={dimension.key}
                label={dimension.label}
                value={entry.scores[dimension.key] ?? null}
              />
            ))}
          </div>

          {entry.reach.reasons.length > 0 && (
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {entry.reach.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          )}

          <dl className="grid gap-3 text-[11px] sm:grid-cols-2">
            {entry.selectionReason && (
              <div>
                <dt className="text-muted-foreground">Decisão</dt>
                <dd className="mt-0.5 text-foreground">{entry.selectionReason}</dd>
              </div>
            )}
            {entry.diversityGroup && (
              <div>
                <dt className="text-muted-foreground">Grupo de diversidade</dt>
                <dd className="mt-0.5 text-foreground">
                  {entry.diversityGroup}
                  {entry.diversityPenalty
                    ? ` · penalidade ${Math.round(entry.diversityPenalty * 100)}%`
                    : ""}
                </dd>
              </div>
            )}
            {entry.contextRequirement && (
              <div>
                <dt className="text-muted-foreground">Contexto necessário</dt>
                <dd className="mt-0.5 text-foreground">{entry.contextRequirement}</dd>
              </div>
            )}
            {entry.intelligenceVersion && (
              <div>
                <dt className="text-muted-foreground">Versão da inteligência</dt>
                <dd className="mt-0.5 text-foreground">{entry.intelligenceVersion}</dd>
              </div>
            )}
          </dl>

          {entry.transcriptExcerpt && (
            <p className="rounded-lg bg-surface-raised/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
              “{entry.transcriptExcerpt}”
            </p>
          )}
        </div>
      )}
    </article>
  );
}
