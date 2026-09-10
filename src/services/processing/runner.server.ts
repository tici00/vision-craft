/**
 * Backend job runner.
 *
 * The browser never advances the pipeline: it only creates the job and polls
 * its persisted state. This module owns execution:
 *
 *  - `runJob(jobId)` claims a lease on the job (single-flight) and advances
 *    stages with `advanceJob` until the job finishes, the time budget for the
 *    invocation is spent, or a stage fails.
 *  - `sweepJobs()` is called by the scheduled hook and picks up jobs that are
 *    queued or whose lease went stale (crashed/interrupted invocation), so a
 *    long recording keeps moving forward without any tab being open.
 *
 * Everything relies on the already-persisted job state (`stage`, `steps`,
 * `progress`, `last_heartbeat_at`, transcription `completed_chunks`), so a
 * resumed run never re-does finished work and never duplicates rows.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { advanceJob, type JobSnapshot } from "./pipeline.server";

/** A lease older than this means the previous invocation died. */
export const LEASE_STALE_MS = 90_000;
/**
 * Wall-clock budget for one invocation; the sweep continues afterwards.
 *
 * The work always runs while the HTTP response of the triggering request is
 * still pending — that is what keeps the edge invocation alive. The budget must
 * therefore stay comfortably below the scheduler's own request timeout (55s).
 */
export const RUN_BUDGET_MS = 30_000;
/** Hard cap on stage advances per invocation (defensive, avoids hot loops). */
const MAX_STEPS_PER_RUN = 40;
/** Jobs picked up per sweep. */
const SWEEP_BATCH = 3;

const TERMINAL = ["completed", "cancelled", "error"];

export interface RunResult {
  jobId: string;
  claimed: boolean;
  steps: number;
  snapshot: JobSnapshot | null;
  reason: "finished" | "budget" | "not_claimed" | "terminal";
}

/**
 * Atomically claims the job by writing a fresh heartbeat only when no other
 * invocation holds a live lease. Two concurrent runners cannot both win: the
 * conditional update matches at most one row.
 */
async function claimJob(jobId: string): Promise<boolean> {
  const { data: job, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, last_heartbeat_at")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("Job de processamento não encontrado.");
  if (TERMINAL.includes(job.status)) return false;

  const staleBefore = new Date(Date.now() - LEASE_STALE_MS).toISOString();
  const now = new Date().toISOString();

  // Case 1: no lease yet.
  const fresh = await supabaseAdmin
    .from("processing_jobs")
    .update({ last_heartbeat_at: now })
    .eq("id", jobId)
    .is("last_heartbeat_at", null)
    .select("id");
  if (!fresh.error && (fresh.data?.length ?? 0) > 0) return true;

  // Case 2: previous lease expired.
  const stale = await supabaseAdmin
    .from("processing_jobs")
    .update({ last_heartbeat_at: now })
    .eq("id", jobId)
    .lt("last_heartbeat_at", staleBefore)
    .select("id");
  if (stale.error) throw new Error(stale.error.message);
  return (stale.data?.length ?? 0) > 0;
}

/**
 * Advances a single job as far as this invocation can. Every stage persists its
 * own result, so stopping at the budget is always safe.
 */
export async function runJob(jobId: string, budgetMs = RUN_BUDGET_MS): Promise<RunResult> {
  const claimed = await claimJob(jobId);
  if (!claimed) {
    return { jobId, claimed: false, steps: 0, snapshot: null, reason: "not_claimed" };
  }

  const deadline = Date.now() + budgetMs;
  let steps = 0;
  let snapshot: JobSnapshot | null = null;

  while (steps < MAX_STEPS_PER_RUN) {
    snapshot = await advanceJob(jobId);
    steps += 1;
    if (snapshot.finished) {
      return { jobId, claimed: true, steps, snapshot, reason: "finished" };
    }
    if (Date.now() >= deadline) break;
  }

  // Budget spent but work remains: release the lease so the next sweep resumes
  // immediately instead of waiting for the lease to expire.
  await releaseLease(jobId);
  return { jobId, claimed: true, steps, snapshot, reason: "budget" };
}

/** Clears the lease so another invocation can continue the job right away. */
async function releaseLease(jobId: string): Promise<void> {
  await supabaseAdmin
    .from("processing_jobs")
    .update({ last_heartbeat_at: null })
    .eq("id", jobId)
    .in("status", ["queued", "running"]);
}

/**
 * Picks up jobs that need work: queued jobs and running jobs whose lease went
 * stale. Called by the scheduled hook, so progress does not depend on any open
 * browser tab.
 */
export async function sweepJobs(budgetMs = RUN_BUDGET_MS): Promise<RunResult[]> {
  const deadline = Date.now() + budgetMs;
  const staleBefore = new Date(Date.now() - LEASE_STALE_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, last_heartbeat_at, cancel_requested")
    .in("status", ["queued", "running"])
    .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${staleBefore}`)
    .order("queued_at", { ascending: true })
    .limit(SWEEP_BATCH);
  if (error) throw new Error(error.message);

  const results: RunResult[] = [];
  for (const job of data ?? []) {
    const remaining = deadline - Date.now();
    // Never start another job without real time left: the shared budget keeps
    // the whole sweep inside the scheduler request that is holding this
    // invocation alive.
    if (remaining < 5_000) break;
    results.push(await runJob(job.id, remaining));
  }
  return results;
}
