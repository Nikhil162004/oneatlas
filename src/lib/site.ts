/** The canonical origin of the deployed product. Sitemap entries, robots and the raw-document
 * links are built from it rather than from whichever host served the page, because those
 * artefacts are the one deployed product wherever they are read. SITE_URL overrides it for a
 * different deployment; robots.ts keeps its own copy from before this module
 * existed, with the same default (layout.tsx holds one too). */
export const SITE_URL = process.env.SITE_URL ?? 'https://oneatlas-smoky.vercel.app';
