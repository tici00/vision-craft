import { runJob } from "../src/services/processing/runner.server";
const jobId = process.argv[2]!;
const res = await runJob(jobId, Number(process.argv[3] ?? 300000));
console.log(JSON.stringify({ claimed: res.claimed, steps: res.steps, reason: res.reason, stage: res.snapshot?.stage, status: res.snapshot?.status, message: res.snapshot?.stageMessage ?? null }, null, 2));
