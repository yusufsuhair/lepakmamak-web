# Current development baseline

Production is at `c48fcc1`: the original map plus live KL regional weather/time, account-only entry and server-authorized Game Master room weather controls. Deployed with explicit user approval on 2026-09-09 to Railway, lepakmamak.my and both Pages domains.

The complete new KLCC map, teleport and associated work is preserved on `archive/klcc-map-rebuild` (tip `30f4e4e`). The user requested returning main to the original map on 2026-09-09.

Main develops the original map. The archived KLCC rebuild remains off production; do not redeploy it without an explicit request.

Run `node scripts/dev-server.mjs` for the authenticated local backend on 8120, and Vite on 5174. Ignored `.env.development.local` connects the frontend to this backend using the public Supabase settings. No production server keys are loaded.
