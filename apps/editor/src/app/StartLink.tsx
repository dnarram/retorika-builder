"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { leaveScreen } from "../editor/leaving.ts";

/**
 * **«Crear mi web», and the landing leaving before the questions arrive** (sprint 36 día 3).
 *
 * A `Link` like the one it replaces — same address, same prefetch, a modified click still opens a
 * tab — whose client navigation waits for the page to fade: `onNavigate` is only called for the
 * navigation Next would make itself (never for Ctrl/Cmd and a new tab), so cancelling it there and
 * asking for the same address once the landing has faded (`leaveScreen`) changes nothing but the
 * order. A client component of its own because the landing is a server component.
 *
 * The mark is taken off if the landing is shown again without being rebuilt — a back navigation
 * that restores the page — so it never comes back faded.
 */
export function StartLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  const link = useRef<HTMLAnchorElement>(null);
  const unmark = useRef<() => void>(() => {});
  useEffect(() => () => unmark.current(), []);
  return (
    <Link
      ref={link}
      href={href}
      className={className}
      style={style}
      onNavigate={(event) => {
        const screen = link.current?.closest("main");
        if (!screen) return;
        event.preventDefault();
        unmark.current = leaveScreen(screen, () => router.push(href));
      }}
    >
      {children}
    </Link>
  );
}
