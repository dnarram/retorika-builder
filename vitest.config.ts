import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import thresholds from "./coverage-thresholds.json" with { type: "json" };

// Vitest 5 removed vitest.workspace.ts; projects live here instead.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "schema",
          root: "./packages/schema",
          environment: "node",
        },
      },
      {
        test: {
          name: "catalog",
          root: "./packages/catalog",
          environment: "node",
        },
      },
      {
        test: {
          name: "copybank",
          root: "./packages/copybank",
          environment: "node",
        },
      },
      {
        test: {
          name: "generator",
          root: "./packages/generator",
          environment: "node",
        },
      },
      {
        test: {
          name: "photobank",
          root: "./packages/photobank",
          environment: "node",
        },
      },
      {
        test: {
          name: "renderer",
          root: "./packages/renderer",
          // The "dom" target needs a DOM. happy-dom is lighter than jsdom,
          // which matters on a 16 GB laptop (protocol Part 18).
          environment: "happy-dom",
          // The browser suites belong to the "a11y" project below.
          exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
        },
      },
      // The accessibility harness: axe and overflow in a real Chromium. Declared only when
      // RETORIKA_A11Y=1, which `pnpm test:a11y` sets. `vitest run` executes every declared
      // project, so an unconditional one would make `pnpm test` and the coverage job need a
      // browser — or, worse, tempt someone to make these suites skip when it is missing.
      ...(process.env["RETORIKA_A11Y"] === "1"
        ? [
            {
              test: {
                name: "a11y",
                root: "./packages/renderer",
                include: ["test/**/*.browser.test.ts"],
                environment: "node",
                // A browser launch plus the matrix; page loads are slow compared to units.
                testTimeout: 60_000,
                hookTimeout: 60_000,
              },
            },
          ]
        : []),
      {
        test: {
          name: "db",
          root: "./packages/db",
          environment: "node",
          // The suites that need a real Postgres belong to the "db-pg" project below — the same
          // split the renderer makes for its browser suites, and for the same reason: the pure
          // logic here (the pooler guard, the migration listing) must be covered by a plain
          // `pnpm test`, and only the part that needs infrastructure should be gated.
          exclude: [...configDefaults.exclude, "**/*.pg.test.ts"],
        },
      },
      // The policy suite: a real Postgres, running the row-level security policies that ship.
      // Declared only when RETORIKA_DB=1, which `pnpm test:db` sets — the same reason the "a11y"
      // and "e2e" projects are conditional: a plain `pnpm test` must not need infrastructure it
      // cannot start, and the alternative is a suite that skips when the database is missing,
      // which is a suite that passes while verifying nothing.
      ...(process.env["RETORIKA_DB"] === "1"
        ? [
            {
              test: {
                name: "db-pg",
                root: "./packages/db",
                include: ["test/**/*.pg.test.ts"],
                environment: "node",
                // Dropping and recreating a database, then running every migration.
                testTimeout: 60_000,
                hookTimeout: 90_000,
              },
            },
          ]
        : []),
      {
        test: {
          name: "publisher",
          root: "./packages/publisher",
          environment: "node",
        },
      },
      {
        test: {
          name: "tokens",
          root: "./packages/tokens",
          environment: "node",
        },
      },
      {
        test: {
          name: "serve",
          root: "./apps/serve",
          // The Worker's globals (Request, Response, ReadableStream) are also Node's.
          environment: "node",
        },
      },
      {
        // `@/…` is how everything under apps/editor/src/app imports, because that is what Next
        // resolves from the app's tsconfig paths. Vitest does not read those, so a route handler
        // was untestable until this alias existed — which is how it was found.
        resolve: {
          alias: { "@": fileURLToPath(new URL("./apps/editor/src", import.meta.url)) },
        },
        test: {
          name: "editor",
          root: "./apps/editor",
          // Route handlers only: Request, Response, Blob are Node's, no DOM needed.
          environment: "node",
          // The critical flows belong to the "e2e" project below — same reason the renderer
          // project excludes its own browser suites: the default include glob for "*.test.ts"
          // would otherwise also pick up "*.e2e.test.ts" and try to launch a browser and a real
          // `next dev` server on every plain `pnpm test`.
          exclude: [...configDefaults.exclude, "e2e/**/*.e2e.test.ts"],
        },
      },
      // The critical flows against a real, running app (docs/protocolo.md Part 9.2). Declared
      // only when RETORIKA_E2E=1, which `pnpm e2e` sets — the same reason the "a11y" project
      // above is conditional: an unconditional one would make every plain `pnpm test` spawn a
      // Next server and a Chromium instance.
      ...(process.env["RETORIKA_E2E"] === "1"
        ? [
            {
              test: {
                name: "e2e",
                root: "./apps/editor",
                include: ["e2e/**/*.e2e.test.ts"],
                environment: "node",
                // A real next dev boot plus five questionnaire screens plus a download; slow
                // compared to a unit, and the whole file shares one beforeAll/afterAll.
                testTimeout: 60_000,
                hookTimeout: 90_000,
              },
            },
          ]
        : []),
    ],
    // Protocol Part 18: one thread per core chokes this machine.
    maxWorkers: 4,

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],

      // The three core packages only. scripts/ and the fixtures would distort the
      // number in both directions, and the floor is meant to measure the code that
      // ships, not the code that measures it.
      include: ["packages/schema/src/**", "packages/catalog/src/**", "packages/renderer/src/**"],
      exclude: [
        // Test scaffolding. Counting it would have the tests testing themselves.
        "packages/schema/src/testing.ts",
        // Locale files are data, not code; they were landing in the report with zero
        // lines and adding noise to a number that is supposed to mean something.
        "**/*.json",
      ],

      // A floor against regressions, never a target: this project's quality guarantee
      // is the invariants, and full coverage with a broken invariant would be worth
      // nothing. The numbers live in coverage-thresholds.json so that
      // scripts/coverage-ratchet.ts can read them out of git without executing this
      // file, and so that a drop is a visible one-line diff.
      //
      // THE FLOOR ONLY GOES UP. Lowering a number here requires an ADR — see
      // docs/decisions/0006-coverage-is-a-ratcheted-floor.md — and pnpm coverage:ratchet
      // fails the commit and the build if one goes down.
      thresholds,
    },
  },
});
