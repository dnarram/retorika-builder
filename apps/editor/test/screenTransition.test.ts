// @vitest-environment happy-dom
import { createElement, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canTransition,
  SCENE_ATTRIBUTE,
  SCENE_WAIT_CAP_MS,
  SCREEN_ATTRIBUTE,
  transitionScreen,
} from "../src/editor/screenTransition.ts";

/**
 * One screen handing over to the next (sprint 36 día 3). What a browser alone shows — the question
 * sliding, the root not fading — is the walk's; what is here is the decision and the one thing a
 * walk would see only as «nothing moved»: that the new screen is rendered by the time the browser
 * captures it.
 */

/** The document with its `startViewTransition` replaceable: the DOM's own type pins the real one. */
type Loose = { startViewTransition?: unknown };
const loose = () => document as unknown as Loose;

interface Transition {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
}

/** A stand-in for the browser's: captures the page, calls the update, captures again. */
function fakeTransitions(capture: () => string) {
  const calls: { before: string; after: string; finish: () => void }[] = [];
  loose().startViewTransition = (update: () => void): Transition => {
    const before = capture();
    update();
    const after = capture();
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    calls.push({ before, after, finish });
    return { finished, ready: Promise.resolve(), updateCallbackDone: Promise.resolve() };
  };
  return calls;
}

let root: Root | null = null;
afterEach(() => {
  vi.useRealTimers();
  root?.unmount();
  root = null;
  delete loose().startViewTransition;
  document.documentElement.removeAttribute(SCREEN_ATTRIBUTE);
  document.body.innerHTML = "";
});

/** A two-step screen rendered by React, with its setter handed out. */
function mountSteps(): { container: HTMLElement; go: (step: number) => void } {
  const container = document.createElement("div");
  document.body.append(container);
  let go: (step: number) => void = () => {};
  function Steps() {
    const [step, setStep] = useState(1);
    go = setStep;
    return createElement("p", null, `Pregunta ${step}`);
  }
  root = createRoot(container);
  flushSync(() => root?.render(createElement(Steps)));
  return { container, go: (step) => go(step) };
}

describe("whether a screen can hand over", () => {
  it("is asked of the function itself", () => {
    expect(canTransition(document)).toBe(false);
    loose().startViewTransition = () => ({});
    expect(canTransition(document)).toBe(true);
  });

  it("applies the update at once where there are no view transitions", () => {
    let applied = false;
    expect(transitionScreen(() => (applied = true), { direction: "forward" })).toBe(false);
    expect(applied).toBe(true);
    expect(document.documentElement.hasAttribute(SCREEN_ATTRIBUTE)).toBe(false);
  });
});

describe("a screen handing over", () => {
  it("starts one transition, with the direction on the root until it finishes", async () => {
    const calls = fakeTransitions(
      () => document.documentElement.getAttribute(SCREEN_ATTRIBUTE) ?? "",
    );
    expect(transitionScreen(() => {}, { direction: "back" })).toBe(true);
    expect(calls).toHaveLength(1);
    // Written before the browser captures the old screen, so the names it reads are there.
    expect(calls[0]?.before).toBe("back");
    calls[0]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(SCREEN_ATTRIBUTE)).toBe(false);
  });

  it("leaves the attribute to a newer transition when an older one settles", async () => {
    const calls = fakeTransitions(() => "");
    transitionScreen(() => {}, { direction: "forward" });
    transitionScreen(() => {}, { direction: "back" });
    calls[0]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.getAttribute(SCREEN_ATTRIBUTE)).toBe("back");
    calls[1]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(SCREEN_ATTRIBUTE)).toBe(false);
  });

  /**
   * **The new capture is the new screen.** The browser captures the moment the update returns; a
   * React update made there without `flushSync` is only scheduled, and the capture would be the old
   * question twice — a transition from a screen to itself, which animates nothing.
   */
  it("renders React's new screen before the browser captures it", () => {
    const { container, go } = mountSteps();
    const calls = fakeTransitions(() => container.textContent ?? "");
    transitionScreen(() => go(2), { direction: "forward" });
    expect(calls[0]?.before).toBe("Pregunta 1");
    expect(calls[0]?.after, "the browser would capture the old screen as the new one").toBe(
      "Pregunta 2",
    );
  });
});

/**
 * **A scene waits for its destination, and no longer than the cap** (sprint 36 día 4, David's
 * condition 1 and adjustment 3). The browser's own `startViewTransition` awaits the update's
 * promise before capturing the new screen — so the old one stays on screen, frozen, until the
 * canvas has painted; at `SCENE_WAIT_CAP_MS` the transition is skipped and the page is shown as it
 * is. Modelled here with a transition that records when its update settled and whether it was
 * skipped.
 */
describe("a scene waiting for its destination", () => {
  function sceneTransitions() {
    const calls: { settledAt: number | null; skipped: boolean; finish: () => void }[] = [];
    loose().startViewTransition = (update: () => Promise<void> | void) => {
      const entry = { settledAt: null as number | null, skipped: false, finish: () => {} };
      const started = Date.now();
      calls.push(entry);
      const finished = new Promise<void>((resolve) => {
        entry.finish = resolve;
      });
      const updateCallbackDone = Promise.resolve(update()).then(() => {
        entry.settledAt = Date.now() - started;
      });
      return {
        finished,
        ready: Promise.resolve(),
        updateCallbackDone,
        skipTransition: () => {
          entry.skipped = true;
        },
      };
    };
    return calls;
  }

  it("captures the new screen only once the destination says it has painted", async () => {
    const calls = sceneTransitions();
    let painted = () => {};
    const destination = new Promise<void>((resolve) => {
      painted = resolve;
    });
    transitionScreen(() => {}, {
      direction: "forward",
      scene: "canvas",
      settled: () => destination,
    });
    expect(document.documentElement.getAttribute(SCENE_ATTRIBUTE)).toBe("canvas");
    await Promise.resolve();
    await Promise.resolve();
    expect(calls[0]?.settledAt, "the update settled before the destination painted").toBeNull();
    painted();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls[0]?.settledAt).not.toBeNull();
    expect(calls[0]?.skipped).toBe(false);
    calls[0]?.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(SCENE_ATTRIBUTE)).toBe(false);
  });

  it(`skips the scene at ${SCENE_WAIT_CAP_MS} ms when the destination is still not painted`, async () => {
    vi.useFakeTimers();
    const calls = sceneTransitions();
    transitionScreen(() => {}, {
      direction: "forward",
      scene: "canvas",
      settled: () => new Promise(() => {}),
    });
    await vi.advanceTimersByTimeAsync(SCENE_WAIT_CAP_MS - 1);
    expect(calls[0]?.skipped, "skipped before the cap").toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls[0]?.skipped, "the page stayed frozen past the cap").toBe(true);
    expect(calls[0]?.settledAt).not.toBeNull();
  });

  it("caps at half a second, which is a transition and not a hang", () => {
    expect(SCENE_WAIT_CAP_MS).toBe(500);
  });
});
