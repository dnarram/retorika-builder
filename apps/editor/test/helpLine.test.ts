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
    // The radial rail's hub (sprint 37 día 3): its keys, in its own words.
    expect(quietSays(at({ keyboard: "hub" })).text).toBe(es["editor.help.keys.hub"]);
    expect(quietSays(at({ keyboard: "writing", platform: "mac" })).text).toContain("Fn+⌥+F10");
    expect(quietSays(at({ keyboard: "writing", platform: "other" })).text).toContain("Alt+F10");
    expect(keysFor("writing", "other")).not.toContain("{toBar}");
  });

  it("says no keys on the hub of a touched screen either", () => {
    expect(quietSays(at({ keyboard: "hub", touch: true })).text).toBe(es["editor.editHint"]);
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
      { keyboard: "hub" as const },
      { chosen: { text: true, movable: false } },
      { menuNote: "escalate" as const },
      { bound: { places: 2, list: "" } },
      { dragRefused: true },
      { placeholders: 4 },
      { offer: "radial" as const },
      { offer: "logoColours" as const },
    ]) {
      const says = helpLineFor(at(patch), 0);
      expect(says.quiet.child).toBe("quiet");
      expect(says.live.text, JSON.stringify(patch)).toBe("");
    }
  });
});

/**
 * **The radial menu, offered once** (sprint 37 día 6, ADR 0072): the line's lowest voice. It takes
 * the idle hint's place and nothing else's, it is never news, and it is the one quiet sentence that
 * carries a cross.
 */
/**
 * **The gesture under the hand, and the open panel's one instruction** (sprint 39 día 3, ADR 0071 as
 * David's answer C1 applies it): each a sentence that used to sit in a panel's note, said now in the
 * quiet voice — a person reached for the control — and never in the live one.
 */
describe("the gesture of the control under the hand, and the panel's instruction", () => {
  it("says the gesture of «Dónde va», of the folded bar's «Menú», and of the brand's place", () => {
    expect(quietSays(at({ gesture: "menu" })).text).toBe(es["editor.help.gesture.menu"]);
    expect(quietSays(at({ gesture: "foldedMenu" })).text).toBe(
      es["editor.help.gesture.foldedMenu"],
    );
    expect(quietSays(at({ gesture: "brand" })).text).toBe(es["editor.help.gesture.brand"]);
    for (const gesture of ["menu", "foldedMenu", "brand"] as const) {
      expect(quietSays(at({ gesture })).child).toBe("quiet");
      expect(liveSays(at({ gesture }), 0).text).toBe("");
    }
  });

  it("says how a page is made while «Páginas» is open and there is room for one, and what to fill in «Campos»", () => {
    expect(quietSays(at({ panel: "pages" })).text).toBe(es["editor.help.panel.pages"]);
    expect(quietSays(at({ panel: "pages", pagesFull: true })).text).toBe(es["editor.editHint"]);
    expect(quietSays(at({ panel: "fields" })).text).toBe(es["editor.help.panel.fields"]);
    expect(quietSays(at({ panel: "fields" })).child).toBe("quiet");
    // «Menú»'s head is one sentence of what it holds since sprint 39 día 4; how its links behave in
    // the preview is an instruction, and the line says it.
    expect(quietSays(at({ panel: "menu" })).text).toBe(es["editor.help.panel.menu"]);
    expect(es["editor.menuPanel.help"]).toBe("Tu marca, el menú y el botón de la barra de arriba.");
  });

  it("ranks the keys over the gesture, the gesture over the panel, the panel over the chosen hint", () => {
    const all = at({
      keyboard: "section",
      gesture: "menu",
      panel: "fields",
      chosen: { text: true, movable: false },
    });
    expect(quietSays(all).text).toBe(keysFor("section", "other"));
    expect(quietSays({ ...all, keyboard: null }).text).toBe(es["editor.help.gesture.menu"]);
    expect(quietSays({ ...all, keyboard: null, gesture: null }).text).toBe(
      es["editor.help.panel.fields"],
    );
    expect(quietSays({ ...all, keyboard: null, gesture: null, panel: null }).text).toBe(
      chosenHint({ text: true, movable: false }),
    );
  });
});

