import es from "../locales/es.json" with { type: "json" };

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

export interface HelpNotice {
  sectionName: string;
  brokenAnchors: number;
  persistent: boolean;
}

export interface HelpLineState {
  /** The delete notice (ADR 0014), alive while `Variants` keeps it. */
  notice: HelpNotice | null;
  /** The last `announce()`, with the moment it was said; stale after `ANNOUNCEMENT_MS`. */
  announcement: { text: string; at: number } | null;
  download: "idle" | "preparing" | "downloading" | "error" | "busy";
  photoError: string | null;
  /** The phone's reorder gesture refusing a drop (`rb-ghost-no`). */
  dragRefused: boolean;
  keyboard: KeyboardPlace;
  /** A popup with a note of its own open over a section. */
  menuNote: "composition" | "escalate" | null;
  /** The text bar open over a text bound to a collection. */
  bound: { places: number; list: string } | null;
  /** A chosen element: whether it is a text, and whether the arrows can move it. */
  chosen: { text: boolean; movable: boolean } | null;
  placeholders: number;
  /** A screen that is touched and never hovered: no keys are said, there are none. */
  touch: boolean;
  platform: "mac" | "other";
}

export interface HelpLineSays {
  child: HelpChild;
  text: string;
  tone: "info" | "warn" | "error";
  /** Drawn beside the text only for the delete notice: «Deshacer», and the cross if it stays. */
  notice?: { dismiss: boolean };
}

/** How long an announcement holds the live child before the notice, or silence, has it back. */
export const ANNOUNCEMENT_MS = 4000;

const EMPTY_LIVE: HelpLineSays = { child: "live", text: "", tone: "info" };

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
export function chosenHint(chosen: { text: boolean; movable: boolean }): string {
  return [
    chosen.text ? es["editor.canvas.chosenHint"] : "",
    chosen.movable ? es["editor.canvas.moveHint"] : "",
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
  // The keys of a control the focus is on — a section, the bar, its grip — before anything else;
  // the keys of a text being written *after* the bound sentence, because «si lo cambias, cambia en
  // todos» is what has to be read before the first keystroke, and the bar's badge already says it
  // in two characters where the writing happens.
  const keys = state.keyboard && !state.touch ? keysFor(state.keyboard, state.platform) : null;
  if (keys && state.keyboard !== "writing") return quiet(keys);
  if (state.menuNote === "composition") return quiet(es["editor.composition.note"]);
  if (state.menuNote === "escalate") return quiet(es["editor.section.escalate.body"]);
  if (state.bound) return quiet(boundSentence(state.bound.places, state.bound.list));
  if (keys) return quiet(keys);
  if (state.chosen) {
    const hint = chosenHint(state.chosen);
    if (hint !== "") return quiet(hint);
  }
  if (state.placeholders === 1) return quiet(es["editor.placeholder.one"], "warn");
  if (state.placeholders > 1) {
    return quiet(
      es["editor.placeholder.many"].replace("{count}", String(state.placeholders)),
      "warn",
    );
  }
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
  announcement: null,
  download: "idle",
  photoError: null,
  dragRefused: false,
  keyboard: null,
  menuNote: null,
  bound: null,
  chosen: null,
  placeholders: 0,
  touch: false,
  platform: "other",
};
