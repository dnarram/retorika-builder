import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Every dialog that claims to be modal actually traps the keyboard — checked at the source.**
 *
 * `aria-modal="true"` is a promise to a screen reader that the rest of the page is unavailable. A
 * dialog that makes that claim and then lets Tab walk out into a page the reader has been told to
 * ignore is worse than one that never claimed it: the reader is now somewhere it was told does not
 * exist, with no way back that it knows about.
 *
 * Sprint 14 built `useFocusTrap` for the account screens and left the dialogs that already existed
 * owed it, as a backlog row. **The row then went stale in the direction that matters:** it said
 * five, and the sixth — `PhotosFailedDialog` — was committed on 4 October 2026, the same day as the
 * hook itself, in a different commit. Nobody was wrong at the time; the number simply described a
 * count taken before the last dialog existed.
 *
 * So this file exists to make the claim self-maintaining, and it checks two different things:
 *
 * 1. **Every `aria-modal` element carries the trap's own ref.** This is the guarantee, and it needs
 *    no number: a ninth dialog that forgets the trap fails here on the day it is written.
 * 2. **The total is what the records say it is.** This is the anti-drift half. A new dialog makes
 *    this fail with the list of files whose prose names the count, which is the mechanism the
 *    backlog row did not have.
 *
 * Why at the source rather than in a browser: `TooManyPhotosDialog` needs a document with more
 * photographs than the download ceiling allows to be reachable at all, and three of the others need
 * a failure from a server. Source is the only place where *all* of them can be checked in one pass,
 * and the behaviour the trap produces is covered by the `e2e` walks on the five a click can reach.
 *
 * **It reads lines rather than parsing, and the road to that is worth recording.** A sweep over the
 * whole text found nine dialogs where there are eight, twice over: once on the sentence in
 * `useFocusTrap.ts` that explains what `aria-modal` promises, and once on `Editor.tsx`'s own
 * `document.querySelector('[aria-modal="true"]')` — a selector that asks about dialogs is not an
 * element carrying the attribute. Blanking comments and quoted strings by hand fixed both and
 * introduced a worse problem: a tokenizer that must understand JSX, template literals and regex
 * literals to stay in step, and which was measured eight thousand characters out of step inside
 * `Editor.tsx` alone. The obvious answer was to let TypeScript do the reading — and `typescript`
 * 7.0.2 is the native port, whose npm package no longer ships the compiler API at all: `ts.version`
 * is there and `ts.createSourceFile` is not.
 *
 * So the unit of reading is **one line**, which cannot drift out of step with anything. A dialog is
 * a line whose whole content is the attribute, which is how all eight are written and how the
 * formatter keeps them. The two false positives are excluded by the same rule for free, and the
 * shape that rule would miss — the attribute inline among others — is caught by the third test
 * below rather than left as a hole.
 */

const SRC = fileURLToPath(new URL("../src", import.meta.url));

/** How many `aria-modal` dialogs the application has. */
const MODAL_COUNT = 8;

/**
 * The prose that names the count, so a failure says where to go. Listed rather than asserted on:
 * these are comments and notes, and a test that parsed them would be guessing at grammar.
 */
const RECORDS_THAT_NAME_THE_COUNT = [
  "docs/tasks/backlog.md",
  "docs/tasks/el-recorrido-de-la-cuenta.md",
  "apps/editor/src/auth/forms.tsx",
  "apps/editor/src/editor/useFocusTrap.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

/**
 * Whether a line is prose about dialogs rather than a dialog: a block-comment continuation, a line
 * comment, or the start of either.
 */
function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
}

/** Whether a line holds the attribute inside a CSS selector — `'[aria-modal="true"]'`. */
function isSelector(line: string): boolean {
  return line.includes("'[aria-modal") || line.includes('"[aria-modal');
}

/** A line whose entire content is the attribute, which is how every dialog in this repository
 * declares it and how the formatter keeps it. */
const ATTRIBUTE_LINE = 'aria-modal="true"';

