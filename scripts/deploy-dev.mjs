// Backwards-compatible entry point.
process.argv.push('--dev');
await import('./deploy-pages.mjs');
