/**
 * Minimal deterministic tests for the backend job runner: lease claiming
 * (no concurrent execution of the same job) and stopping on terminal state.
 * Run with: bun test src/services/processing/runner.test.ts
 */

import { describe, expect, mock, test } from "bun:test";

interface FakeJob {
  id: string;
  status: string;
  last_heartbeat_at: string | null;
  cancel_requested?: boolean;
}

function makeSupabase(job: FakeJob) {
  // Minimal chainable stub covering only the calls the runner makes.
  const builder = (table: string) => {
    const state: { op: "select" | "update"; patch?: Record<string, unknown>; conds: string[] } = {
      op: "select",
      conds: [],
    };
    let matches = true;
    const api: Record<string, unknown> = {};
    const chain = () => api;
    Object.assign(api, {
      select: () => chain(),
      update: (patch: Record<string, unknown>) => {
        state.op = "update";
        state.patch = patch;
        return chain();
      },
      eq: () => chain(),
      in: () => chain(),
      or: () => chain(),
      lt: (_col: string, value: string) => {
        matches = job.last_heartbeat_at != null && job.last_heartbeat_at < value;
        return chain();
      },
      is: (_col: string, value: null) => {
        matches = value === null && job.last_heartbeat_at === null;
        return chain();
      },
      order: () => chain(),
      limit: () => chain(),
      maybeSingle: async () => ({ data: job, error: null }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        if (state.op === "update" && matches) Object.assign(job, state.patch);
        return Promise.resolve({ data: matches ? [{ id: job.id }] : [], error: null }).then(resolve);
      },
    });
    void table;
    return api;
  };
  return { from: (table: string) => builder(table) };
}

async function loadRunner(job: FakeJob, advance: () => Promise<unknown>) {
  await mock.module("@/integrations/supabase/client.server", () => ({
    supabaseAdmin: makeSupabase(job),
  }));
  await mock.module("@/services/processing/pipeline.server", () => ({
    advanceJob: advance,
  }));
  return import("./runner.server");
}

describe("runJob", () => {
  test("claims a job with no lease and advances until it finishes", async () => {
    const job: FakeJob = { id: "job-1", status: "queued", last_heartbeat_at: null };
    let calls = 0;
    const { runJob } = await loadRunner(job, async () => {
      calls += 1;
      return {
        jobId: job.id,
        projectId: "p",
        status: calls >= 3 ? "completed" : "running",
        stage: "transcribing",
        progress: 30,
        currentStep: null,
        stageMessage: null,
        errorMessage: null,
        finished: calls >= 3,
      };
    });

    const result = await runJob("job-1");
    expect(result.claimed).toBe(true);
    expect(result.reason).toBe("finished");
    expect(calls).toBe(3);
  });

  test("does not run a job whose lease is still fresh (no concurrency)", async () => {
    const job: FakeJob = {
      id: "job-2",
      status: "running",
      last_heartbeat_at: new Date().toISOString(),
    };
    let calls = 0;
    const { runJob } = await loadRunner(job, async () => {
      calls += 1;
      return null;
    });

    const result = await runJob("job-2");
    expect(result.claimed).toBe(false);
    expect(result.reason).toBe("not_claimed");
    expect(calls).toBe(0);
  });

  test("ignores jobs in a terminal state", async () => {
    const job: FakeJob = { id: "job-3", status: "completed", last_heartbeat_at: null };
    let calls = 0;
    const { runJob } = await loadRunner(job, async () => {
      calls += 1;
      return null;
    });

    const result = await runJob("job-3");
    expect(result.claimed).toBe(false);
    expect(calls).toBe(0);
  });
});
