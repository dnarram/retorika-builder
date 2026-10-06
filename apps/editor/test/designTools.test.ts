import { readFileSync } from "node:fs";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { invariantTestName, type RetorikaDocument } from "@retorika/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, loadSession, saveSession } from "../src/editor/autosave.ts";
import {
  designToolsFor,
  loadDesignTools,
  MIN_STUDIO_WIDTH,
  saveDesignTools,
  switchNotice,
} from "../src/editor/designTools.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * The design-tools switch (ADR 0025, advanced dossier §4) — and `INV_4`, which has waited since
 * phase 0 for a switch to exist.
 *
 * `docs/document-rules.md` admitted the gap in writing: «The design-tools switch does not exist
 * yet. The only thing genuinely verified today is that the schema rejects a `designTools` key.» The
 * invariant the dossier actually asks for is stronger — «Accionar el interruptor cien veces debe
 * dejar el documento byte a byte idéntico» — and from this sprint on it can be run against the real
 * thing rather than a local boolean.
 */

const ANSWERS = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas", "Cenas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

function documents(): RetorikaDocument[] {
  return generateVariants(ANSWERS).map((site) => site.document);
}

/** A real Storage, in memory, that throws only when told to — the same one `autosave.test.ts`
 * uses, because both modules are being exercised against one browser here. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  denied = false;

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    if (this.denied) throw new DOMException("access denied", "SecurityError");
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    if (this.denied) throw new DOMException("access denied", "SecurityError");
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.denied) throw new DOMException("access denied", "SecurityError");
    this.store.set(key, value);
  }
  /** Every key this browser holds, which is how `INV_4` is checked: not "is the document equal",
   * but "did anything at all about the stored site change". */
  snapshot(): string {
    return JSON.stringify([...this.store.entries()].sort());
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("remembering the switch", () => {
  it("is off on a first visit", () => {
    expect(loadDesignTools()).toBe(false);
  });

  it("remembers being turned on, and being turned off again", () => {
    expect(saveDesignTools(true)).toBe(true);
    expect(loadDesignTools()).toBe(true);
    expect(saveDesignTools(false)).toBe(true);
    expect(loadDesignTools()).toBe(false);
  });

  it("turning it off leaves no key behind", () => {
    saveDesignTools(true);
    saveDesignTools(false);
    expect(storage.length).toBe(0);
  });

  it("is off for anything that is not the value it wrote", () => {
    storage.setItem("retorika.designTools.v1", "true");
    expect(loadDesignTools()).toBe(false);
  });

  it("is off, and says so, when the browser refuses storage", () => {
    // A private window, or blocked site data. `false` from `saveDesignTools` is the same contract
    // `saveSession` has: the caller can tell "off" from "we could not remember".
    storage.denied = true;
    expect(loadDesignTools()).toBe(false);
    expect(saveDesignTools(true)).toBe(false);
  });
});

describe("the small-screen safeguard", () => {
  it("is not offered below the studio width, which is not the same as being off", () => {
    // `undefined` rather than `false`, because the two draw different screens: off is a switch
    // somebody can press, not offered is nothing at all (ADR 0025 §5).
    expect(designToolsFor(true, MIN_STUDIO_WIDTH - 1)).toBeUndefined();
    expect(designToolsFor(false, MIN_STUDIO_WIDTH - 1)).toBeUndefined();
    expect(designToolsFor(true, MIN_STUDIO_WIDTH)).toBe(true);
  });

  it("off is off, and offered, at a width that fits", () => {
    expect(designToolsFor(false, 1920)).toBe(false);
  });

  it("does not forget the preference because a window got narrow", () => {
    // Nobody changed their mind by resizing a window. The stored value is untouched, so widening
    // it again brings the tools back exactly as they were.
    saveDesignTools(true);
    expect(designToolsFor(loadDesignTools(), 800)).toBeUndefined();
    expect(loadDesignTools()).toBe(true);
    expect(designToolsFor(loadDesignTools(), 1440)).toBe(true);
  });
});

describe("the switch is a property of the person, never of the site", () => {
  /**
   * The invariant has two halves and they can only be proven in two places.
   *
   * `packages/renderer/test/invariants.test.ts` holds the other one — that the document has nowhere
   * to store a `designTools` key, checked against all thirteen fixtures — and it stays there,
   * because that is where the corpus is and a package may not import an app. The half below needs
   * the real switch, which lives here. Both register under the same canonical name, so
   * `pnpm test:invariants` runs both and neither can be quietly dropped.
   */
  it(invariantTestName("INV_4"), () => {
    // The dossier §4 callout, run at last: «Si encender las herramientas escribe algo en el
    // proyecto, hemos reconstruido el problema de Wix.» Byte for byte, and on the *stored* site
    // rather than on a document in memory — writing is the thing being ruled out.
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 });
    const before = storage.getItem("retorika.session.v1");

    for (let flip = 0; flip < 100; flip += 1) saveDesignTools(flip % 2 === 0);

    expect(storage.getItem("retorika.session.v1")).toBe(before);
    expect(loadSession()?.documents).toEqual(documents());
  });

  it("writes nothing into the session's key, on or off", () => {
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 });
    saveDesignTools(true);
    expect(storage.getItem("retorika.session.v1")).not.toContain("designTools");
  });

  it("uses a key of its own, and the session's own keys are untouched by it", () => {
    saveDesignTools(true);
    expect(loadSession()).toBeUndefined();
    expect([...Array(storage.length).keys()].map((i) => storage.key(i))).toEqual([
      "retorika.designTools.v1",
    ]);
  });

  it("survives «Volver a empezar», because restarting a site does not change who is looking", () => {
    // The reason this is not a field of `StoredSession`. Throwing away the draft is a decision
    // about the site; being a professional who lays out pages by hand is not.
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 });
    saveDesignTools(true);
    clearSession();
    expect(loadSession()).toBeUndefined();
    expect(loadDesignTools()).toBe(true);
  });

  it("and the session survives the switch being cleared", () => {
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 });
    saveDesignTools(true);
    const before = storage.snapshot();
    saveDesignTools(false);
    saveDesignTools(true);
    expect(storage.snapshot()).toBe(before);
    expect(loadSession()?.openIndex).toBe(0);
  });
});