describe("the offer of the radial menu", () => {
  it("is said quietly at rest, in place of the idle hint, with its cross", () => {
    const says = helpLineFor(at({ offer: "radial" }), 0);
    expect(says.quiet).toEqual({
      child: "quiet",
      text: es["editor.rail.try.offer"],
      tone: "info",
      offer: true,
    });
    expect(says.live.text).toBe("");
    expect(says.live.offer).toBeUndefined();
    // A tablet can choose the radial menu too: a touched screen hides keys, not the offer.
    expect(quietSays(at({ offer: "radial", touch: true })).offer).toBe(true);
  });

  it("yields to everything else the quiet child has to say, and leaves no cross behind", () => {
    for (const patch of [
      { dragRefused: true },
      { keyboard: "section" as const },
      { keyboard: "hub" as const },
      { keyboard: "writing" as const },
      { menuNote: "composition" as const },
      { bound: { places: 2, list: "" } },
      { chosen: { text: true, movable: false } },
      { placeholders: 1 },
    ]) {
      expect(quietSays(at({ ...patch, offer: "radial" })), JSON.stringify(patch)).toEqual(
        quietSays(at(patch)),
      );
    }
  });

  it("waits under the live child, which keeps its own sentence", () => {
    for (const patch of [
      { notice: NOTICE },
      { announcement: { text: "x", at: 0 } },
      { download: "error" as const },
    ]) {
      const says = helpLineFor(at({ ...patch, offer: "radial" }), 0);
      expect(says.live).toEqual(liveSays(at(patch), 0));
      expect(says.quiet.offer).toBe(true);
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
    "editor.rail.try.offer",
    // Sprint 39 día 3: the gestures «Menú» used to say beside its cards, and the one instruction of
    // «Páginas» and of «Campos».
    "editor.help.gesture.",
    "editor.help.panel.",
  ];
  const read = (file: string) =>
    readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");

  it.each([
    "questionnaire/Editor.tsx",
    "editor/EditorShell.tsx",
    "questionnaire/MenuPanel.tsx",
    "questionnaire/PagesPanel.tsx",
    "questionnaire/FieldsPanel.tsx",
  ])("%s reads none of them", (file) => {
    const source = read(file);
    const found = INSTRUCTION_KEYS.filter((key) => source.includes(`"${key}`));
    expect(
      found,
      `an instruction read outside the help line is one that can be drawn over the page again`,
    ).toEqual([]);
  });

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

/**
 * **The logo's colours** (sprint 38 día 3, ADR 0076): applied to an untouched site, they are news
 * with «Deshacer», in the live voice like the delete notice; not applied, they are offered once in the
 * quiet voice with a cross, like the radial menu.
 */
describe("the logo's colours in the line", () => {
  it("says they were applied in the live voice, with «Deshacer» and no cross", () => {
    const says = helpLineFor(at({ coloursApplied: true }), 0);
    expect(says.live).toEqual({
      child: "live",
      text: es["editor.logo.coloursApplied"],
      tone: "info",
      notice: { dismiss: false },
    });
    // An announcement is newer and says first; the delete notice outranks it, since a delete clears it.
    expect(
      helpLineFor(at({ coloursApplied: true, announcement: { text: "x", at: 0 } }), 0).live.text,
    ).toBe("x");
  });

  it("offers them quietly at rest, with a cross, never through the live voice", () => {
    const says = helpLineFor(at({ offer: "logoColours" }), 0);
    expect(says.quiet).toEqual({
      child: "quiet",
      text: es["editor.logo.offer"],
      tone: "info",
      offer: true,
    });
    expect(says.live.text).toBe("");
  });

  it("yields like every offer to whatever else the quiet child has to say", () => {
    for (const patch of [{ keyboard: "section" as const }, { placeholders: 2 }]) {
      expect(quietSays(at({ ...patch, offer: "logoColours" }))).toEqual(quietSays(at(patch)));
    }
  });
});
