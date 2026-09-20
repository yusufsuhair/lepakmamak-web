import manifest from './cdn-manifest.json';

export type CdnFile = keyof typeof manifest.files;

/**
 * Heavy release assets live in R2 under content-hashed keys (scripts/cdn.mjs). A build is
 * pinned to the manifest it was compiled with, so uploading a new version of an asset never
 * changes what an already-released client fetches. The dev server serves the public/ originals.
 */
export function cdnUrl(file: CdnFile): string {
  const base = import.meta.env.VITE_CDN_BASE_URL?.trim();
  return import.meta.env.DEV || !base ? `/${file}` : `${base.replace(/\/$/, '')}/${manifest.files[file].key}`;
}
