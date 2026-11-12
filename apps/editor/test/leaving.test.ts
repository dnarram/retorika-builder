// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ghostOf, LEAVING_FALLBACK_MS, leave, leaveScreen } from "../src/editor/leaving.ts";

/**
 * The exit copy (sprint 35 día 2). What a browser alone can show — that the copy is drawn where
 * the original was, travels and ends — is in the walks; what is here is everything the copy must
 * *not* be, which a walk would only find by luck: findable, focusable, a second landmark, drawn
 * for a node that stayed, or left standing when its animation never ran.
 */

function panel(): HTMLElement {
  document.body.innerHTML = `
    <main data-testid="canvas-and-panel">
      <div data-testid="canvas">canvas</div>
      <aside id="style-panel" aria-labelledby="style-title" class="ui-enter-right card">
        <h2 id="style-title">El estilo de toda la web</h2>
        <label for="scale">Escala</label>
        <input id="scale" name="scale" type="radio" data-initial-focus />
        <button type="button" aria-label="Cerrar el estilo" data-testid="close">x</button>
        <video></video>
      </aside>
    </main>`;
  return document.querySelector("aside") as HTMLElement;
}

let reduced = false;
beforeEach(() => {
  reduced = false;
  // The window the module asks is the node's own (`ownerDocument.defaultView`), which here is the
  // test's window: the preference is answered from this flag.
  // The exact query, not a substring of it: «prefers-reduced-motion» already contains «reduce», and
  // the first version of this stub answered yes to any query at all about the preference — so the
  // module's own check could be broken and this file stayed green (found sabotaging it).
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the copy is decoration and nothing else", () => {
  it("is inert, hidden from assistive technology and blind to the pointer", () => {
    const { ghost } = ghostOf(panel(), "panel");
    expect(ghost.hasAttribute("inert")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.style.pointerEvents).toBe("none");
    expect(ghost.getAttribute("data-leaving")).toBe("panel");
  });

  it("is never a second landmark: an <aside> comes back as a <div>, with its look", () => {
    const { ghost } = ghostOf(panel(), "panel");
    expect(ghost.tagName).toBe("DIV");
    expect(ghost.classList.contains("card")).toBe(true);
    expect(ghost.querySelector("h2 [data-leaving-text]")?.getAttribute("data-leaving-text")).toBe(
      "El estilo de toda la web",
    );
  });

  it("cannot be found by anything the original could be found by", () => {
    const { ghost } = ghostOf(panel(), "panel");
    const all = [ghost, ...ghost.querySelectorAll("*")];
    for (const attribute of [
      "id",
      "data-testid",
      "name",
      "for",
      "aria-labelledby",
      "aria-label",
      "data-initial-focus",
    ]) {
      expect(
        all.filter((element) => element.hasAttribute(attribute)).map((element) => element.tagName),
        `${attribute} survived on the copy`,
      ).toEqual([]);
    }
  });

  it("has no text anything can find, and keeps every word to paint", () => {
    const { ghost } = ghostOf(panel(), "panel");
    // The page's text, which is what a locator by text and find-in-page read: none in the copy.
    expect(ghost.textContent?.trim()).toBe("");
    const painted = [...ghost.querySelectorAll("[data-leaving-text]")].map((span) =>
      span.getAttribute("data-leaving-text")?.trim(),
    );
    expect(painted).toEqual(expect.arrayContaining(["El estilo de toda la web", "Escala", "x"]));
  });

  it("does not replay its entrance, and drops what would load again", () => {
    const { ghost } = ghostOf(panel(), "panel");
    expect(ghost.classList.contains("ui-enter-right")).toBe(false);
    expect(ghost.querySelector("iframe, video")).toBeNull();
  });
});

describe("it is drawn only for a node that really left", () => {
  it("is drawn in the body, fixed, when a panel is removed in the same task", async () => {
    const node = panel();
    leave(node, "panel");
    node.remove(); // what React does next in the same commit
    await Promise.resolve();
    const ghost = document.body.querySelector<HTMLElement>('[data-leaving="panel"]');
    expect(ghost, "no copy was drawn for a panel that left").not.toBeNull();
    expect(ghost?.parentElement).toBe(document.body);
    expect(ghost?.style.position).toBe("fixed");
    // The row keeps exactly what it has: the canvas, and no second panel.
    expect(document.querySelector('[data-testid="canvas-and-panel"]')?.children.length).toBe(1);
  });

  it("is not drawn when the node stays — React's rehearsal of an unmount in development", async () => {
    const node = panel();
    leave(node, "panel");
    await Promise.resolve();
    expect(document.querySelector("[data-leaving]")).toBeNull();
  });

  it("is not drawn when the whole screen went with it, not only the panel", async () => {
    const node = panel();
    const row = node.parentElement as HTMLElement;
    leave(node, "panel", row);
    row.remove(); // the editor itself unmounted, its panel open
    await Promise.resolve();
    expect(document.querySelector("[data-leaving]")).toBeNull();
  });

  it("is not drawn for somebody who asked for less movement", async () => {
    reduced = true;
    const node = panel();
    leave(node, "panel");
    node.remove();
    await Promise.resolve();
    expect(document.querySelector("[data-leaving]")).toBeNull();
  });

  it("goes back beside where a dialog was, not to the body", async () => {
    document.body.innerHTML = `
      <div id="root"><p>before</p><div class="backdrop"><div role="dialog" aria-modal="true">
        <button data-initial-focus>Descargar igualmente</button></div></div><p>after</p></div>`;
    const backdrop = document.querySelector(".backdrop") as HTMLElement;
    leave(backdrop, "dialog");
    backdrop.remove();
    await Promise.resolve();
    const ghost = document.querySelector<HTMLElement>('[data-leaving="dialog"]');
    expect(ghost?.parentElement?.id).toBe("root");
    expect(ghost?.nextElementSibling?.textContent).toBe("after");
    expect(ghost?.querySelector("[role], [aria-modal]")).toBeNull();
  });
});

