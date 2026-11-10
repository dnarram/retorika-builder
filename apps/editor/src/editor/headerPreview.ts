/**
 * **Previsualizar al pasar, elegir al pulsar** (David's adjustment 3 on approving sprint 35; día 5).
 *
 * A segment of the «Menú» panel under the mouse shows its choice on the canvas's bar before it is
 * pressed: the attribute the renderer draws that choice by is written on the live `header.rb-header`
 * **as chrome** — never a patch, never the document, never a step of history — and put back when the
 * pointer leaves. It costs nothing because the bar is drawn by attribute and the sheet carries the
 * rules for every word whether the document has it or not (ADR 0069 §5).
 *
 * Three things keep it honest:
 *
 * - **A patch wins.** Every patch brings the bar's attributes back to the document's (ADR 0051 §2:
 *   the renderer's attributes are authoritative). If the attribute is no longer what the preview
 *   wrote when the pointer leaves, something real happened since, and nothing is put back.
 * - **Pressing keeps it.** The press writes the same word into the document; the preview is
 *   forgotten rather than put back, or leaving the segment a moment later would undo on the canvas
 *   what the document now says.
 * - **One at a time.** A second preview puts the first back before it writes.
 *
 * Only the choices an attribute draws exactly are previewed — the caller decides which (the brand
 * «en medio» on a one-line bar moves the pages' menu in the markup, which no attribute does).
 */

export interface HeaderPreview {
  attribute: string;
  /** The value to show, or `null` for the attribute's absence (a default the renderer omits). */
  value: string | null;
}

export interface HeaderPreviewer {
  show(preview: HeaderPreview): void;
  /** `"restore"` puts the bar back as it was; `"keep"` forgets the preview (the choice was pressed). */
  end(mode: "restore" | "keep"): void;
}

interface Active {
  header: Element;
  attribute: string;
  previous: string | null;
  wrote: string | null;
}

function write(element: Element, attribute: string, value: string | null): void {
  if (value === null) element.removeAttribute(attribute);
  else element.setAttribute(attribute, value);
}

/** One previewer per canvas: `documentOf` is read at every call, since the canvas's document is the
 * live one only once it is parsed. */
export function headerPreviewer(documentOf: () => Document | null | undefined): HeaderPreviewer {
  let active: Active | null = null;
  const end = (mode: "restore" | "keep") => {
    const was = active;
    active = null;
    if (!was || mode === "keep" || !was.header.isConnected) return;
    if (was.header.getAttribute(was.attribute) !== was.wrote) return;
    write(was.header, was.attribute, was.previous);
  };
  return {
    show(preview) {
      end("restore");
      const header = documentOf()?.querySelector("header.rb-header");
      if (!header) return;
      active = {
        header,
        attribute: preview.attribute,
        previous: header.getAttribute(preview.attribute),
        wrote: preview.value,
      };
      write(header, preview.attribute, preview.value);
    },
    end,
  };
}
