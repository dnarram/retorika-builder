import { type ChildProcess, spawn } from "node:child_process";

/**
 * A real `apps/editor`, running, for the flows below to click through — the one thing every
 * other test in this repository avoids needing. `packages/renderer/test/browser-fixtures.ts`
 * serves rendered HTML strings through Playwright's own route interception, never a real
 * server; that works for testing what the renderer emits, but a flow test is about the
 * questionnaire's React state, click-to-edit, and the download button actually firing a
 * request, none of which exists without the app running.
 *
 * `next dev` rather than `next build && next start`: the manual browser walks that verified
 * every day of this sprint already used `next dev -p <port>`, so this is the one pattern in the
 * repository with a real precedent, and it needs no separate build step this job would
 * otherwise have to run and then throw away.
 */

const PORT = Number(process.env["RETORIKA_E2E_PORT"] ?? 4173);
export const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcess | undefined;

async function waitForReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      // Next serves a real response, even a 4xx for an unmatched route, once it is up. A
      // network failure (connection refused) is the only thing that means "not yet".
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    `apps/editor did not answer at ${BASE_URL} within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

/** Starts `next dev` on `PORT` and waits for it to answer. Idempotent within a run: a second
 * call while one is already up is a bug in the caller, not something to paper over. */
export async function startEditorServer(): Promise<string> {
  if (server) throw new Error("startEditorServer: already running");
  server = spawn(
    "pnpm",
    ["--filter", "@retorika/editor", "exec", "next", "dev", "-p", String(PORT)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      // A detached process group, so stopEditorServer can kill the whole tree: `next dev` forks
      // its own child (the actual server process), and killing only the shell pnpm started would
      // leave that child running and the port held after the suite exits.
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        /**
         * Placeholder Supabase credentials, and the shape of them is the decision.
         *
         * The right *shape*, so the client constructs and every account screen renders — the
         * sign-in form, and the «Guardar en mi cuenta» offer, which the editor only draws when an
         * account is configured. And a host that does not exist, so no sign-in can appear to
         * succeed: port 9 refuses immediately, which makes the failure path fast and real rather
         * than a timeout. **No real key goes anywhere near a test** (protocol Part 15).
         *
         * One server and not two: two `next dev` processes on this project fight over `.next`,
         * which is how this was found. So the suite runs configured, and the only thing that costs
         * is the "no account configured" message, which `test/auth.test.ts` covers directly.
         */
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key-for-tests",
      },
    },
  );
  let output = "";
  server.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  server.once("exit", (code) => {
    if (code !== null && code !== 0 && !stopping) {
      // Surfaced through the next fetch's rejection rather than thrown here: an event handler
      // throwing has nowhere useful to go, and waitForReady's retry loop is what is actually
      // waiting on this process.
      console.error(`apps/editor exited early (code ${code}):\n${output}`);
    }
  });

  try {
    await waitForReady(60_000);
  } catch (error) {
    console.error(`apps/editor output before failing to start:\n${output}`);
    throw error;
  }
  return BASE_URL;
}

let stopping = false;

/** Kills the server and its process group. Safe to call when nothing is running. */
export function stopEditorServer(): void {
  if (!server) return;
  stopping = true;
  const pid = server.pid;
  if (pid && process.platform !== "win32") {
    // Negative pid signals the whole process group to `kill(2)`, which is what reaches the
    // `next dev` child the spawned shell process forked.
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  } else {
    server.kill("SIGTERM");
  }
  server = undefined;
  stopping = false;
}
