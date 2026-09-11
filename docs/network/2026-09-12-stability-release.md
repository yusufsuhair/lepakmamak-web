# Dedicated voice and gameplay transport release

## Architecture and rollout

- Native WebRTC/Opus carries voice through Cloudflare Realtime Serverless SFU. Railway handles authenticated signalling and server-authorized proximity/Party subscriptions; audio never uses the gameplay socket when SFU is enabled.
- AudioWorklet gates silence before the Opus encoder, with 60 ms pre-roll and 240 ms hangover. Opus DTX is requested. Legacy local-development PCM capture also suppresses silence.
- Server-issued sessions and track names prevent clients selecting arbitrary listeners or provider sessions. Death, moderation, Party restrictions during Lukis/Werewolf and proximity are enforced at subscription time and rechecked every 500 ms. Revocation closes provider tracks. Nearest 16 eligible publishers are subscribed per listener.
- Movement deltas retain per-socket baselines. A dropped snapshot triggers a fresh full baseline; appearance, joins and removals remain synchronized. Slow sockets skip replaceable snapshots at 16 KB buffered; reliable game messages retain order.
- Client decode queues are bounded to 32 queued frames / 2 seconds queued age; an overrun reconnects rather than replaying an unbounded stale queue. Rendering applies the latest reconstructed state once per animation frame.
- Client heartbeat expires after 15 seconds without a matching pong, with background/wake grace. Native WebSocket heartbeat releases dead sockets after 60 seconds while allowing browser-native pongs from background tabs.
- Every 15 seconds clients report RTT percentiles, render frame time, decode backlog and WebRTC jitter/loss. Health exposes aggregates only; samples expire after 60 seconds. These are diagnostics, not trusted gameplay input.

## Configuration

Set `CF_SFU_APP_ID` and `CF_SFU_APP_SECRET` on the Railway service. The secret is used only in server-side calls to Cloudflare; never set a VITE-prefixed secret or put it in public assets. Configure with `--skip-deploys`, then deploy the tested commit once. No SFU credentials means legacy transport for local development; an enabled SFU outage never silently downgrades the city to PCM.

Frontend must deploy before the newer backend so the existing version refresh mechanism can obtain the new bundle. Production frontend targets are `lepakmamak` and `lepak-city`. Verify backend `/health` reports the intended version and `voiceTransport: "sfu"`. A realtime deployment restarts in-memory rooms; it is not a rolling room migration.

To roll back, deploy a compatible known-good frontend/backend pair. Do not remove SFU variables while expecting the same voice protocol; that explicitly re-enables legacy voice and its bandwidth cost.

## SQA retest

1. Two nearby mobile/desktop users: toggle mic/speaker, hear audio and see activity. Leave radius: incoming RTP must stop, not merely mute locally. Return: audio resumes.
2. Party voice remains private; dead Werewolf players and live-game Party collusion cannot publish to prohibited listeners.
3. Force receiver/publisher failure, mic off/on and socket disconnect. Voice recovers independently where possible; no duplicate tracks or ghost participants.
4. At least ten simultaneous publishers: signalling exceeds the previous 4 KB envelope. Oversized invalid WebSocket frames must close only that socket, never the city process.
5. Repeated proximity changes retire spent SDP m-lines. Check voice after many moves and scope changes.
6. Full snapshot → deltas → skipped frame → full baseline, avatar appearance changes, player joins/removals and teleport. No missing avatars or stale roster.
7. Background/resume mobile; sever connectivity beyond heartbeat grace; ensure reconnect UI, Party grace and gameplay restrictions remain intact.

## Limits of verification

Synthetic load clients share one machine/network; RTT is not a universal latency guarantee. The real-media test uses Chrome with generated audio, not human speech on physical phones. Restrictive networks requiring TURN, hours-long media soak and real-device mouth-to-ear latency remain separate tests. The movement soak and real-media fanout are different workloads, and must not be described as 100 simultaneous real voice users.

## Verification recorded before rollout

- Real Cloudflare media: two-browser proximity removal/return, microphone restart, forced receiver and publisher failure passed. Incoming RTP stops after server-side revocation.
- Ten real Chrome publishers/subscribers, 30-second measurement: 143,805 received RTP packets, 0 reported lost packets, highest sampled jitter 9 ms. No legacy audio messages sent by the SFU client.
- Isolated cloud movement bursts (20 seconds each): 20 players 0.290 MB/s; 50 players 1.345 MB/s; 100 players 4.732 MB/s. Previous 100-player movement baseline was 7.37 MB/s (~36% less payload traffic). This is aggregate received WebSocket payload, not billed bandwidth.
- The first extended run on an intermediate build lost some connections around minute nine without a server restart. It is not counted as a passed 100-player soak. The final-build rerun records close codes and uses native socket heartbeats.
- Fanout testing exposed the old 4 KB socket envelope rejecting multi-track SDP and an unhandled socket error crashing the server. Signalling now has a bounded 64 KB envelope, normal gameplay remains limited to 4 KB, and socket errors terminate only the affected connection. Regression covers an oversized malicious frame.
