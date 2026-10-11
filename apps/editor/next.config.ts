import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { resolveVersion, VERSION_VAR } from "./src/observability/version.ts";

/**
 * The workspace packages ship TypeScript source, not compiled JavaScript: their `exports` point
 * at `./src/index.ts` and `tsconfig.base.json` sets `emitDeclarationOnly`, so `dist/` holds only
 * declarations. Next has to transpile them itself, and their imports carry the explicit `.ts`
 * extension that `allowImportingTsExtensions` permits.
 *
 * This is the one thing the whole application rests on, so it is proven by a build before
 * anything is built on top of it.
 */

/**
 * The short SHA of the checkout, for a build that is not on Render. `undefined` rather than a
 * throw when there is no repository — a tarball build is still a build, and `resolveVersion` says
 * «unknown» for it, which is the truthful label.
 */
function gitShortHead(): string | undefined {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
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
  /**
   * The version every error report carries (protocol Part 17), resolved once here at build time
   * and inlined into the client as a `NEXT_PUBLIC_` variable. Render sets `RENDER_GIT_COMMIT` on
   * every deploy; a local build asks `git`; neither is in the renderer, whose determinism this
   * cannot touch.
   */
  env: {
    [VERSION_VAR]: resolveVersion({
      renderCommit: process.env["RENDER_GIT_COMMIT"],
      gitShortHead: gitShortHead(),
    }),
  },
};

export default config;
