/**
 * Which build an error came from, resolved once at build time.
 *
 * Protocol Part 17: «Sentry en el editor y en la API, **con el número de versión en cada
 * error**.» Without it two reports from two deploys are indistinguishable, and the first question
 * about any error — «is this still happening?» — has no answer.
 *
 * The order is the decision:
 *
 * 1. `RENDER_GIT_COMMIT`, which Render sets on every service and deploy — read from its own
 *    documentation on 12 October 2026, «The commit SHA for a service or deploy» — so a production
 *    error names the exact commit with no step anybody can forget.
 * 2. A short SHA the caller read from `git`, for a local build: `next.config.ts` runs
 *    `git rev-parse --short HEAD`. Passed in rather than run here, so this stays a pure function
 *    the `editor` test project can cover without a repository.
 *
 * **`next.config.ts` carries a copy of this precedence rather than importing this function**, and
 * that is not laziness: `next start` requires the compiled config with plain Node, which cannot
 * load a `.ts` import, and on 12 October 2026 the import that was here took production down
 * while every gate stayed green. `test/nextConfig.test.ts` refuses a relative import in the
 * config and checks the three branches are still named there. This file stays the specification
 * and the thing the tests exercise.
 * 3. `"unknown"`, said plainly. A version that is not known is still a fact worth attaching, and
 *    an exception at build time over a label would be the wrong trade.
 *
 * **Never in `packages/renderer`.** The renderer is deterministic — no clock, no randomness — and a
 * commit SHA is neither, but it is still an input that varies between builds. It lives in the
 * editor's own configuration and reaches the page only as an error's tag.
 */

export const VERSION_VAR = "NEXT_PUBLIC_APP_VERSION";

export function resolveVersion(input: {
  readonly renderCommit?: string | undefined;
  readonly gitShortHead?: string | undefined;
}): string {
  const render = input.renderCommit?.trim();
  if (render) return render.slice(0, 12);
  const local = input.gitShortHead?.trim();
  if (local) return local;
  return "unknown";
}
