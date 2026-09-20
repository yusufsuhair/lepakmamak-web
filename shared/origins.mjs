// An explicit allowlist replaces local defaults; never accept wildcard origins.
export const origins = new Set((process.env.ALLOWED_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:5191,capacitor://localhost,https://localhost'
).split(',').map(value => value.trim()).filter(Boolean));
for (const origin of origins) {
  const url = new URL(origin);
  if (!['http:', 'https:', 'capacitor:'].includes(url.protocol) || url.username || url.password
    || url.hostname.includes('*') || (url.protocol === 'capacitor:' ? origin !== 'capacitor://localhost' : url.origin !== origin)) {
    throw new Error('ALLOWED_ORIGINS must contain exact origins without paths or wildcards.');
  }
}
