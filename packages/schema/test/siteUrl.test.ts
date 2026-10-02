import { describe, expect, it } from "vitest";
import { readSiteUrl, siteUrlIssue } from "../src/siteUrl.ts";

/**
 * Where the owner says their site will live (ADR 0029), and why the rule is stricter than the
 * publisher's `assertOrigin`: that one describes where a build is served from and accepts `http:`;
 * this one describes where a published site will be, and a preview card over plain http is one
 * browsers increasingly refuse.
 */
describe("siteUrlIssue — what the document may store", () => {
  it("accepts an https origin and nothing else", () => {
    expect(siteUrlIssue("https://midominio.es")).toBeUndefined();
    expect(siteUrlIssue("https://www.midominio.es")).toBeUndefined();
    expect(siteUrlIssue("https://midominio.es:8443")).toBeUndefined();
  });

  it("refuses http, and does not quietly make it https", () => {
    // Rewriting somebody's scheme is a decision about their site, not a tidy-up.
    expect(siteUrlIssue("http://midominio.es")).toBe("insecure");
  });

  it("refuses anything after the host", () => {
    expect(siteUrlIssue("https://midominio.es/")).toBe("path");
    expect(siteUrlIssue("https://midominio.es/inicio")).toBe("path");
    expect(siteUrlIssue("https://midominio.es?a=1")).toBe("path");
    expect(siteUrlIssue("https://midominio.es#top")).toBe("path");
  });

  it("refuses what is not an address at all", () => {
    expect(siteUrlIssue("midominio.es")).toBe("malformed");
    expect(siteUrlIssue("")).toBe("malformed");
    expect(siteUrlIssue("ftp://midominio.es")).toBe("malformed");
  });
});

describe("readSiteUrl — what somebody typed", () => {
  it("is empty for an empty box, which is a perfectly good answer", () => {
    expect(readSiteUrl("")).toEqual({ kind: "empty" });
    expect(readSiteUrl("   ")).toEqual({ kind: "empty" });
  });

  it("completes a bare host, because that is what a person writes", () => {
    expect(readSiteUrl("midominio.es")).toEqual({ kind: "ok", url: "https://midominio.es" });
    expect(readSiteUrl("www.midominio.es")).toEqual({
      kind: "ok",
      url: "https://www.midominio.es",
    });
  });

  it("drops a trailing slash rather than refusing it", () => {
    // The same place, and people type it. A path is not the same place, and is refused below.
    expect(readSiteUrl("midominio.es/")).toEqual({ kind: "ok", url: "https://midominio.es" });
    expect(readSiteUrl("https://midominio.es/")).toEqual({
      kind: "ok",
      url: "https://midominio.es",
    });
  });

  it("keeps an https address the owner typed in full", () => {
    expect(readSiteUrl("https://midominio.es")).toEqual({
      kind: "ok",
      url: "https://midominio.es",
    });
  });

  it("reports http rather than upgrading it", () => {
    expect(readSiteUrl("http://midominio.es")).toEqual({ kind: "issue", issue: "insecure" });
  });

  it("reports a path", () => {
    expect(readSiteUrl("midominio.es/inicio")).toEqual({ kind: "issue", issue: "path" });
    expect(readSiteUrl("https://midominio.es/inicio")).toEqual({ kind: "issue", issue: "path" });
  });

  it("reports something that is not an address", () => {
    expect(readSiteUrl("no es una web")).toEqual({ kind: "issue", issue: "malformed" });
  });

  it("trims, because a pasted address carries its spaces", () => {
    expect(readSiteUrl("  midominio.es  ")).toEqual({ kind: "ok", url: "https://midominio.es" });
  });

  it("produces only values the schema accepts", () => {
    // The contract between the two halves: anything `readSiteUrl` calls ok, `siteUrlIssue` lets
    // through. A gap here is a box that reports success and then fails to save.
    for (const typed of [
      "midominio.es",
      "www.midominio.es/",
      "https://midominio.es",
      "  MiDominio.es ",
      "https://sub.midominio.es:8443/",
    ]) {
      const reading = readSiteUrl(typed);
      expect(reading.kind, typed).toBe("ok");
      if (reading.kind === "ok") expect(siteUrlIssue(reading.url), typed).toBeUndefined();
    }
  });
});
