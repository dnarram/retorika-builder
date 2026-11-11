import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MS,
  boundBadge,
  boundSentence,
  chosenHint,
  HELP_AT_REST,
  type HelpLineState,
  helpLineFor,
  keysFor,
  liveSays,
  noticeText,
  quietSays,
} from "../src/editor/helpLine.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * The help line (ADR 0071): one row, two voices, a closed priority. What is here is the decision
 * table — which text wins, and which child says it — and the guard that no instruction is read
 * anywhere else, so that nothing can be drawn over the page again by accident. What a browser
 * alone can show (that the row is 32 px, outside the card, and never intersects it) is in the walks.
 */

function at(patch: Partial<HelpLineState>): HelpLineState {
  return { ...HELP_AT_REST, ...patch };
}

const NOTICE = { sectionName: "Opiniones", brokenAnchors: 0, persistent: false };

describe("the quiet child, which goes with the focus", () => {
  it("at rest says the idle hint, and nothing in the live child", () => {
    const says = helpLineFor(HELP_AT_REST, 0);
    expect(says.quiet).toEqual({ child: "quiet", text: es["editor.editHint"], tone: "info" });
    expect(says.live.text).toBe("");
  });

  it("says the keys of the place the keyboard is in, by platform", () => {
    expect(quietSays(at({ keyboard: "section" })).text).toContain("cambiar de sección");
    expect(quietSays(at({ keyboard: "bar" })).text).toContain("recorrerla");
    expect(quietSays(at({ keyboard: "grip" })).text).toContain("asa");
    expect(quietSays(at({ keyboard: "writing", platform: "mac" })).text).toContain("Fn+⌥+F10");
    expect(quietSays(at({ keyboard: "writing", platform: "other" })).text).toContain("Alt+F10");
    expect(keysFor("writing", "other")).not.toContain("{toBar}");
  });

  it("says no keys on a touched screen, where there are none", () => {
    const says = quietSays(
      at({ keyboard: "section", touch: true, chosen: { text: true, movable: false } }),
    );
    expect(says.text).toBe(es["editor.canvas.chosenHint"]);
  });

  it("says the chosen element's hint only for what it can do, both halves when both are true", () => {
    expect(chosenHint({ text: true, movable: false })).toBe(es["editor.canvas.chosenHint"]);
    expect(chosenHint({ text: false, movable: true })).toBe(es["editor.canvas.moveHint"]);
    expect(chosenHint({ text: true, movable: true })).toBe(
      `${es["editor.canvas.chosenHint"]} · ${es["editor.canvas.moveHint"]}`,
    );
    // A photograph the tools cannot move: nothing to say, so the idle hint stays.
    expect(quietSays(at({ chosen: { text: false, movable: false } })).text).toBe(
      es["editor.editHint"],
    );
  });

  it("ranks the refused drag over the keys, the keys over a menu's note, the note over the chosen hint", () => {
    const everything = at({
      dragRefused: true,
      keyboard: "section",
      menuNote: "composition",
      bound: { places: 3, list: "Platos" },
      chosen: { text: true, movable: true },
      placeholders: 2,
    });
    expect(quietSays(everything).text).toBe(es["editor.drag.order"]);
    expect(quietSays({ ...everything, dragRefused: false }).text).toBe(keysFor("section", "other"));
    expect(quietSays({ ...everything, dragRefused: false, keyboard: null }).text).toBe(
      es["editor.composition.note"],
    );
    expect(
      quietSays({ ...everything, dragRefused: false, keyboard: null, menuNote: "escalate" }).text,
    ).toBe(es["editor.section.escalate.body"]);
    expect(
      quietSays({ ...everything, dragRefused: false, keyboard: null, menuNote: null }).text,
    ).toBe(boundSentence(3, "Platos"));
    expect(
      quietSays({ ...everything, dragRefused: false, keyboard: null, menuNote: null, bound: null })
        .text,
    ).toBe(chosenHint({ text: true, movable: true }));
    // A text being written: its keys yield to the bound sentence, which is what has to be read
    // before the first keystroke; the bar's and the grip's keys do not yield to it.
    const bound = { places: 3, list: "Platos" };
    expect(quietSays(at({ keyboard: "writing", bound })).text).toBe(boundSentence(3, "Platos"));
    expect(quietSays(at({ keyboard: "writing" })).text).toBe(keysFor("writing", "other"));
    expect(quietSays(at({ keyboard: "bar", bound })).text).toBe(keysFor("bar", "other"));
    const placeholdersOnly = quietSays(at({ placeholders: 2 }));
    expect(placeholdersOnly.text).toBe(es["editor.placeholder.many"].replace("{count}", "2"));
    expect(placeholdersOnly.tone).toBe("warn");
    expect(quietSays(at({ placeholders: 1 })).text).toBe(es["editor.placeholder.one"]);
  });

  it("never sends a focus-driven text through the live child", () => {
    for (const patch of [
      { keyboard: "section" as const },
      { chosen: { text: true, movable: false } },
      { menuNote: "escalate" as const },
      { bound: { places: 2, list: "" } },
      { dragRefused: true },
      { placeholders: 4 },
    ]) {
      const says = helpLineFor(at(patch), 0);
      expect(says.quiet.child).toBe("quiet");
      expect(says.live.text, JSON.stringify(patch)).toBe("");
    }
  });
});