describe("the module cannot reach a document, by construction", () => {
  const source = readFileSync(new URL("../src/editor/designTools.ts", import.meta.url), "utf8");

  it("imports nothing at all", () => {
    // The mistake this guards against is somebody later finding it convenient to remember the
    // switch alongside the site. There is no import to make that easy, and `INV_4` stays true
    // because the module has no way to reach a document even by accident.
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("names the session's key nowhere", () => {
    expect(source).not.toContain("retorika.session");
  });
});

describe("what the switch is allowed to say when a write is refused", () => {
  /**
   * **The defect this exists for, in one line: the account's failure drew the browser's words.**
   *
   * The preference is written twice — to this browser, and to the account when somebody is signed
   * in — and a single `toolsRemembered` boolean carried both results. Every sentence that boolean
   * drew names the browser: «este navegador no nos deja guardar la preferencia», «la próxima vez
   * que entres estarán apagadas». So when it was the account write that failed, the editor said
   * both of those while `localStorage` had just accepted the value and the next visit would have
   * had the tools on.
   *
   * Direction asked «¿por qué aparece "No se recordará"?» on 6 October 2026, and the honest answer
   * was that the editor could not tell them, because it had not kept the difference.
   *
   * The production case that reaches it: a browser still holding a Supabase session, against an
   * `accounts` table with no row for that user — which is what production is until migration
   * `0002` is applied. `saveAccountDesignTools` is deliberate about that («an `update` that matches
   * no row is answered by PostgREST with a 204 and no error»), so it correctly returns `false`, and
   * everything after it was what went wrong.
   */
  it("says nothing when both writes landed", () => {
    expect(switchNotice(false, false)).toBe("none");
  });

  it("names the browser when the browser refused", () => {
    expect(switchNotice(true, false)).toBe("browser");
  });

  it("names the account — and not the browser — when only the account refused", () => {
    // The whole bug, as one assertion: this used to be indistinguishable from the line above.
    expect(switchNotice(false, true)).toBe("account");
  });

  it("names the browser when both refused, because that is the one that costs the next visit", () => {
    expect(switchNotice(true, true)).toBe("browser");
  });

  /**
   * The two sentences have to differ, and in the way that matters: the account's must not blame the
   * browser. A copy change that made them agree again would put the defect back with the logic
   * still correct, which is the kind of regression no amount of state-machine testing would catch.
   */
  it("gives the account case its own words, which do not claim the browser forgot", () => {
    const browser = es["editor.designTools.notRememberedHelp"];
    const account = es["editor.designTools.notInAccountHelp"];
    expect(account).not.toBe(browser);
    expect(browser, "the browser's sentence should name the browser").toContain("este navegador");
    expect(account, "the account's sentence should name the account").toContain("cuenta");
    expect(
      account,
      "the account's sentence must not say the preference was lost here — it was not",
    ).not.toContain("no nos deja guardar");
  });
});
