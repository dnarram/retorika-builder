import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Every node the editor draws into the page is born through `chrome()`** (ADR 0051 §2, rule 1).
 *
 * The patch keys on `data-rb-chrome`: a chrome node without it is, to the walk, a renderer node
 * the fresh tree does not have — and morphdom would match it against an unkeyed renderer sibling
 * of the same tag and morph it into one. That is a defect no test of the patch itself can see,
 * because the patch would be doing exactly what it was told. So the source is held to the helper,
 * the way `secrets:scope` holds the client bundle to the service key's absence.
 *
 * `document.createElement` — the editor's **own** document, where the hidden file input and the
 * announce region live — is not the page and is allowed.
 */
const EDITOR = fileURLToPath(new URL("../src/questionnaire/Editor.tsx", import.meta.url));

describe("the chrome is made one way", () => {
  it("creates no element in the frame's document except through chrome()", () => {
    const source = readFileSync(EDITOR, "utf8");
    const bare = source.match(/\b(iframeDoc|ownerDocument|doc)\.createElement\(/g) ?? [];
    expect(
      bare,
      "a node made for the page without `chrome()` is invisible to nothing: the patch will match it against the renderer's",
    ).toEqual([]);
    // And the helper is actually used, so an empty match above is not an empty file.
    expect((source.match(/\bchrome\(/g) ?? []).length).toBeGreaterThan(40);
  });
});
