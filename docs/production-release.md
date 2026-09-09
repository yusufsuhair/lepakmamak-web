# Current development baseline

Production is at `e9ced2c`: the original map, live weather and GM controls, restored Claude HUD and Wall features, mosque seating and location swap, map teleporting, overhead voice controls, automatic speaker activation with microphone, and the standalone equipment Inventory. Deployed with explicit user approval on 2026-09-09 to Railway, lepakmamak.my and both Pages domains.

Railway deployment: `55c2b75e-6a67-4ea6-b529-55dad8873e62` (SUCCESS). All three frontend domains serve `assets/index-CMypOp87.js`. Production build and 17 focused tests passed; all local Supabase migrations are applied remotely.

Configuration outstanding: Railway has no `OPENAI_API_KEY`. The restored Wall image moderation deliberately fails closed, so photo uploads remain blocked until this server-side key is configured.

The complete new KLCC map, teleport and associated work is preserved on `archive/klcc-map-rebuild` (tip `30f4e4e`). The user requested returning main to the original map on 2026-09-09.

Main develops the original map. The archived KLCC rebuild remains off production; do not redeploy it without an explicit request.

Run `node scripts/dev-server.mjs` for the authenticated local backend on 8120, and Vite on 5174. Ignored `.env.development.local` connects the frontend to this backend using the public Supabase settings. No production server keys are loaded.
