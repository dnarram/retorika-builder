import { blankSection, TEAM_ID } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";

/**
 * What Equipo looks like once it is drawn — the half of the catalog's own tests cannot see.
 *
 * Two claims, mirroring `gallery.test.ts`: the outline stays clean (a job title is a `body`, not
 * a `heading`, so it announces nothing to a screen reader), and a photograph of a person is
 * cropped to a shape a row of faces can share.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function cover(): Section {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-cover-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Barbería El Corte" },
      },
    ],
  };
}

/** A team of `jobs.length` people, each with the job title they were given. */
function team(jobs: readonly string[]): Section {
  return {
    id: "sec-team",
    preset: { catalogId: TEAM_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-team-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Quién somos" },
      },
      {
        id: "el-members",
        role: "list",
        hidden: false,
        slot: "members",
        items: jobs.map((job, index) => ({
          id: `item-${index + 1}`,
          elements: [
            {
              id: `el-photo-${index + 1}`,
              role: "image" as const,
              hidden: false,
              slot: "photo",
              value: { kind: "image" as const, src: `assets/persona-${index + 1}.jpg`, alt: "" },
            },
            {
              id: `el-name-${index + 1}`,
              role: "heading" as const,
              hidden: false,
              slot: "name",
              value: { kind: "text" as const, text: `Persona ${index + 1}` },
            },
            {
              id: `el-job-${index + 1}`,
              role: "body" as const,
              hidden: false,
              slot: "job",
              value: { kind: "text" as const, text: job },
            },
          ],
        })),
      },
    ],
  };
}

function documentWith(section: Section): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: "Barbería El Corte", sections: [cover(), section] },
    ],
  };
}

function parse(source: string): Document {
  return new DOMParser().parseFromString(source, "text/html");
}

function draw(section: Section): Document {
  return parse(render(documentWith(section), "html").html);
}

describe("a team's cards and the page outline", () => {
  it("draws a name as a heading and a job as a paragraph, so a page of six adds one heading", () => {
    // A person's name is the card's title, exactly like a testimonial's author — the list drawing
    // is generic, so this needs no renderer change of its own for that half. The job is a `body`
    // for the same reason a gallery caption is: it heads nothing.
    const page = draw(team(["Dueña", "Fisioterapeuta"]));
    const outline = [...page.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) => el.tagName);
    expect(outline).toEqual(["H1", "H2", "H3", "H3"]);

    const jobs = [...page.querySelectorAll('[data-slot="job"]')];
    expect(jobs).toHaveLength(2);
    for (const job of jobs) expect(job.tagName).toBe("P");
  });

  it("still draws the list as a list, with one item per person", () => {
    const page = draw(team(["Uno", "Dos", "Tres"]));
    const list = page.querySelector(".rb-team .rb-list");
    expect(list?.getAttribute("role")).toBe("list");
    expect(list?.querySelectorAll("li.rb-item")).toHaveLength(3);
    expect(page.querySelectorAll(".rb-team .rb-item img")).toHaveLength(3);
  });

  it("draws one a blank section made, not only a hand-built fixture", () => {
    // The path the editor actually takes: the "Añadir sección aquí" pill calls `blankSection`.
    const page = draw(blankSection(TEAM_ID, "stacked", "sec-team"));
    const item = page.querySelector(".rb-team .rb-item");
    expect(item?.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/);
    expect(item?.querySelector("h3")?.textContent).toContain("Escribe aquí");
    expect(item?.querySelector("p")?.textContent).toContain("Escribe aquí");
  });
});

describe("how a photograph is cropped", () => {
  it("declares a square ratio for a team's photographs, different from a gallery's", () => {
    // A person's photo can arrive upright or sideways; a square treats both the same, which is
    // the point for a row of faces in a way `.rb-gallery`'s 4/3 is not — that ratio was chosen to
    // match what a phone shoots in, not to make every subject read as a headshot.
    const { css } = render(documentWith(team(["Uno"])), "html");
    expect(css).toContain(".rb-team .rb-item img { aspect-ratio: 1 / 1; object-fit: cover; }");
    expect(css).toContain(".rb-section img { width: 100%; height: auto;");
  });
});
