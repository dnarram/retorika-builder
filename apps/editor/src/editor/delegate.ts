/**
 * **One listener on the document, dispatched to the node it concerns** (ADR 0051 §5, David's
 * adjustment 5 to the sprint 26 plan).
 *
 * The canvas used to attach its listeners to each text, each placed element, each section, at
 * wiring time — and under `patch` a node that arrives with an edit would arrive deaf, while a node
 * that stays would keep listeners whose closures remember the document from before. Delegation
 * ends both: the document listens once per session, and the handler is handed the renderer node
 * the event concerns, found by `closest` from the target. A node inserted by a patch is heard the
 * moment it exists; nothing is wired per node but attributes.
 *
 * `focus` and `blur` do not bubble, so a caller delegating them asks for `focusin` and `focusout`,
 * which do. `pointerdown` in the capture phase is how the border zone keeps beating the click that
 * chooses, as it did when the listener sat on the section.
 */
export type DelegatedHandler<E extends Event> = (el: HTMLElement, event: E) => void;

export function delegate<K extends keyof DocumentEventMap>(
  doc: Document,
  type: K,
  selector: string,
  handler: DelegatedHandler<DocumentEventMap[K]>,
  options?: AddEventListenerOptions,
): void {
  doc.addEventListener(
    type,
    (event) => {
      const target = event.target as Node | null;
      // A text node's target is its parent; `closest` lives on elements only.
      const from =
        target?.nodeType === target?.ELEMENT_NODE ? (target as Element) : target?.parentElement;
      const el = from?.closest(selector) as HTMLElement | null | undefined;
      if (el) handler(el, event as DocumentEventMap[K]);
    },
    options,
  );
}
