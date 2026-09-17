import { defineConfig } from "vitest/config";
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
          name: "renderer",
          root: "./packages/renderer",
          // The "dom" target needs a DOM. happy-dom is lighter than jsdom,
          // which matters on a 16 GB laptop (protocol Part 18).
          environment: "happy-dom",
        },
      },
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
