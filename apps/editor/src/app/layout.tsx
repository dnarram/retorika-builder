import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted at build time: the interface loads a font the way an application does, and a
// published site never depends on one being fetched (ADR 0001, ADR 0015).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/**
 * `noindex` covers the application, never the sites it generates.
 *
 * The deployment URL is public and unauthenticated, and for now it shows a product that is
 * half built with Retorika's name on it. A client's published site is the opposite case: being
 * found is the whole point of it, and its HTML is written by `packages/renderer`, which never
 * sees this file.
 */
export const metadata: Metadata = {
  title: "Retorika Builder",
  description: "Tu web en cinco preguntas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