describe("in the canvas, the copy is out of every query's reach", () => {
  it("keeps a closing menu's copy where no class selector — the walks', or the editor's own — finds it", async () => {
    document.head.innerHTML = '<style data-rb-chrome="1">.rb-menu { position: absolute; }</style>';
    document.body.innerHTML = `
      <div class="rb-gap"><button class="rb-pill">Añadir sección aquí</button>
        <div class="rb-menu" data-rb-chrome="1"><input class="rb-menu-search" type="search" /></div>
      </div>`;
    const menu = document.querySelector(".rb-menu") as HTMLElement;
    leave(menu, "popup");
    menu.remove();
    await Promise.resolve();
    const host = document.querySelector<HTMLElement>('[data-leaving-host="popup"]');
    expect(host, "no copy was drawn").not.toBeNull();
    expect(host?.parentElement?.className).toBe("rb-gap");
    // What `drawGaps` asks to reopen a menu after a redraw, and what a walk fills: nothing.
    expect(document.querySelector(".rb-gap .rb-menu")).toBeNull();
    expect(document.querySelectorAll(".rb-menu-search")).toHaveLength(0);
    expect(host?.shadowRoot, "an open shadow root can be queried").toBeNull();
  });
});

describe("it always ends", () => {
  it("on its own animationend, and not on a child's", async () => {
    const node = panel();
    leave(node, "panel");
    node.remove();
    await Promise.resolve();
    const ghost = document.querySelector('[data-leaving="panel"]') as HTMLElement;
    ghost.querySelector("h2")?.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(ghost.isConnected, "a child's end took the whole copy").toBe(true);
    ghost.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(ghost.isConnected).toBe(false);
  });

  it(`after ${LEAVING_FALLBACK_MS} ms when its animation never runs`, async () => {
    vi.useFakeTimers();
    const node = panel();
    leave(node, "panel");
    node.remove();
    await Promise.resolve();
    expect(document.querySelector("[data-leaving]")).not.toBeNull();
    vi.advanceTimersByTime(LEAVING_FALLBACK_MS - 1);
    expect(document.querySelector("[data-leaving]"), "gone before its time").not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector("[data-leaving]")).toBeNull();
  });
});

/**
 * **A whole screen leaving** (sprint 36 día 3): the landing, before «Crear mi web» asks for the
 * questions. The real element is marked, never copied; the navigation runs once, on the screen's
 * own end or after the fallback; and for somebody who asked for less movement it runs at once with
 * nothing marked.
 */
describe("a screen leaving before the next is asked for", () => {
  function screen(): HTMLElement {
    document.body.innerHTML = '<main><a href="/empezar">Crear mi web</a></main>';
    return document.querySelector("main") as HTMLElement;
  }

  it("marks the real screen and asks for the next on its own end, once", () => {
    const main = screen();
    let asked = 0;
    leaveScreen(main, () => (asked += 1));
    expect(main.getAttribute("data-leaving")).toBe("screen");
    expect(document.querySelectorAll("[data-leaving]")).toHaveLength(1);
    main.querySelector("a")?.dispatchEvent(new Event("animationend", { bubbles: true }));
    expect(asked, "a child's end asked for the next screen").toBe(0);
    main.dispatchEvent(new Event("animationend"));
    main.dispatchEvent(new Event("animationend"));
    expect(asked).toBe(1);
  });

  it(`asks after ${LEAVING_FALLBACK_MS} ms when the fade never runs, and only then`, () => {
    vi.useFakeTimers();
    const main = screen();
    let asked = 0;
    leaveScreen(main, () => (asked += 1));
    vi.advanceTimersByTime(LEAVING_FALLBACK_MS - 1);
    expect(asked).toBe(0);
    vi.advanceTimersByTime(1);
    expect(asked).toBe(1);
    main.dispatchEvent(new Event("animationend"));
    expect(asked).toBe(1);
  });

  it("asks at once and marks nothing for somebody who asked for less movement", () => {
    reduced = true;
    const main = screen();
    let asked = 0;
    leaveScreen(main, () => (asked += 1));
    expect(asked).toBe(1);
    expect(main.hasAttribute("data-leaving")).toBe(false);
  });

  it("takes its mark off a screen that comes back as it was", () => {
    const main = screen();
    const unmark = leaveScreen(main, () => {});
    unmark();
    expect(main.hasAttribute("data-leaving")).toBe(false);
  });
});
