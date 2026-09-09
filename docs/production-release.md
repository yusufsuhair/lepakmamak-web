# Current development baseline

Production remains at `f87dda6`, the original map deployed on lepakmamak.my and both Pages domains.

The complete new KLCC map, teleport and associated work is preserved on `archive/klcc-map-rebuild` (tip `30f4e4e`). The user requested returning main to the original map on 2026-09-09.

Main now develops the original map with live regional KL weather and KL time, and registration/login required. Keep changes local until a production release is explicitly requested.

Run `node scripts/dev-server.mjs` for the authenticated local backend on 8120, and Vite on 5174. Ignored `.env.development.local` connects the frontend to this backend using the public Supabase settings. No production server keys are loaded.
