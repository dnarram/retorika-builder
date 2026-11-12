// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { HelpLine, WORD_STEPS } from "../src/editor/HelpLine.tsx";
import type { HelpLineSays } from "../src/editor/helpLine.ts";

/**
 * **The line's two voices, as React draws them** (sprint 36 día 5, David's adjustment 2): what
 * arrives in the live child reveals itself word by word and is plain text again once it has; what
 * changes in the quiet child cross-fades and never reveals. That the words rise and the sentences
 * fade is the stylesheet's and the walk's; what is here is the markup each voice is given, which is
 * where the two could be confused.
 */

const quiet = (text: string): HelpLineSays => ({ child: "quiet", text, tone: "info" });
const live = (text: string): HelpLineSays => ({ child: "live", text, tone: "info" });
const SILENT = live("");

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  root?.unmount();
  root = null;
  document.body.innerHTML = "";
});

function draw(props: { live: HelpLineSays; quiet: HelpLineSays }) {
  if (!root) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  flushSync(() =>
    root?.render(createElement(HelpLine, { ...props, onUndo: () => {}, onDismiss: () => {} })),
  );
}
const liveChild = () => host.querySelector('[data-testid="help-line-live"]') as HTMLElement;
const quietChild = () => host.querySelector('[data-testid="help-line-quiet"]') as HTMLElement;
const words = () => [...liveChild().querySelectorAll<HTMLElement>("[data-ui-word]")];

describe("what arrives in the live child", () => {
  it("arrives word by word, and holds the sentence exactly", () => {
    draw({ live: live("Has borrado la sección «Qué hago»"), quiet: quiet("Haz doble clic") });
    expect(words().map((w) => w.textContent)).toEqual([
      "Has",
      "borrado",
      "la",
      "sección",
      "«Qué",
      "hago»",
    ]);
    expect(liveChild().textContent).toBe("Has borrado la sección «Qué hago»");
    expect(words().map((w) => w.style.getPropertyValue("--ui-word-delay"))).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => `calc(var(--ui-stagger) * ${i})`),
    );
    expect(words().filter((w) => w.hasAttribute("data-ui-word-last"))).toEqual([words().at(-1)]);
  });

  it(`never takes more than ${WORD_STEPS} steps: the last carries the rest`, () => {
    const long =
      "Has borrado la sección «Opiniones». Un botón de tu web llevaba aquí y ahora no lleva a ningún sitio.";
    draw({ live: live(long), quiet: quiet("") });
    expect(words()).toHaveLength(WORD_STEPS);
    expect(words().at(-1)?.textContent).toBe(
      long
        .split(" ")
        .slice(WORD_STEPS - 1)
        .join(" "),
    );
    expect(liveChild().textContent).toBe(long);
  });

  it("is plain text again once its last word has landed, so the ellipsis works on it", () => {
    draw({ live: live("Menú de páginas: Columna izquierda"), quiet: quiet("") });
    words()[0]?.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(words().length, "an early word ended the reveal").toBeGreaterThan(0);
    flushSync(() => {
      words()
        .at(-1)
        ?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(words()).toHaveLength(0);
    expect(liveChild().textContent).toBe("Menú de páginas: Columna izquierda");
  });
});

describe("what changes in the quiet child", () => {
  it("never reveals by words, and fades in over a copy of what it said before", () => {
    draw({ live: SILENT, quiet: quiet("Haz doble clic en cualquier texto") });
    const first = quietChild();
    draw({ live: SILENT, quiet: quiet("Doble clic o Intro para escribir") });
    expect(quietChild(), "a new sentence is a new node, so its fade is an arrival").not.toBe(first);
    expect(quietChild().classList.contains("ui-cross-in")).toBe(true);
    expect(quietChild().textContent).toBe("Doble clic o Intro para escribir");
    expect(quietChild().querySelectorAll("[data-ui-word]")).toHaveLength(0);
    const copy = host.querySelector<HTMLElement>("[data-help-leaving]");
    expect(copy?.getAttribute("data-leaving-text")).toBe("Haz doble clic en cualquier texto");
    expect(copy?.textContent, "the copy's words are written, so they can be found").toBe("");
    expect(copy?.getAttribute("aria-hidden")).toBe("true");
    expect(copy?.classList.contains("ui-cross-out")).toBe(true);
    expect(quietChild().contains(copy as Node), "the copy is inside the quiet child").toBe(false);
  });

  it("lets the copy go on its own end, and keeps none while the live child speaks", () => {
    draw({ live: SILENT, quiet: quiet("A") });
    draw({ live: SILENT, quiet: quiet("B") });
    flushSync(() => {
      host
        .querySelector("[data-help-leaving]")
        ?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(host.querySelector("[data-help-leaving]")).toBeNull();
    draw({ live: live("Has borrado la sección «Qué hago»"), quiet: quiet("C") });
    expect(host.querySelector("[data-help-leaving]")).toBeNull();
  });
});
