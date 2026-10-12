/**
 * A probe for the editor's own window, inert unless a test switches it on.
 *
 * Sprint 18 day 5. The `e2e` suite has had an intermittent since sprint 7 that fails only inside a
 * full run, never in isolation, and only in the block that exercises the window between «the
 * preview looks ready» and «the chrome is wired» — four occurrences, three walks, and since
 * 12 October 2026 one of them on CI. Every diagnosis so far was reasoned from outside the frame
 * and two were retracted. This records what the editor itself saw, in order, with a clock.
 *
 * **Nothing unless `window.__rbProbe === true`**, which only a test sets (`context.addInitScript`).
 * The check is one property read, so the cost in production is that read and nothing else. The
 * records live on the editor's window, never in the preview's document and never in anything the
 * renderer emits — `editor-chrome-stays-home.test.ts` stays the sentinel for the published page.
 */

export interface ProbeEvent {
  /** `performance.now()` of the editor's window, so events from two documents share one clock. */
  at: number;
  kind: string;
  data: Record<string, unknown>;
}

declare global {
  interface Window {
    __rbProbe?: boolean;
    __rb?: ProbeEvent[];
  }
}

export function record(kind: string, data: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || window.__rbProbe !== true) return;
  if (!window.__rb) window.__rb = [];
  window.__rb.push({ at: Math.round(performance.now() * 10) / 10, kind, data });
}

/** The serial a wired document carries, read back from its root. `null` for one never wired. */
export function serialOf(doc: Document | null | undefined): number | null {
  const raw = doc?.documentElement?.dataset["rbSerial"];
  return raw === undefined ? null : Number(raw);
}
