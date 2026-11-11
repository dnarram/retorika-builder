"use client";

import { useEffect, useRef } from "react";
import { wireRipples } from "./ripple.ts";

/**
 * **The press listener of a screen that is not the editor** (sprint 36 día 2): placed as a child of
 * a root, it wires `wireRipples` on that root's element and renders nothing visible. A component
 * rather than a hook in `questionnaire/ui.tsx`, because that module is imported by the landing's
 * server component for one function, and Next refuses a hook import in a module a server component
 * can reach — a client component imported there is fine.
 */
export function Ripples() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = mark.current?.parentElement;
    return root ? wireRipples(root) : undefined;
  }, []);
  return <span ref={mark} hidden aria-hidden="true" data-ui-ripples="" />;
}
