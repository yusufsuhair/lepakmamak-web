# Current development baseline

Production is at `e9ced2c`: the original map, live weather and GM controls, restored Claude HUD and Wall features, mosque seating and location swap, map teleporting, overhead voice controls, automatic speaker activation with microphone, and the standalone equipment Inventory. Deployed with explicit user approval on 2026-09-09 to Railway, lepakmamak.my and both Pages domains.

Railway deployment: `55c2b75e-6a67-4ea6-b529-55dad8873e62` (SUCCESS). All three frontend domains serve `assets/index-CMypOp87.js`. Production build and 17 focused tests passed; all local Supabase migrations are applied remotely.

Configuration outstanding: Railway has no `OPENAI_API_KEY`. Wall photos continue to post when OpenAI is unavailable; a successful explicit verdict still blocks the upload, while provider outages are treated as a temporary availability fallback.

The complete new KLCC map, teleport and associated work is preserved on `archive/klcc-map-rebuild` (tip `30f4e4e`). The user requested returning main to the original map on 2026-09-09.

Main develops the original map. The archived KLCC rebuild remains off production; do not redeploy it without an explicit request.

Run `node scripts/dev-server.mjs` for the authenticated local backend on 8120, and Vite on 5174. Ignored `.env.development.local` connects the frontend to this backend using the public Supabase settings. No production server keys are loaded.

Frontend updated to `4e888ff` on 2026-09-09: toggleable 2D/3D city overview. Production build passed; both Pages projects deployed and all three domains verified against the built JavaScript asset. This is a frontend-only release; Railway remains on `e9ced2c`.

Frontend updated to `f61a463` on 2026-09-09: active-game browser exit warnings, with disconnect deferred until actual page exit. Build and two exit tests passed; all three production domains verified. User preference: deploy completed, verified changes by default.

Frontend and Railway updated to `acb5a5a` (`v1.44.0`) on 2026-09-19, deployed at the user's explicit request with the full suite skipped at their instruction. This release carries everything on `main`, so it also ships `v1.43.0` (contact shadows, sky reflections); Railway moved from `1.41.0`.

- One-tap guest entry is ON in production: `ALLOW_GUESTS=true` on the Railway production service (set with `--skip-deploys`, then deployed) and `VITE_ALLOW_GUESTS=true` in `.env.production`. To turn it off, unset both and redeploy the frontend first, then Railway. `GUEST_SEATS` is unset, so guests may hold 60 of 100 places per room.
- Migration `20260918000000_funnel_events.sql` applied with `supabase db push`; remote history matches local. `funnel_events` has RLS on and is unreadable to `anon` and `authenticated`. The privacy policy describing the counting went out in the same frontend deploy (page dated 18 September 2026).
- Railway deployment `46012865-0ac1-491a-94d6-2f021e427d33`; `/health` reports `1.44.0`. lepakmamak.my and lepakmamak.pages.dev both serve `assets/index-B8YXUT2E.js`.
- Gate: typecheck, production build, 38 focused tests on the merged code, and a production-mode build driven end to end against a local server in public-city shape. Then on production itself: over a real socket a typed guest name and a join with no credentials are refused, a menu name is welcomed beside Meja 1, and guest chat is refused without being broadcast; in headless Chrome at 390 px a new visitor reached CITY ONLINE 1.6 s after one tap with no sign-up wall, and `page_load`, `play_tapped` and `entered_city` landed in `funnel_events`. Those three rows, one device, are that verification visit.
- Known and not addressed here: `tests/uno.spec.ts:17` fails identically before this release (the docked chat toggle overflows the table dialog at 390 px); it has its own task.

Frontend updated to `1991e1b` on 2026-09-19, deployed at the user's explicit request: the docked city chat's hide tab stays inside the table dialog (it made the dialog scroll sideways at every width), and a hidden docked chat collapses to the tab's row instead of holding a blank band, which is the default state on phones. Frontend-only with no version bump; Railway stays on `acb5a5a` (`1.44.0`). This closes the `tests/uno.spec.ts:17` item above.

- Gate: typecheck and production build inside `npm run deploy`, and 39 focused tests (uno, chat-layers, chat-modal-layers, chat-fullscreen-mobile, casual-games-ui, chat-in-game, chat-collapse, table-social) on the code rebased onto `2ae58ef`. The full suite was not run.
- Pages deployment `b066cf35`. lepakmamak.my and lepakmamak.pages.dev both serve `assets/index-IHtC8Ueo.js` and `assets/index-CX--r7TS.css`, and the served stylesheet carries the three new `#table-social #city-chat` rules.
- Not done: the dialog was not opened on production itself, because that takes a seat in the live city and writes funnel rows. The layout was measured at 390 px and 1280 px against the dev server only.
