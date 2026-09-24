import type { NextConfig } from "next";

/**
 * The workspace packages ship TypeScript source, not compiled JavaScript: their `exports` point
 * at `./src/index.ts` and `tsconfig.base.json` sets `emitDeclarationOnly`, so `dist/` holds only
 * declarations. Next has to transpile them itself, and their imports carry the explicit `.ts`
 * extension that `allowImportingTsExtensions` permits.
 *
 * This is the one thing the whole application rests on, so it is proven by a build before
 * anything is built on top of it.
 */
const config: NextConfig = {
  transpilePackages: [
    "@retorika/schema",
    "@retorika/renderer",
    "@retorika/catalog",
    "@retorika/publisher",
    "@retorika/tokens",
  ],
};

export default config;
