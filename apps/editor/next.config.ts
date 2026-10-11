import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * The workspace packages ship TypeScript source, not compiled JavaScript: their `exports` point
 * at `./src/index.ts` and `tsconfig.base.json` sets `emitDeclarationOnly`, so `dist/` holds only
 * declarations. Next has to transpile them itself, and their imports carry the explicit `.ts`
 * extension that `allowImportingTsExtensions` permits.
 *
 * This is the one thing the whole application rests on, so it is proven by a build before
 * anything is built on top of it.
 *
 * **This file imports nothing from the project, and that is a rule with a production outage
 * behind it.** On 12 October 2026 it imported `./src/observability/version.ts`. `next build`
 * loaded it fine — the build's own loader resolves TypeScript imports — and `next start` did not:
 * `next start` transpiles this file alone into `next.config.compiled.js` and then `require`s its
 * relative imports as Node would, which cannot load a `.ts` file. Render ran the build, started the
 * server, failed to load the config, bound no port, and retried into the same wall. Nothing in CI
 * runs `next start`, so nothing saw it before a client could have. `test/nextConfig.test.ts` now
 * refuses a relative import here, and CI starts the built server once and asks it for `/`.
 */

/**
 * The version every error report carries (protocol Part 17), resolved once here at build time
 * and inlined into the client as a `NEXT_PUBLIC_` variable.
 *
 * The precedence is the one `src/observability/version.ts` states and tests — Render's commit
 * SHA, then a local `git` answer, then «unknown» said plainly — **copied here rather than
 * imported**, for the reason the note above gives. The two must agree, and the test that reads
 * this file checks the three branches are present by their names.
 */
function appVersion(): string {
  const render = process.env["RENDER_GIT_COMMIT"]?.trim();
  if (render) return render.slice(0, 12);
  try {
    const local = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (local) return local;
  } catch {
    // No repository under this build — a tarball, say. «unknown» is the truthful label.
  }
  return "unknown";
}

const config: NextConfig = {
  transpilePackages: [
    "@retorika/schema",
    "@retorika/renderer",
    "@retorika/catalog",
    "@retorika/copybank",
    "@retorika/generator",
    "@retorika/publisher",
    "@retorika/tokens",
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion(),
  },
};

export default config;
