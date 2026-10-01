import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TYPE_PAIRS } from "../src/typography.ts";

/**
 * `fixtures/font-check.html` is the procedure for measuring Windows by hand (ADR 0028, option C):
 * a page opened by double-click that reports which letter the machine actually used.
 *
 * **It has to carry the stacks, and it cannot import them.** It runs from `file://` with no bundler
 * and no server, which is the whole point — a page that needed building could not be sent to somebody
 * and double-clicked. So the three stacks are written into it twice over, and this is what keeps the
 * copies honest: a fixture measuring last sprint's stacks would answer the wrong question
 * convincingly, and a hand measurement nobody can trust is worse than none.
 */

const html = readFileSync(new URL("../../../fixtures/font-check.html", import.meta.url), "utf8");

describe("fixtures/font-check.html", () => {
  it("declares exactly the stacks `TYPE_PAIRS` does, heading and body", () => {
    for (const pair of TYPE_PAIRS) {
      // Written in the fixture as a JS string with double quotes, so the inner family quotes stay
      // single — the same way they are declared in `typography.ts`.
      expect(html, `${pair.id} heading`).toContain(`"${pair.fonts["font.heading"]}"`);
      expect(html, `${pair.id} body`).toContain(`"${pair.fonts["font.body"]}"`);
    }
  });

  it("names every pair, with its id and the kind of contrast it declares", () => {
    for (const pair of TYPE_PAIRS) {
      expect(html, pair.id).toContain(`id: "${pair.id}"`);
      expect(html, `${pair.id} contrast`).toContain(`contrast: "${pair.contrast}"`);
    }
  });

  it("carries no more pairs than there are", () => {
    // A pair removed from the tokens must disappear from the fixture too, or the person running it
    // reports on something the product no longer offers.
    expect([...html.matchAll(/^\s*id: "/gm)]).toHaveLength(TYPE_PAIRS.length);
  });

  it("needs nothing but the file itself", () => {
    // No server, no bundler, no network — the same promise ADR 0001 makes of a published site, for the
    // same reason: it has to work on a machine that is not ours, by double-clicking.
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/\b(fetch|XMLHttpRequest|import\s*\()/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("measures against a control family that cannot exist", () => {
    // The measurement rests on this: an absent family is indistinguishable from a family that does not
    // exist, so the control is what tells "not installed" from "installed and in use".
    expect(html).toContain('const ABSENT = "ZZNoExisteEstaFamilia"');
  });
});
