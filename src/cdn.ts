import manifest from './cdn-manifest.json';

export type CdnFile = keyof typeof manifest.files;

/**
 * Heavy release assets live in R2 under content-hashed keys (scripts/cdn.mjs). A build is
 * pinned to the manifest it was compiled with, so uploading a new version of an asset never
 * changes what an already-released client fetches. The dev server serves the public/ originals.
 */
export function cdnUrl(file: CdnFile): string {
  return import.meta.env.DEV ? `/${file}` : manifest.base + manifest.files[file].key;
}
