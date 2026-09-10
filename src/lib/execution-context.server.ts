/**
 * Access to the platform execution context (`ctx.waitUntil`) from inside route
 * handlers and server functions.
 *
 * Why this exists: the backend runs on an edge Worker runtime where an
 * invocation is torn down as soon as its client disconnects. The processing
 * pipeline makes long outbound calls to the media service (streaming a whole
 * recording, then waiting for ffmpeg). When the caller of our own endpoint gives
 * up first — pg_net's 55s statement timeout, or a browser tab navigating away —
 * the invocation is cancelled and the in-flight upload to the media service dies
 * with "Network connection lost", even though nothing was actually wrong with
 * the transfer.
 *
 * `waitUntil` keeps the invocation alive independently of its client, so the
 * pipeline stage finishes instead of being killed mid-transfer.
 */

interface ExecutionContextLike {
  waitUntil?: (promise: Promise<unknown>) => void;
}

const perRequest = new WeakMap<Request, ExecutionContextLike>();
let latest: ExecutionContextLike | null = null;

function asContext(value: unknown): ExecutionContextLike | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as ExecutionContextLike;
  return typeof candidate.waitUntil === "function" ? candidate : null;
}

/** Called by the server entry for every incoming request. */
export function rememberExecutionContext(request: Request, ctx: unknown): void {
  const context = asContext(ctx);
  if (!context) return;
  perRequest.set(request, context);
  latest = context;
}

/** Keeps a floating promise referenced so it is not garbage collected. */
const pending = new Set<Promise<unknown>>();

/**
 * Runs `task` without holding the HTTP response open, and — when the runtime
 * exposes it — registers the work with `waitUntil` so client disconnection does
 * not cancel it. Returns whether the work was detached from the request.
 */
export function runDetached(
  request: Request | null,
  task: () => Promise<unknown>,
): boolean {
  const context = (request ? perRequest.get(request) : null) ?? latest;
  const promise = task().catch((error: unknown) => {
    console.error("[detached-task]", error instanceof Error ? error.message : String(error));
  });
  pending.add(promise);
  void promise.finally(() => pending.delete(promise));

  if (context?.waitUntil) {
    context.waitUntil(promise);
    return true;
  }
  return false;
}

export function hasExecutionContext(request: Request | null): boolean {
  return Boolean((request ? perRequest.get(request) : null) ?? latest);
}