type Modal = { file: string; line: number; tag: string; trapVariables: string[] };

const unexplained: string[] = [];

const modals: Modal[] = sourceFiles(SRC).flatMap((file) => {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const shortName = file.slice(SRC.length + 1);

  // The variables this file gets from the hook, so the ref can be checked by name rather than by
  // the mere presence of some ref.
  const trapVariables = [...text.matchAll(/const\s+(\w+)\s*=\s*useFocusTrap\(/g)].map(
    (match) => match[1] as string,
  );

  const found: Modal[] = [];
  lines.forEach((line, index) => {
    if (!line.includes("aria-modal")) return;
    if (line.trim() === ATTRIBUTE_LINE) {
      /*
       * The opening tag this attribute belongs to: upwards to the line that opens it, downwards to
       * the line that closes it. Line-wise, so nothing here depends on counting brackets across a
       * whole file.
       */
      let first = index;
      while (first > 0 && !/^\s*<[A-Za-z]/.test(lines[first] as string)) first -= 1;
      let last = index;
      while (last < lines.length - 1 && !/^\s*\/?>/.test(lines[last] as string)) last += 1;
      found.push({
        file: shortName,
        line: index + 1,
        tag: lines.slice(first, last + 1).join("\n"),
        trapVariables,
      });
      return;
    }
    if (isComment(line) || isSelector(line)) return;
    // Neither a dialog this test can read, nor prose, nor a selector. Reported rather than ignored:
    // a guard whose unknown shapes pass silently is how the backlog row went stale in the first
    // place.
    unexplained.push(`${shortName}:${index + 1}  ${line.trim()}`);
  });
  return found;
});

describe("every modal dialog traps the keyboard", () => {
  it("finds the dialogs at all, so an empty sweep cannot pass", () => {
    // The failure this guards against is the one that makes every other assertion here vacuous: a
    // renamed attribute, a moved folder, or a `src` that stopped being where this file looks.
    expect(modals.length).toBeGreaterThan(0);
  });

  it.each(modals)("$file:$line carries the focus trap's ref", (modal) => {
    expect(
      modal.trapVariables.length,
      `${modal.file} has an aria-modal dialog and never calls useFocusTrap. ` +
        "A dialog that claims to be modal and lets Tab out of it is worse than one that does not " +
        "claim it: see apps/editor/src/editor/useFocusTrap.ts.",
    ).toBeGreaterThan(0);
    const wired = modal.trapVariables.some((name) => modal.tag.includes(`ref={${name}}`));
    expect(
      wired,
      `${modal.file}:${modal.line} has aria-modal="true" but its opening tag carries no ` +
        `ref={${modal.trapVariables.join(" | ")}}. The trap searches inside whatever element it ` +
        "is given, so the ref belongs on the element that claims to be modal and on no other.",
    ).toBe(true);
  });

  it("meets no mention of the attribute it cannot account for", () => {
    /*
     * The hole in a line-based rule, closed loudly. Every line naming `aria-modal` is either the
     * attribute on its own line, prose, or a selector; anything else — the attribute written inline
     * among other attributes, most likely — is a dialog this test would otherwise have skipped in
     * silence.
     */
    expect(
      unexplained,
      "these lines name aria-modal in a shape this test cannot read. If one of them is a dialog, " +
        "put the attribute on its own line so the check above sees it; if it is something else, " +
        "teach isComment/isSelector about it.",
    ).toEqual([]);
  });

  it("has as many dialogs as the records say", () => {
    expect(
      modals.length,
      `The application has ${modals.length} aria-modal dialogs and this test expected ` +
        `${MODAL_COUNT}. If a dialog was added or removed, update MODAL_COUNT and the prose in ` +
        `${RECORDS_THAT_NAME_THE_COUNT.join(", ")}. This assertion exists because the backlog ` +
        "said five for five days after the sixth was written.",
    ).toBe(MODAL_COUNT);
  });
});
