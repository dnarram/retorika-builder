import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import type { RetorikaDocument } from "@retorika/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, loadSession, saveSession } from "../src/editor/autosave.ts";

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

/** A minimal, real Storage: in-memory, throws like the real thing only when told to. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  quotaExceeded = false;

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.quotaExceeded) throw new DOMException("quota exceeded", "QuotaExceededError");
    this.store.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("saveSession / loadSession", () => {
  it("restores exactly what was saved", () => {
    const docs = documents();
    const ok = saveSession({
      answers: ANSWERS,
      documents: docs,
      openIndex: 1,
    });
    expect(ok).toBe(true);

    const restored = loadSession();
    expect(restored?.openIndex).toBe(1);
    expect(restored?.answers.businessName).toBe("Taberna Santo Domingo");
    expect(restored?.documents).toHaveLength(3);
    expect(restored?.documents[0]?.siteName).toBe("Taberna Santo Domingo");
  });

  it("returns undefined — nothing to restore — when nothing was ever saved", () => {
    expect(loadSession()).toBeUndefined();
  });

  it("restores openIndex: null exactly, for the grid rather than an open card", () => {
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: null });
    expect(loadSession()?.openIndex).toBeNull();
  });
});

describe("a corrupted or foreign payload", () => {
  it("is discarded, not thrown, on unparseable JSON", () => {
    storage.setItem("retorika.session.v1", "{not json");
    expect(loadSession()).toBeNull();
  });

  it("is discarded on a payloadVersion this build does not know", () => {
    storage.setItem(
      "retorika.session.v1",
      JSON.stringify({ payloadVersion: 99, answers: {}, documents: [{}], openIndex: null }),
    );
    expect(loadSession()).toBeNull();
  });

  it("is discarded when a document no longer validates against the schema", () => {
    storage.setItem(
      "retorika.session.v1",
      JSON.stringify({
        payloadVersion: 1,
        answers: ANSWERS,
        documents: [{ nonsense: true }],
        openIndex: null,
      }),
    );
    expect(loadSession()).toBeNull();
  });

  it("moves the raw value aside instead of leaving it for the next save to clobber", () => {
    storage.setItem("retorika.session.v1", "{not json");
    loadSession();
    expect(storage.getItem("retorika.session.v1")).toBeNull();
    expect(storage.getItem("retorika.session.v1.rejected")).toBe("{not json");
  });

  it("never throws, even when storage itself throws on read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled");
      },
    });
    expect(() => loadSession()).not.toThrow();
    expect(loadSession()).toBeUndefined();
  });
});

describe("quota exceeded", () => {
  it("saveSession reports failure rather than throwing, so the tick can say so", () => {
    storage.quotaExceeded = true;
    expect(() =>
      saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 }),
    ).not.toThrow();
    expect(saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 })).toBe(false);
  });
});

describe("clearSession", () => {
  it("removes both the session and any rejected leftover", () => {
    saveSession({ answers: ANSWERS, documents: documents(), openIndex: 0 });
    storage.setItem("retorika.session.v1.rejected", "leftover");
    clearSession();
    expect(loadSession()).toBeUndefined();
    expect(storage.getItem("retorika.session.v1.rejected")).toBeNull();
  });
});
