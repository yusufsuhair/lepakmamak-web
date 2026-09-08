# LepakMamak performance review — 8 September 2026

## Findings and changes

1. Every 20 Hz movement message previously broadcast the full room to every connection. A local 12-player moving load produced 232 snapshots/s and 1,330 KB/s per receiving client. Room snapshots are now coalesced on a 50 ms tick: the same load produced 20 snapshots/s and 113 KB/s (about 92% less). Chair claims, chat and other discrete actions still respond immediately. Slow sockets skip stale movement snapshots instead of accumulating them; stationary clients send a heartbeat at most twice per second.
2. The live Railway origin reported `railway/us-west2`. Deployment configuration now selects one Singapore replica. Verify the live `X-Railway-Upstream-Zone` header after deployment. Do not add replicas yet: rooms, chair ownership and account-session enforcement are process-local and would split across instances.
3. Starting-view desktop Chrome measured 1,217 draw calls and 123,436 triangles/frame with shadows, versus 440 calls and 52,406 triangles with shadows off, before distance culling. Desktop frame timing here was approximately 16.7 ms median and 16.8 ms p95: this powerful machine is not evidence of acceptable phone performance.
4. Graphics Auto now starts touch devices at pixel ratio 1 with shadows off. Smooth applies that profile manually; Detailed restores shadows and up to 1.6 pixel ratio. Desktop Auto reduces quality after sustained slow frames. Far ambient traffic/pedestrians stop rendering while their simulation continues. Quality choice persists. Phone-viewport Chrome measured 153 draw calls in the starting view after these changes; do not compare its FPS or call count directly with the wider desktop view.
5. Repeated network-status DOM updates are avoided when status/count do not change. Simulation, proximity voice, occupancy and settings continue operating.

## Next architecture work, in order

- Collect actual device measurements: rolling FPS/frame-time percentiles, WebSocket ping/jitter, room occupancy, server event-loop delay and queued bytes. Measure 15-minute thermal behavior on an entry-level Android and an iPhone, with 12 and 24 players and several active speakers. Test crowded Mamak, driving, expanded map and app background/foreground transitions. No production user telemetry was added in this change.
- Replace raw PCM/base64 voice over the gameplay WebSocket with WebRTC Opus and an SFU. Current audio alone is 1,280 raw bytes every 40 ms: 32 KB/s before base64/JSON, around 43 KB/s per active speaker. TCP loss delays later gameplay/audio data. WebRTC supports Opus and is designed for realtime media. Keep authorization and 15 m subscription enforcement on the server; client volume muting alone is insufficient for privacy. Select infrastructure only after a measured multi-speaker pilot.
- Separate infrequent profile/appearance data from movement packets; send compact movement deltas with sequence numbers. Current full snapshots are acceptable for a first correction but still repeat profile data. Preserve reliable full state on join/reconnect and server authorization for chairs and vehicle passengers.
- Introduce spatial batches and lower-detail distant models, then profile the result. Current static meshes are grouped globally by material, which limits useful spatial culling. Avoid blindly increasing draw calls with tiny chunks. Distant ambient actors are now culled; player-specific level of detail remains future work.
- Scale through explicit room ownership/routing with a shared account-session registry. Only then add instances. Redis can help coordinate room ownership and presence, but should not replace the authoritative simulation loop or put position writes in Postgres.

## Keep the existing foundation

Cloudflare Pages remains suitable for cached frontend assets. Three.js remains suitable for rendering this game. Supabase should retain authentication and durable profiles/purchases, not receive high-frequency movement writes. Railway can retain the authoritative room server, placed near the audience. A rewrite or a larger database is not supported by the evidence from this audit.

## Reproduce

- `node scripts/benchmark-network.mjs`: 12 local moving clients over three seconds, JSON payload bytes per receiver; excludes TLS/WebSocket framing, voice, Internet latency and production infrastructure.
- `npm test`: functional and server regression tests.
- `npx playwright test --config playwright.compat.config.ts`: Chrome, Firefox and WebKit layout checks.

## References

- Railway region identifiers: https://docs.railway.com/deployments/regions
- Railway configuration: https://docs.railway.com/config-as-code/reference
- Origin debug header: https://docs.railway.com/networking/edge-networking
- WebRTC required codecs: https://www.rfc-editor.org/info/rfc7874/
