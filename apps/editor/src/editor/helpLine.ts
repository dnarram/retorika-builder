import es from "../locales/es.json" with { type: "json" };
import { boundOrderSentence } from "./listReorder.ts";

/**
 * **What the help line says, and in which of its two voices** (ADR 0071, sprint 36 día 1).
 *
 * Every instruction the editor used to draw over the page — the key legend in the frame's corner,
 * «Doble clic o Intro para escribir» at the foot of the chosen text's section, «Arrastra arriba o
 * abajo» across the row being dragged on a phone, the notes inside the «Aspecto» menu and the
 * «A mano» offer, «Este texto aparece en {n} sitios» in the text bar, the delete notice fixed over
 * the card — says it here instead, in one 32 px row of the chrome that is outside the card and its
 * zoom. One text at a time, chosen by a closed priority, so the row never grows and the canvas never
 * moves when the message changes (David's condition).
 *
 * **Two voices, and the split is David's** (adjustment 1 of the plan): a screen reader is told what it
 * could not see coming — a move's announcement, the delete notice, an error — through the **live**
 * child (`aria-live="polite"`, atomic); what changes with focus — the idle hint, the keys of the place
 * the focus is in, the chosen element's hint, a menu's note — goes through the **quiet** child
 * (`aria-live="off"`), because it already reaches a reader by its own path (`aria-describedby`, the
 * controls' names) and reading it on every Tab would be a reader talking without pause. The function
 * returns the child; the test asserts the mapping, and the walk asserts that Tab never touches the
 * live child.
 *
 * Pure: the editor hands it a snapshot of its state and the clock, and draws what comes back.
 */

export type HelpChild = "live" | "quiet";

/** Where the keyboard is, as far as the keys worth saying go. `null` is «nowhere that has keys of
 * its own»: a pointer on the page, the text bar closed, or the frame without focus. */
/** «hub» is the radial rail's hub or one of its pills (sprint 37 día 3, ADR 0072), in the editor's
 * own document rather than the frame — the same line says its keys. */
export type KeyboardPlace = "section" | "bar" | "grip" | "writing" | "hub" | null;

/**
 * **A gesture the canvas offers for the control the hand or the keyboard is on** (sprint 39 día 3,
 * ADR 0071 as David's answer C1 applies it): the menu dragged to its zone («Dónde va», ADR 0066), the
 * brand dragged and the logo stretched («Dónde va la marca», ADR 0070 §5), and the folded bar's
 * «Menú» as the pages' grip. Said in the quiet voice while the control has the focus or the mouse —
 * an instruction, which lives in the line and never in a panel's note — and never in the live one:
 * the person reached for the control, nothing arrived unasked.
 */
export type GestureHint = "menu" | "foldedMenu" | "brand";

/** A panel whose one instruction the line says while it is open: how a page is made («Páginas», when
 * there is room for one), what to fill in («Campos»), and that a link of the menu in the preview takes
 * you to its section or page («Menú», since sprint 39 día 4 made its head one sentence of what it
 * holds). Names and states stay in the panel. */
export type PanelHint = "pages" | "fields" | "menu";

export interface HelpNotice {
  sectionName: string;
  brokenAnchors: number;
  persistent: boolean;
}

export interface HelpLineState {
  /** The delete notice (ADR 0014), alive while `Variants` keeps it. */
  notice: HelpNotice | null;
  /**
   * A logo uploaded to an untouched site has just repainted it in the logo's colours (sprint 38 día 3,
   * ADR 0076) — news the owner did not ask for in so many words, so the live voice, with «Deshacer»
   * beside it like the delete notice: one press takes the colours back and leaves the logo. Alive
   * while `Variants` keeps it, cleared by any other edit, as the delete notice is.
   */
  coloursApplied: boolean;
  /** The last `announce()`, with the moment it was said; stale after `ANNOUNCEMENT_MS`. */
  announcement: { text: string; at: number } | null;
  download: "idle" | "preparing" | "downloading" | "error" | "busy";
  photoError: string | null;
  /** The phone's reorder gesture refusing a drop (`rb-ghost-no`). */
  dragRefused: boolean;
  /** «Estirando» (sprint 41 día 6): the chosen element's arrows change its size, until E or Escape. */
  stretching: boolean;
  keyboard: KeyboardPlace;
  /** A popup with a note of its own open over a section. */
  menuNote: "composition" | "escalate" | "escalateHeld" | null;
  /** The text bar open over a text bound to a collection. */
  bound: { places: number; list: string } | null;
  /** A bound list's card grip held — by the pointer or the keyboard — (sprint 41 día 8, David's
   * adjustment 3): its order is the list's, so the line says in how many sections it moves. */
  gripBound: { places: number; list: string } | null;
  /** A chosen element: whether it is a text, whether the arrows can move it, and whether it is a
   * link that leads somewhere in the site, so Ctrl/Cmd+Intro goes there (ADR 0079). */
  chosen: { text: boolean; movable: boolean; goes: boolean } | null;
  placeholders: number;
  /** A screen that is touched and never hovered: no keys are said, there are none. */
  touch: boolean;
  platform: "mac" | "other";
  /** Something offered once, at rest: the radial menu (sprint 37 día 6, ADR 0072), or the logo's
   * colours a site does not wear yet (sprint 38 día 3, ADR 0076). The line's lowest voice. */
  offer: "radial" | "logoColours" | null;
  /** The gesture of the control under the hand or the keyboard in «Menú», or none. */
  gesture: GestureHint | null;
  /** The open panel with an instruction to say, or none. */
  panel: PanelHint | null;
  /** The site has every page it may have: «Páginas» then has no instruction to give. */
  pagesFull: boolean;
}

