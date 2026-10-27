import { describe, expect, it } from "vitest";
import { copyrightNotice, reservedFontNames, reservesPresentedName } from "../src/licences.ts";

/**
 * The reading of a copyright notice, against the forms the surveyed licences actually use — each line
 * below is copied from a holder's `OFL.txt` as read on 27 October 2026, not composed for the test.
 */
const NOTICES = {
  libreBaskerville:
    "Copyright 2012 The Libre Baskerville Project Authors (https://github.com/impallari/Libre-Baskerville) with Reserved Font Name Libre Baskerville.",
  bitter:
    'Copyright 2011 The Bitter Project Authors (https://github.com/solmatas/BitterPro)\nwith Reserved Font Name "Bitter Pro".',
  sourceSans:
    "Copyright 2010-2020 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. All Rights Reserved. Source is a trademark of Adobe in the United States and/or other countries.",
  lexend:
    "Copyright 2018 The Lexend Project Authors (https://github.com/googlefonts/lexend), with Reserved Font Name “RevReading Lexend”.",
  ptSans:
    'Copyright (c) 2010, ParaType Ltd. (http://www.paratype.com/public),\nwith Reserved Font Names "PT Sans" and "ParaType".',
  inter: "Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)",
};

describe("copyrightNotice", () => {
  it("stops where the licence starts, because every OFL's §3 names Reserved Font Names", () => {
    const text = `${NOTICES.inter}\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\n... Reserved Font Name ...`;
    expect(copyrightNotice(text)).toBe(NOTICES.inter);
  });
});

describe("reservedFontNames", () => {
  it("reads every form the surveyed licences use", () => {
    expect(reservedFontNames(NOTICES.libreBaskerville)).toEqual(["Libre Baskerville"]);
    expect(reservedFontNames(NOTICES.bitter)).toEqual(["Bitter Pro"]);
    expect(reservedFontNames(NOTICES.sourceSans)).toEqual(["Source"]);
    expect(reservedFontNames(NOTICES.lexend)).toEqual(["RevReading Lexend"]);
    expect(reservedFontNames(NOTICES.ptSans)).toEqual(["PT Sans", "ParaType"]);
    expect(reservedFontNames("Copyright, with Reserved Font Name < Fira >.")).toEqual(["Fira"]);
    expect(reservedFontNames(NOTICES.inter)).toEqual([]);
  });
});

describe("reservesPresentedName", () => {
  it("refuses a presented name that is, or contains, a reserved one", () => {
    expect(reservesPresentedName(NOTICES.libreBaskerville, "Libre Baskerville")).toBe(true);
    expect(reservesPresentedName(NOTICES.sourceSans, "Source Sans 3")).toBe(true);
    expect(reservesPresentedName(NOTICES.sourceSans, "Source Serif 4")).toBe(true);
    expect(reservesPresentedName(NOTICES.ptSans, "PT Sans")).toBe(true);
  });

  /** David's reading, 27 October 2026: §3 restricts the reserved string, and «Bitter» is not
   * «Bitter Pro». The same reading admits «Lexend» beside «RevReading Lexend». */
  it("lets a presented name through when it only shares words with a longer reserved one", () => {
    expect(reservesPresentedName(NOTICES.bitter, "Bitter")).toBe(false);
    expect(reservesPresentedName(NOTICES.lexend, "Lexend")).toBe(false);
  });

  it("matches whole words, so a reserved «Source» does not catch «Resource Sans»", () => {
    expect(reservesPresentedName(NOTICES.sourceSans, "Resource Sans")).toBe(false);
  });

  it("finds nothing to refuse in a notice that reserves nothing", () => {
    expect(reservesPresentedName(NOTICES.inter, "Inter")).toBe(false);
  });
});
