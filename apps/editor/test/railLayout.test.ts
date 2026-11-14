import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "../src/editor/autosave.ts";
import { loadRailLayout, railLayoutFor, saveRailLayout } from "../src/editor/railLayout.ts";

/**
 * The rail's layout (ADR 0072, sprint 37 día 2): the owner's, in this browser, and nothing to do with
 * the site — the shape of `designTools.test.ts`, of which `railLayout.ts` is a copy.
 */

/** A real Storage, in memory, that throws only when told to (the one `designTools.test.ts` uses). */
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
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("remembering the rail's layout", () => {
  it("is the fixed rail on a first visit", () => {
    expect(loadRailLayout()).toBe("fixed");
  });

  it("remembers the radial menu, and the way back to the fixed rail", () => {
    expect(saveRailLayout("radial")).toBe(true);
    expect(storage.getItem("retorika.rail.v1")).toBe("radial");
    expect(loadRailLayout()).toBe("radial");
    expect(saveRailLayout("fixed")).toBe(true);
    expect(loadRailLayout()).toBe("fixed");
  });

  it("leaves no key behind for the fixed rail", () => {
    saveRailLayout("radial");
    saveRailLayout("fixed");
    expect(storage.length).toBe(0);
  });

  it("is the fixed rail for anything that is not the value it wrote", () => {
    for (const stored of ["1", "true", "Radial", ""]) {
      storage.setItem("retorika.rail.v1", stored);
      expect(loadRailLayout(), stored).toBe("fixed");
    }
  });

  it("is the fixed rail, and says it could not remember, when the browser refuses storage", () => {
    storage.denied = true;
    expect(loadRailLayout()).toBe("fixed");
    expect(saveRailLayout("radial")).toBe(false);
  });

  it("survives «Volver a empezar», which forgets the site and not the person", () => {
    saveRailLayout("radial");
    clearSession();
    expect(loadRailLayout()).toBe("radial");
  });
});

describe("on a phone", () => {
  it("is not offered, which is not the same as being the fixed rail", () => {
    expect(railLayoutFor("radial", true)).toBeUndefined();
    expect(railLayoutFor("fixed", true)).toBeUndefined();
    expect(railLayoutFor("radial", false)).toBe("radial");
    expect(railLayoutFor("fixed", false)).toBe("fixed");
  });

  it("does not forget the choice because a window got narrow", () => {
    saveRailLayout("radial");
    expect(railLayoutFor(loadRailLayout(), true)).toBeUndefined();
    expect(railLayoutFor(loadRailLayout(), false)).toBe("radial");
  });
});

describe("the layout belongs to the person, never to the site", () => {
  it("imports nothing of the document", () => {
    // Comments stripped: the file explains why it is not a field of `StoredSession`, and a guard a
    // sentence can trip is a guard that measures prose.
    const source = readFileSync(new URL("../src/editor/railLayout.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const imports = [...source.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual([]);
    expect(source).not.toMatch(/StoredSession|saveSession/);
  });
});
