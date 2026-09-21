import { escapeHtml } from "@retorika/renderer";
import type { SiteManifest } from "./manifest.ts";

/**
 * Always emitted. It names the sitemap only when there is a real origin to name it at: a
 * download has no URL, and a relative Sitemap line is ignored by every crawler.
 */
export function buildRobotsTxt(baseUrl: string | undefined): string {
  const lines = ["User-agent: *", "Allow: /"];
  if (baseUrl !== undefined) lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/**
 * Only ever called with a real origin. A sitemap of placeholder or relative URLs is worse
 * than none: it is a file that looks correct and is not.
 *
 * Each <loc> names the file itself, the same way the pages link to each other, so it holds
 * whatever serve later decides to do with extensionless URLs.
 */
export function buildSitemapXml(manifest: SiteManifest, baseUrl: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...manifest.pages.map(
      (page) => `  <url><loc>${escapeHtml(`${baseUrl}/${page.path}`)}</loc></url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");
}
