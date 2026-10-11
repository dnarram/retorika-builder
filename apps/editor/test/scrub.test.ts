import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { describe, expect, it } from "vitest";
import {
  DOCUMENT_REMOVED,
  EMAIL_REMOVED,
  scrubEvent,
  URL_REMOVED,
} from "../src/observability/scrub.ts";

/**
 * What an error report may carry, proven on the things it must not.
 *
 * Each case is one of the four rules in `scrub.ts`, built from the real thing: a document the
 * generator made, an address in prose, a `data:` URL that *is* a photograph. A rule proven on a
 * toy would prove the toy.
 */

const site = generate({
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar",
  services: ["Comidas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "visit",
}).document;

describe("a document never leaves", () => {
  it("drops a whole document attached under any key, anywhere", () => {
    const event = scrubEvent({
      message: "save failed",
      extra: { payload: site, nested: { deeper: { site } } },
    });
    expect(JSON.stringify(event)).not.toContain("Taberna Santo Domingo");
    expect(event.extra?.["payload"]).toBe(DOCUMENT_REMOVED);
    expect(JSON.stringify(event)).toContain(DOCUMENT_REMOVED);
  });

  it("does not mistake an object that merely has the two keys for a document", () => {
    // Shaped like one and refused by the schema: not ours to drop on shape alone.
    const event = scrubEvent({ extra: { thing: { schemaVersion: 1, pages: "no" } } });
    expect(event.extra?.["thing"]).toEqual({ schemaVersion: 1, pages: "no" });
  });
});

describe("the keys that name personal things are removed by name", () => {
  it("removes document, doc, photo, photos, bytes and email at every depth, case-insensitively", () => {
    const event = scrubEvent({
      extra: {
        doc: { a: 1 },
        Document: "x",
        photo: new Uint8Array([1, 2, 3]),
        PHOTOS: [1],
        bytes: "abc",
        email: "a@b.es",
        keep: { email: "c@d.es", also: "kept" },
      },
    });
    expect(Object.keys(event.extra ?? {})).toEqual(["keep"]);
    expect(event.extra?.["keep"]).toEqual({ also: "kept" });
  });
});

describe("an email address is replaced wherever it appears", () => {
  it("in the message, in an exception value, in a breadcrumb and in a URL", () => {
    const event = scrubEvent({
      message: "sign-in failed for maria.lopez+web@example.com, again",
      exception: { values: [{ type: "Error", value: "user juan@dominio.es not found" }] },
      breadcrumbs: [{ message: "POST /auth?email=ana@x.org", data: { to: "p@q.com" } }],
      request: { url: "https://app.test/?u=zoe@z.io" },
    });
    const text = JSON.stringify(event);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(text.split(EMAIL_REMOVED).length - 1).toBe(5);
    // And the rest of the sentence survives: the report still says what happened.
    expect(event.message).toBe(`sign-in failed for ${EMAIL_REMOVED}, again`);
  });
});

describe("photographs by another name, and the session", () => {
  it("replaces blob: and data: URLs, which are the bytes", () => {
    const event = scrubEvent({
      extra: { src: "blob:https://app.test/abc", inline: "data:image/webp;base64,UklGRg==" },
    });
    expect(event.extra).toEqual({ src: URL_REMOVED, inline: URL_REMOVED });
  });

  it("drops the user and the request's cookies and headers whole", () => {
    const event = scrubEvent({
      user: { id: "uuid", ip_address: "1.2.3.4" },
      request: {
        url: "https://app.test/mis-webs",
        cookies: { "sb-access-token": "x" },
        headers: { cookie: "x", authorization: "Bearer y" },
        method: "GET",
      },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://app.test/mis-webs", method: "GET" });
  });
});

describe("what is not personal is left exactly as it was", () => {
  it("keeps a plain error intact, so the report is still useful", () => {
    const event = {
      message: 'section "sec-x": unknown catalog section',
      tags: { release: "abc1234", route: "/api/download" },
      extra: { status: 400, sections: 5 },
    };
    expect(scrubEvent(event)).toEqual(event);
  });

  it("does not mutate what it was given", () => {
    const original = { extra: { email: "a@b.es", keep: 1 } };
    const copy = JSON.parse(JSON.stringify(original));
    scrubEvent(original);
    expect(original).toEqual(copy);
  });

  it("survives a circular structure handed in by a library", () => {
    const loop: Record<string, unknown> = { name: "loop" };
    loop["self"] = loop;
    expect(() => scrubEvent({ extra: { loop } })).not.toThrow();
  });
});
