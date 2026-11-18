import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * **Every sentence of the interface has a reader, or is named here as one that does not** (sprint
 * 39 día 1, ADR 0078).
 *
 * The day the menu's switch left «Páginas» and «Campos», fifteen keys lost their last reader —
 * «quedan {n} secciones», «lo has decidido tú», «En el menú» — and nothing in the repository would
 * have said so: a key nobody reads is a sentence nobody can see go stale. This holds the file to its
 * readers, the way `helpLine.test.ts` holds the instruction keys to the help line.
 *
 * **What it found from before, it lists and does not clean** (David's adjustment 1 approving sprint
 * 39: «el día 1 es solo el interruptor»). `KNOWN_ORPHANS` is a closed list with its count; the backlog
 * carries it by name. The list may shrink; it may not grow.
 *
 * A key counts as read when its whole name is written in `src/`; when a template literal in `src/`
 * writes a prefix of it before `${` — `` es[`editor.menuPanel.logoSize.${size}`] `` reads every
 * `editor.menuPanel.logoSize.*`; or when a quoted string in `src/` is a dot-bounded ancestor of it —
 * `"editor.download.lowContrast"` held in a variable and read as `` `${prefix}.title` ``, the download
 * review's shape. Comments are not strings, so a comment naming a family of keys does not count as
 * reading it.
 */

const SRC = join(import.meta.dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const SOURCE = sourceFiles(SRC)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

/** The literal prefixes templates read keys by: everything up to the `${`. */
const TEMPLATE_PREFIXES = [...SOURCE.matchAll(/`([A-Za-z0-9_.-]+)\$\{/g)].map(
  (match) => match[1] as string,
);

/** Every quoted string that could be an ancestor of a key: `"a.b.c"` reads `a.b.c.*`. */
const QUOTED = new Set(
  [...SOURCE.matchAll(/"([a-zA-Z]+(?:\.[A-Za-z0-9_-]+)+)"/g)].map((match) => match[1] as string),
);

function isRead(key: string): boolean {
  if (QUOTED.has(key)) return true;
  if (TEMPLATE_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
  // A dot-bounded ancestor, held in a variable and completed by a template.
  for (let at = key.lastIndexOf("."); at > 0; at = key.lastIndexOf(".", at - 1)) {
    if (QUOTED.has(key.slice(0, at))) return true;
  }
  return false;
}

/**
 * Read by nobody on 18 November 2026, the day this guard was written, and left as they were (the
 * sign-in form validates with the browser's own messages since sprint 15, and the new-password
 * screen never drew its «no session» sentence). Each is a decision for a day of its own — a
 * sentence kept for a screen that may come back, or one that can go — and the backlog names them.
 * Three on the day it was written.
 */
const KNOWN_ORPHANS: readonly string[] = [
  "auth.newPassword.noSession",
  "auth.error.emailRequired",
  "auth.error.passwordRequired",
];

describe("every key of es.json has a reader in src/, or is a known orphan", () => {
  const keys = Object.keys(es);

  it("finds the readers it counts on", () => {
    // A guard on the scan: if the prefix regex stopped matching, every templated key would read as
    // an orphan at once.
    expect(TEMPLATE_PREFIXES).toContain("editor.menuPanel.logoSize.");
    expect(isRead("editor.menuPanel.logoSize.lg")).toBe(true);
    expect(isRead("editor.style.title")).toBe(true);
  });

  it("lists every orphan by name, and the list does not grow", () => {
    const orphans = keys.filter((key) => !isRead(key));
    const unlisted = orphans.filter((key) => !KNOWN_ORPHANS.includes(key));
    expect(
      unlisted,
      "a key nobody reads is a sentence nobody can see go stale: give it a reader or remove it",
    ).toEqual([]);
  });

  it("names no orphan that has since found a reader, or gone", () => {
    for (const key of KNOWN_ORPHANS) {
      expect(keys, `${key} is no longer in es.json`).toContain(key);
      expect(isRead(key), `${key} is read now: take it off the list`).toBe(false);
    }
  });

  it("keeps none of the switch's own sentences, which left with it (ADR 0078)", () => {
    for (const gone of [
      "editor.menu.toggle",
      "editor.menu.pageToggle",
      "editor.menu.sectionsLeft",
      "editor.menu.pagesLeft",
      "editor.menu.notYet",
      "editor.menu.yours",
      "editor.menu.gone",
      "editor.menu.off",
      "editor.menu.emptyAlways",
    ]) {
      expect(keys, gone).not.toContain(gone);
    }
    for (const line of ["editor.menu.line.in", "editor.menu.line.out", "editor.menu.as"]) {
      expect(isRead(line), line).toBe(true);
    }
  });
});
