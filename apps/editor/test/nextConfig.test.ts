import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **`next.config.ts` may not import from the project, and CI could not have told you why.**
 *
 * `next build` loads the config through its own loader, which resolves TypeScript imports.
 * `next start` does something else: it transpiles the config file alone into
 * `next.config.compiled.js` and then `require`s whatever that file imports, as plain Node — and
 * plain Node cannot load `./src/observability/version.ts`. On 12 October 2026 that was the
 * difference between a green build and a server that bound no port on Render, retrying into the
 * same error until somebody read the log.
 *
 * Every gate ran `next build`; none ran `next start`. This test is the cheap half of the answer
 * and runs in seconds; the CI job that starts the built server once is the other half.
 */

const CONFIG = fileURLToPath(new URL("../next.config.ts", import.meta.url));
const source = readFileSync(CONFIG, "utf8");

describe("next.config.ts can be loaded by next start", () => {
  it("imports nothing by a relative path", () => {
    const relative = [...source.matchAll(/from\s+["'](\.\.?\/[^"']*)["']/g)].map((m) => m[1]);
    expect(
      relative,
      `next.config.ts imports ${relative.join(", ")}. \`next start\` requires the compiled config ` +
        "with plain Node, which cannot load a project .ts file: the server then fails to start and " +
        "binds no port. Inline what the config needs, or read it from the environment.",
    ).toEqual([]);
  });

  it("imports nothing from a workspace package either", () => {
    // The same failure by another road: `@retorika/*` resolves to TypeScript source.
    expect(source).not.toMatch(/from\s+["']@retorika\//);
  });

  it("still sets the version every error report carries, with its three branches", () => {
    // The precedence `src/observability/version.ts` specifies, copied rather than imported for the
    // reason above. If one of these names disappears, the copy has drifted from the spec.
    expect(source).toContain("NEXT_PUBLIC_APP_VERSION");
    expect(source).toContain("RENDER_GIT_COMMIT");
    expect(source).toContain("git rev-parse --short HEAD");
    expect(source).toContain('"unknown"');
  });
});
