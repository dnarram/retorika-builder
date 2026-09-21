/**
 * What serve needs to know about a bundle, and nothing the client's download needs.
 *
 * No timestamps and no build ids: anything that changes between two builds of the same
 * document breaks INV_5, and then a golden diff can no longer tell a real change from noise.
 */
export interface SiteManifest {
  /** Stable id of the site this bundle was built from. */
  siteId: string;
  /** The schemaVersion of the source document, so a stale bundle is identifiable. */
  schemaVersion: string;
  /** The file a visitor lands on. Always "index.html". */
  entry: string;
  pages: { slug: string; path: string; title: string }[];
  /** Every asset path in the bundle, relative, e.g. "assets/photo.svg". */
  assets: string[];
}
