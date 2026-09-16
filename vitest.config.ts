import { defineConfig } from "vitest/config";

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
  },
});
