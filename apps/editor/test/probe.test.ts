import { afterEach, describe, expect, it } from "vitest";
import { type ProbeEvent, record, serialOf } from "../src/editor/probe.ts";

/**
 * The probe records only when switched on, and the switch is the test's to flip. Run in Node,
 * where there is no `window` at all — the first case — and with a stand-in `window` for the rest.
 */
describe("the editor's probe", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("does nothing where there is no window", () => {
    expect(() => record("wire", { serial: 1 })).not.toThrow();
  });

  it("does nothing on a window that has not switched it on", () => {
    const fake: { __rbProbe?: boolean; __rb?: ProbeEvent[] } = {};
    Object.defineProperty(globalThis, "window", { value: fake, configurable: true });
    record("wire", { serial: 1 });
    expect(fake.__rb).toBeUndefined();
  });

  it("records in order, with a clock, once switched on", () => {
    const fake: { __rbProbe?: boolean; __rb?: ProbeEvent[] } = { __rbProbe: true };
    Object.defineProperty(globalThis, "window", { value: fake, configurable: true });
    record("wire", { serial: 1 });
    record("select", { sectionId: "sec-services", serial: 1 });
    expect(fake.__rb?.map((event) => event.kind)).toEqual(["wire", "select"]);
    expect(fake.__rb?.[0]?.at).toBeTypeOf("number");
    expect(fake.__rb?.[1]?.data).toEqual({ sectionId: "sec-services", serial: 1 });
  });

  it("reads a document's serial back, and null for one never wired", () => {
    const wired = { documentElement: { dataset: { rbSerial: "7" } } } as unknown as Document;
    const bare = { documentElement: { dataset: {} } } as unknown as Document;
    expect(serialOf(wired)).toBe(7);
    expect(serialOf(bare)).toBeNull();
    expect(serialOf(null)).toBeNull();
  });
});