describe("the live child, which says what nobody saw coming", () => {
  it("says the delete notice with its undo, and the cross only when it stays", () => {
    const goes = liveSays(at({ notice: NOTICE }), 0);
    expect(goes.text).toBe("Has borrado la sección «Opiniones»");
    expect(goes.notice).toEqual({ dismiss: false });
    const stays = liveSays(at({ notice: { ...NOTICE, persistent: true } }), 0);
    expect(stays.notice).toEqual({ dismiss: true });
  });

  it("adds the broken buttons to the notice, one or many", () => {
    expect(noticeText({ ...NOTICE, brokenAnchors: 1 })).toContain(
      "Un botón de tu web llevaba aquí",
    );
    expect(noticeText({ ...NOTICE, brokenAnchors: 3 })).toContain("3 botones de tu web");
  });

  it("lets a fresh announcement speak over the notice, and gives the notice back after its time", () => {
    const state = at({
      notice: NOTICE,
      announcement: { text: "Menú de páginas: Columna izquierda", at: 1000 },
    });
    expect(liveSays(state, 1000 + ANNOUNCEMENT_MS - 1).text).toBe(
      "Menú de páginas: Columna izquierda",
    );
    expect(liveSays(state, 1000 + ANNOUNCEMENT_MS).text).toBe("Has borrado la sección «Opiniones»");
  });

  it("says a download refusal as an error, under the notice — the dialog is what blocks", () => {
    expect(liveSays(at({ download: "error" }), 0)).toMatchObject({
      tone: "error",
      text: es["editor.downloadError"],
    });
    expect(liveSays(at({ download: "busy" }), 0).text).toBe(es["editor.downloadBusy"]);
    expect(liveSays(at({ photoError: "La foto pesa demasiado." }), 0).text).toBe(
      "La foto pesa demasiado.",
    );
    expect(liveSays(at({ download: "error", notice: NOTICE }), 0).text).toContain("Has borrado");
    // Preparing is the button's own word; the line has nothing to add.
    expect(liveSays(at({ download: "preparing" }), 0).text).toBe("");
  });

  it("is the only child that ever carries the notice, the announcement or an error", () => {
    for (const patch of [
      { notice: NOTICE },
      { announcement: { text: "x", at: 0 } },
      { download: "error" as const },
    ]) {
      const says = helpLineFor(at(patch), 0);
      expect(says.live.child).toBe("live");
      expect(says.live.text).not.toBe("");
      // The quiet child keeps its own text underneath, ready for when the live one falls silent.
      expect(says.quiet.text).toBe(es["editor.editHint"]);
    }
  });
});

describe("the text bar's badge", () => {
  it("is two characters, and its sentence is the line's", () => {
    expect(boundBadge(3)).toBe("×3");
    expect(boundBadge(1)).toBe("≡");
    expect(boundSentence(3, "")).toBe(
      "Este texto aparece en 3 sitios: si lo cambias, cambia en todos.",
    );
    expect(boundSentence(1, "Platos")).toBe("Este texto viene de la lista «Platos».");
  });
});

/**
 * **No instruction is read anywhere but here.** The keys below used to be drawn inside the frame,
 * over the page; the one way they can come back is a component reading them again. The editor and
 * the shell are held to never touching them — the line's own module and component are the only
 * readers — the way `chromeGuard.test.ts` holds the editor to `chrome()`.
 */
describe("no instruction text is read outside the help line", () => {
  const INSTRUCTION_KEYS = [
    "editor.help.keys.",
    "editor.canvasKeys.toBar",
    "editor.canvas.chosenHint",
    "editor.canvas.moveHint",
    "editor.drag.order",
    "editor.composition.note",
    "editor.section.escalate.body",
    "editor.toolbar.boundMany",
    "editor.toolbar.boundOne",
    "editor.toast.deleted",
    "editor.toast.deletedAnchors",
    "editor.editHint",
    "editor.placeholder.",
    "editor.downloadError",
    "editor.downloadBusy",
  ];
  const read = (file: string) =>
    readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");

  it.each(["questionnaire/Editor.tsx", "editor/EditorShell.tsx"])(
    "%s reads none of them",
    (file) => {
      const source = read(file);
      const found = INSTRUCTION_KEYS.filter((key) => source.includes(`"${key}`));
      expect(
        found,
        `an instruction read outside the help line is one that can be drawn over the page again`,
      ).toEqual([]);
    },
  );

  it("and the editor draws neither the legend nor the hint in the frame any more", () => {
    const source = read("questionnaire/Editor.tsx");
    for (const gone of ['"rb-keys"', '"rb-hint"', "rb-keys-place", '"rb-toolbar-notice"']) {
      expect(source.includes(gone), `${gone} is drawn in the frame again`).toBe(false);
    }
  });

  it("while the help line reads every key it owns", () => {
    const source = read("editor/helpLine.ts");
    for (const key of INSTRUCTION_KEYS) expect(source, key).toContain(`"${key}`);
  });
});