export interface HelpLineSays {
  child: HelpChild;
  text: string;
  tone: "info" | "warn" | "error";
  /** Drawn beside the text only for the delete notice: «Deshacer», and the cross if it stays. */
  notice?: { dismiss: boolean };
  /** Drawn beside the quiet text only for an offer: a cross that answers it. */
  offer?: true;
}

/** How long an announcement holds the live child before the notice, or silence, has it back. */
export const ANNOUNCEMENT_MS = 4000;

const EMPTY_LIVE: HelpLineSays = { child: "live", text: "", tone: "info" };

/** The gestures' sentences, each key written out: the guard that no instruction is read outside
 * this module finds them by name. */
const GESTURE_TEXT: Record<GestureHint, string> = {
  menu: es["editor.help.gesture.menu"],
  foldedMenu: es["editor.help.gesture.foldedMenu"],
  brand: es["editor.help.gesture.brand"],
};

/** The keys of a place, in the words the person's own machine needs (ADR 0052 §3, David's note 8:
 * without Fn a MacBook's F10 mutes the audio and never arrives). */
export function keysFor(place: Exclude<KeyboardPlace, null>, platform: "mac" | "other"): string {
  const toBar =
    platform === "mac" ? es["editor.canvasKeys.toBarMac"] : es["editor.canvasKeys.toBar"];
  switch (place) {
    case "section":
      return es["editor.help.keys.section"];
    case "bar":
      return es["editor.help.keys.bar"];
    case "grip":
      return es["editor.help.keys.grip"];
    case "writing":
      return es["editor.help.keys.writing"].replace("{toBar}", toBar);
    case "hub":
      return es["editor.help.keys.hub"];
  }
}

/** The sentence about a text bound to a collection — the bar's badge carries it as `title` and
 * `aria-label`, the line says it in full (David's decision 3). */
export function boundSentence(places: number, list: string): string {
  return places > 1
    ? es["editor.toolbar.boundMany"].replace("{n}", String(places))
    : es["editor.toolbar.boundOne"].replace("{list}", list);
}

/** The two characters that stand in the bar for the sentence above. */
export function boundBadge(places: number): string {
  return places > 1
    ? es["editor.toolbar.boundBadge"].replace("{n}", String(places))
    : es["editor.toolbar.listBadge"];
}

/** What the chosen element's hint says: nothing for an element that can neither be written in nor
 * moved, and both halves joined when both are true (ADR 0049). Also the text of the `sr-only`
 * description inside the frame, so the line and `aria-describedby` cannot disagree. */
