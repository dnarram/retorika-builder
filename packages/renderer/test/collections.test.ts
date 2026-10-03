import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * «El contenido reutilizable», resolved at render time (ADR 0033).
 *
 * The claim this file exists to hold: **a published page does not know a collection existed.** The
 * resolution happens here, when the page is drawn, so what ships is the same static HTML and CSS it
 * always was — which is how this stays inside ADR 0001 rather than beside it.
 */

const doc = () =>
  parseDocument(
    JSON.parse(readFileSync(join(DOCUMENTS_DIR, "contenido-reutilizable.json"), "utf8")),
  );

describe("a bound list draws one card per entry", () => {
  it("draws three cards from one stored template item", () => {
    const { html } = render(doc(), "html");
    // The template is one item; the collection has three entries; both bound sections show three.
    expect([...html.matchAll(/<li class="rb-item"/g)]).toHaveLength(6);
    for (const name of ["Chapa y pintura", "Mecánica general", "Neumáticos"]) {
      expect(html, name).toContain(name);
    }
    // And the template's own placeholder words are nowhere: the entries replaced them.
    expect(html).not.toContain("Nombre del servicio");
    expect(html).not.toContain("En qué consiste");
  });

  it("draws entries in stored order, which is the only order there is", () => {
    const { html } = render(doc(), "html");
    const order = [...html.matchAll(/(Chapa y pintura|Mecánica general|Neumáticos)/g)].map(
      (match) => match[1],
    );
    // Twice through, because two sections show the same collection.
    expect(order).toEqual([
      "Chapa y pintura",
      "Mecánica general",
      "Neumáticos",
      "Chapa y pintura",
      "Mecánica general",
      "Neumáticos",
    ]);
  });

  it("is a pure function of the document, which the golden corpus and INV_5 rest on", () => {
    expect(render(doc(), "html").html).toBe(render(doc(), "html").html);
  });

  it("splits a bound text's marks through the one path every other text takes", () => {
    // ADR 0027's property: exactly one place in this product cuts a string into pieces. A second
    // resolution path for bound text would have bought a second one.
    const { html } = render(doc(), "html");
    expect(html).toContain("<strong>Presupuesto cerrado</strong> en 24 horas");
    expect(html).toContain("Montaje y equilibrado <em>el mismo día</em>.");
  });

  it("changes every card that shows it when one entry changes, which is the whole feature", () => {
    // §7: «La plantilla de la ficha se diseña una vez y cambiarla cambia las cuarenta páginas.»
    const base = doc();
    const edited = parseDocument({
      ...base,
      collections: base.collections.map((collection) => ({
        ...collection,
        entries: collection.entries.map((entry) =>
          entry.id === "entry-chapa"
            ? { ...entry, fields: { ...entry.fields, nombre: { text: "Chapa, pintura y pulido" } } }
            : entry,
        ),
      })),
    });
    const { html } = render(edited, "html");
    // One edit, both sections.
    expect([...html.matchAll(/Chapa, pintura y pulido/g)]).toHaveLength(2);
    expect(html).not.toContain("Chapa y pintura<");
  });
});

describe("what the published page does not carry", () => {
  it("names no collection, no entry and no hint", () => {
    const { html, css } = render(doc(), "html");
    const published = `${html}\n${css}`;
    for (const trace of [
      "col-servicios", // the collection's id
      "Servicios", // its name — the owner's word for the list, not for anything on the page
      "entry-chapa",
      "entry-mecanica",
      "entry-neumaticos",
      "data-entry",
      "item-plantilla", // the template item's id: there is no item, so there is no `data-item`
    ]) {
      expect(published, `a published page carries "${trace}"`).not.toContain(trace);
    }
  });

  it("gives a bound card no data-item, because it has no identity in the document", () => {
    const { html } = render(doc(), "html");
    // The honest answer rather than a synthetic one. An unbound list still has them, which the rest
    // of the corpus proves — `opiniones` renders `data-item="item-1"`.
    expect(html).not.toMatch(/<li class="rb-item" data-item=/);
    const unbound = readFileSync(join(DOCUMENTS_DIR, "..", "golden", "opiniones.html"), "utf8");
    expect(unbound).toContain('data-item="item-1"');
  });
});

describe("the entry hint the editor asks for", () => {
  it("is off unless asked for, and says which entry each card is when it is", () => {
    expect(render(doc(), "html").html).not.toContain("data-entry");
    const { html } = render(doc(), "html", { entryHints: true });
    expect(html).toContain('data-entry="entry-chapa"');
    expect(html).toContain('data-entry="entry-mecanica"');
    expect(html).toContain('data-entry="entry-neumaticos"');
    // Twice each: two sections draw the same three entries.
    expect([...html.matchAll(/data-entry="entry-chapa"/g)]).toHaveLength(2);
  });

  it("changes nothing else about the page", () => {
    // The hint is an attribute, not a different rendering. Anything else and the editor would be
    // previewing a page the ZIP does not contain — which is the defect day 2 just closed for fonts.
    const plain = render(doc(), "html").html;
    const hinted = render(doc(), "html", { entryHints: true }).html;
    expect(hinted.replace(/ data-entry="[^"]*"/g, "")).toBe(plain);
  });

  it("is the only way to tell card three from card one, which is why it exists", () => {
    // Every card shares the template's `data-id`, because there is one template. That is ADR 0033
    // §2 showing through the output, and the reason §10 exists at all.
    const { html } = render(doc(), "html");
    expect([...html.matchAll(/data-id="el-card-title"/g)]).toHaveLength(3);
  });
});

describe("a binding the renderer cannot resolve", () => {
  it("throws rather than publishing an empty box", () => {
    // The style guide's rule: «an unknown section or variant throws rather than rendering an empty
    // box, because the empty box gets published». `checkInvariants` refuses this document, so
    // reaching the throw means something got past the parser — which is what a cast is here for.
    const base = doc();
    const orphaned = { ...base, collections: [] };
    expect(() => render(orphaned as typeof base, "html")).toThrow(
      /bound to collection "col-servicios", which this document does not carry/,
    );
  });

  it("throws when an entry has no field the template draws", () => {
    const base = doc();
    const ragged = {
      ...base,
      collections: base.collections.map((collection) => ({
        ...collection,
        entries: collection.entries.map((entry) =>
          entry.id === "entry-mecanica" ? { ...entry, fields: {} } : entry,
        ),
      })),
    };
    expect(() => render(ragged as typeof base, "html")).toThrow(
      /Entry "entry-mecanica" has no field "nombre"/,
    );
  });
});
