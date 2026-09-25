import { render } from "@retorika/renderer";
import type { ContentElement, Page, RetorikaDocument } from "@retorika/schema";
import type { SiteManifest } from "./manifest.ts";
import { buildRobotsTxt, buildSitemapXml } from "./metafiles.ts";

export interface SiteFile {
  /** Relative, forward slashes, never leading "/" and never containing "..". */
  path: string;
  contents: Uint8Array;
  contentType: string;
}

export interface BuildSiteOptions {
  siteId: string;
  /**
   * Absolute origin the site will be served from, e.g. "https://lua.retorika.app".
   * Omitted for a download: a ZIP has no URL, and sitemap.xml is then not emitted.
   */
  baseUrl?: string;
  /**
   * Asset bytes, keyed by the src exactly as it appears in the document.
   * Resolution is the caller's job, so buildSite stays synchronous and pure.
   */
  assets: ReadonlyMap<string, Uint8Array>;
}

export interface SiteBundle {
  /** The website. This, and only this, is what the client's ZIP contains. */
  files: SiteFile[];
  /** Metadata for serve. A sibling field, never an entry in files. */
  manifest: SiteManifest;
}

const ENTRY = "index.html";

/**
 * The schema only asks for a non-empty slug. A slug becomes a file name here, so this is
 * where it has to be one that works on every file system and needs no escaping in a link.
 */
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** One path segment: ASCII, no leading dot (so neither ".." nor a hidden file). */
const SAFE_SEGMENT = "[A-Za-z0-9_-][A-Za-z0-9._-]*";
const SAFE_ASSET_NAME = new RegExp(`^${SAFE_SEGMENT}$`);
const SAFE_PATH = new RegExp(`^${SAFE_SEGMENT}(/${SAFE_SEGMENT})*$`);

const ASSET_TYPES: Readonly<Record<string, string>> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * Relative, forward slashes, ASCII, no leading "/" and no "..": a path that means the same
 * thing inside a ZIP, on any disk it is extracted to, and in a bucket.
 */
export function assertSafePath(path: string): void {
  if (!SAFE_PATH.test(path)) throw new Error(`unsafe path "${path}" in site bundle`);
}

function pagePaths(doc: RetorikaDocument): { page: Page; path: string }[] {
  const seen = new Set<string>();
  return doc.pages.map((page, i) => {
    if (!SAFE_SLUG.test(page.slug)) {
      throw new Error(`buildSite: unsafe slug "${page.slug}" (expected ${SAFE_SLUG.source})`);
    }
    // The first page is always the entry, whatever its slug. Any later page that would
    // land on the same file, or reuse a slug, would make a link ambiguous.
    const path = i === 0 ? ENTRY : `${page.slug}.html`;
    if (seen.has(page.slug) || (i > 0 && path === ENTRY)) {
      throw new Error(`buildSite: slug collision on "${page.slug}"`);
    }
    seen.add(page.slug);
    return { page, path };
  });
}

function assertOrigin(baseUrl: string): void {
  const problem = `buildSite: baseUrl must be an absolute origin such as "https://example.test", got "${baseUrl}"`;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(problem);
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== baseUrl) {
    throw new Error(problem);
  }
}

function assetPathFor(src: string): { path: string; contentType: string } {
  const name = src.slice(src.lastIndexOf("/") + 1);
  if (!SAFE_ASSET_NAME.test(name)) {
    throw new Error(`buildSite: unsafe asset name in src "${src}"`);
  }
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const contentType = Object.hasOwn(ASSET_TYPES, extension) ? ASSET_TYPES[extension] : undefined;
  if (contentType === undefined) {
    throw new Error(`buildSite: unsupported asset type in src "${src}"`);
  }
  return { path: `assets/${name}`, contentType };
}

/** A copy with every image src rewritten. Links are left exactly as the document has them. */
function rewriteImages(
  elements: readonly ContentElement[],
  toBundle: (src: string) => string,
): ContentElement[] {
  return elements.map((el) => {
    const copy: ContentElement = { ...el };
    if (el.value?.kind === "image") copy.value = { ...el.value, src: toBundle(el.value.src) };
    if (el.items) {
      copy.items = el.items.map((item) => ({
        ...item,
        elements: rewriteImages(item.elements, toBundle),
      }));
    }
    return copy;
  });
}

/**
 * A validated document becomes the exact set of files that constitute its website.
 *
 * Layout, decided rather than improvised: the first page is index.html, every other page is
 * <slug>.html at the root, every file-backed image is assets/<basename> — a data: URI image
 * needs no file and is left inline. Pages keep the renderer's inlined CSS, so each one is
 * self-contained and opens by double-clicking it (ADR 0001).
 *
 * Throws on a missing asset, an unknown page slug collision, or an unsafe path.
 */
export function buildSite(doc: RetorikaDocument, options: BuildSiteOptions): SiteBundle {
  const pages = pagePaths(doc);
  if (options.baseUrl !== undefined) assertOrigin(options.baseUrl);

  const assetFiles = new Map<string, SiteFile>();
  const srcByPath = new Map<string, string>();
  const toBundle = (src: string): string => {
    // A data: URI is already a complete image inline in the HTML text, not a file that
    // needs a path in the bundle — safeUrl already restricted it to data:image/* at render
    // time. Left exactly as the document has it, the same as buildSite already does for links.
    if (src.startsWith("data:")) return src;
    const { path, contentType } = assetPathFor(src);
    const previous = srcByPath.get(path);
    if (previous !== undefined) {
      if (previous !== src) {
        throw new Error(`buildSite: "${previous}" and "${src}" would share the same file name`);
      }
      return path;
    }
    const contents = options.assets.get(src);
    if (contents === undefined) throw new Error(`buildSite: missing asset for src "${src}"`);
    srcByPath.set(path, src);
    assetFiles.set(path, { path, contents, contentType });
    return path;
  };

  const encoder = new TextEncoder();
  const pageFiles = pages.map(({ page, path }): SiteFile => {
    const rewritten = {
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        content: rewriteImages(section.content, toBundle),
      })),
    };
    // The renderer draws the first page of whatever document it is given.
    const { html, assets } = render({ ...doc, pages: [rewritten] }, "html");
    for (const ref of assets) {
      if (!ref.src.startsWith("data:") && !assetFiles.has(ref.src)) {
        throw new Error(`buildSite: the page references "${ref.src}", which is not in the bundle`);
      }
    }
    return { path, contents: encoder.encode(html), contentType: "text/html; charset=utf-8" };
  });

  const manifest: SiteManifest = {
    siteId: options.siteId,
    schemaVersion: doc.schemaVersion,
    entry: ENTRY,
    pages: pages.map(({ page, path }) => ({ slug: page.slug, path, title: page.title })),
    assets: [...assetFiles.keys()].sort(),
  };

  const files: SiteFile[] = [
    ...pageFiles,
    ...assetFiles.values(),
    {
      path: "robots.txt",
      contents: encoder.encode(buildRobotsTxt(options.baseUrl)),
      contentType: "text/plain; charset=utf-8",
    },
  ];
  if (options.baseUrl !== undefined) {
    files.push({
      path: "sitemap.xml",
      contents: encoder.encode(buildSitemapXml(manifest, options.baseUrl)),
      contentType: "application/xml; charset=utf-8",
    });
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const file of files) assertSafePath(file.path);

  return { files, manifest };
}