export function chosenHint(
  chosen: { text: boolean; movable: boolean; goes: boolean },
  platform: "mac" | "other" = "other",
): string {
  return [
    chosen.text ? es["editor.canvas.chosenHint"] : "",
    // The key is named by the machine, like every other key the line says (ADR 0052 §3).
    chosen.goes
      ? platform === "mac"
        ? es["editor.canvas.goHintMac"]
        : es["editor.canvas.goHint"]
      : "",
    chosen.movable ? es["editor.canvas.moveHint"] : "",
    // And its size, with the keys the corner and the sides have since sprint 41 día 6 (ADR 0082).
    chosen.movable ? es["editor.canvas.shapeHint"] : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

export function noticeText(notice: HelpNotice): string {
  const deleted = es["editor.toast.deleted"].replace("{name}", notice.sectionName);
  if (notice.brokenAnchors === 0) return deleted;
  const anchors =
    notice.brokenAnchors === 1
      ? es["editor.toast.deletedAnchors.one"]
      : es["editor.toast.deletedAnchors.many"].replace("{count}", String(notice.brokenAnchors));
  return `${deleted}. ${anchors}`;
}

/** The live child: what the person did not see coming, newest first. Empty when nothing is. */
export function liveSays(state: HelpLineState, now: number): HelpLineSays {
  const announcement = state.announcement;
  if (announcement && now - announcement.at < ANNOUNCEMENT_MS) {
    return { child: "live", text: announcement.text, tone: "info" };
  }
  if (state.notice) {
    return {
      child: "live",
      text: noticeText(state.notice),
      tone: "info",
      notice: { dismiss: state.notice.persistent },
    };
  }
  // The colours a late logo applied: the same shape as the delete notice — a sentence and «Deshacer»,
  // no cross, since it goes by itself and any other edit takes it away.
  if (state.coloursApplied) {
    return {
      child: "live",
      text: es["editor.logo.coloursApplied"],
      tone: "info",
      notice: { dismiss: false },
    };
  }
  if (state.download === "error")
    return { child: "live", text: es["editor.downloadError"], tone: "error" };
  if (state.download === "busy")
    return { child: "live", text: es["editor.downloadBusy"], tone: "error" };
  if (state.photoError) return { child: "live", text: state.photoError, tone: "error" };
  return EMPTY_LIVE;
}

/** The quiet child: what goes with the focus. Never empty — at rest it is the idle hint. */
export function quietSays(state: HelpLineState): HelpLineSays {
  const quiet = (text: string, tone: HelpLineSays["tone"] = "info"): HelpLineSays => ({
    child: "quiet",
    text,
    tone,
  });
  if (state.dragRefused) return quiet(es["editor.drag.order"]);
  if (state.stretching) return quiet(es["editor.help.keys.stretch"]);
  // The keys of a control the focus is on — a section, the bar, its grip — before anything else;
  // the keys of a text being written *after* the bound sentence, because «si lo cambias, cambia en
  // todos» is what has to be read before the first keystroke, and the bar's badge already says it
  // in two characters where the writing happens.
  const keys = state.keyboard && !state.touch ? keysFor(state.keyboard, state.platform) : null;
  if (keys && state.keyboard !== "writing") return quiet(keys);
  if (state.menuNote === "composition") return quiet(es["editor.composition.note"]);
  if (state.menuNote === "escalate") return quiet(es["editor.section.escalate.body"]);
  // The offer asked by a gesture, with the element held where the hand left it (sprint 41 día 3).
  if (state.menuNote === "escalateHeld") return quiet(es["editor.section.escalate.bodyHeld"]);
  if (state.gripBound) {
    return quiet(boundOrderSentence(state.gripBound.places, state.gripBound.list));
  }
  if (state.bound) return quiet(boundSentence(state.bound.places, state.bound.list));
  if (keys) return quiet(keys);
  // The gesture of the control the hand is on, then the open panel's one instruction: what a person
  // reached for, before what they merely have chosen on the canvas.
  if (state.gesture) return quiet(GESTURE_TEXT[state.gesture]);
  // **The logo's colours outrank an open panel's instruction** (sprint 39 día 4): that offer arrives
  // when a logo comes in from «Menú», so it is the consequence of what the hand just did in the panel
  // that is open, and an instruction can wait for it. The radial menu's offer, which is about the
  // editor and not the site, still waits under the instruction, at the bottom with every offer.
  if (state.panel && state.offer === "logoColours") {
    return { ...quiet(es["editor.logo.offer"]), offer: true };
  }
  if (state.panel === "pages" && !state.pagesFull) return quiet(es["editor.help.panel.pages"]);
  if (state.panel === "fields") return quiet(es["editor.help.panel.fields"]);
  if (state.panel === "menu") return quiet(es["editor.help.panel.menu"]);
  if (state.chosen) {
    // A touched screen has no Ctrl or Cmd to name; the bar's «Ir» is the way there.
    const hint = chosenHint(
      { ...state.chosen, goes: state.chosen.goes && !state.touch },
      state.platform,
    );
    if (hint !== "") return quiet(hint);
  }
  if (state.placeholders === 1) return quiet(es["editor.placeholder.one"], "warn");
  if (state.placeholders > 1) {
    return quiet(
      es["editor.placeholder.many"].replace("{count}", String(state.placeholders)),
      "warn",
    );
  }
  // **The offer is the quietest thing the line says** (sprint 37 día 6): only where nothing else has
  // anything to say, in place of the idle hint, and never through the live child — it is a
  // suggestion that waits to be read, not news.
  if (state.offer === "radial") return { ...quiet(es["editor.rail.try.offer"]), offer: true };
  if (state.offer === "logoColours") return { ...quiet(es["editor.logo.offer"]), offer: true };
  return quiet(es["editor.editHint"]);
}

/** Both voices at once: the line draws the live one when it has text and the quiet one otherwise,
 * and keeps both nodes in the page so a reader's region exists before anything is said in it. */
export function helpLineFor(
  state: HelpLineState,
  now: number,
): { live: HelpLineSays; quiet: HelpLineSays } {
  return { live: liveSays(state, now), quiet: quietSays(state) };
}

/** The state before anything has happened, for the editor's first render and the tests. */
export const HELP_AT_REST: HelpLineState = {
  notice: null,
  coloursApplied: false,
  announcement: null,
  download: "idle",
  photoError: null,
  dragRefused: false,
  stretching: false,
  keyboard: null,
  menuNote: null,
  bound: null,
  gripBound: null,
  chosen: null,
  placeholders: 0,
  touch: false,
  platform: "other",
  offer: null,
  gesture: null,
  panel: null,
  pagesFull: false,
};
