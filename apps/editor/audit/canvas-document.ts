import { render } from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";
import { CANVAS_STILLNESS } from "../src/editor/canvasStillness.ts";
import { canvasHtml } from "../src/editor/previewDocument.ts";

/**
 * The canvas's document, as the editor's frame first paints it and nothing more: the published html
 * with the canvas's own stylesheet in place of the published one and without the script
 * (`canvasHtml`), plus **the editor's chrome sheet as far as it touches the page** — the rules that
 * turn off smooth scrolling and the reveal (`CANVAS_STILLNESS`), imported from the module `Editor.tsx`
 * itself spreads into the frame, never copied (David's adjustment 4 of sprint 33). The rest of that
 * sheet draws the editor's own chrome — outlines, handles, pills — over elements the editor adds, and
 * none of it touches the header; the audit opens this document in three engines without the editor,
 * which Chromium alone can run, and compares the header it draws with the published page's.
 */
export function canvasDocument(doc: RetorikaDocument, pageId?: string): string {
  const html = canvasHtml(doc, render(doc, "html", pageId === undefined ? {} : { pageId }));
  const at = html.indexOf("</head>");
  if (at === -1) throw new Error("the canvas's document has no </head>");
  return `${html.slice(0, at)}<style>\n${CANVAS_STILLNESS.join("\n")}\n</style>\n${html.slice(at)}`;
}
