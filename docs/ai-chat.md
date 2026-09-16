# Ah Meng chat replies

Run the server with `DEEPSEEK_API_KEY` set in its secret environment. The model is `deepseek-flash`; no client environment variable or SDK is needed. If DeepSeek is not configured, the server falls back to `OPENAI_API_KEY` with `gpt-4o-mini`. Without either key, automated replies are disabled.

For this worktree, the ignored `.env.deepseek.local` contains the local credential. Start with:

```sh
PORT=8137 node --env-file=.env.deepseek.local server/index.mjs
```

Ah Meng uses a stable server-owned chat identity (`Ah Meng · AI`), with no human login or game-master permissions. It responds to every accepted public chat message, sequentially per city room. DMs, party/table chat and announcements are excluded. It does not have a world avatar or profile yet.

Each request sends up to 30 recent in-memory room messages, capped at 12 KB of serialized UTF-8 (a conservative token ceiling), plus the personality and triggering message. Memory starts fresh after a server restart or room recreation. Replies use the existing chat filter and 200-character limit, and are persisted through public chat history.

Each request times out after 20 seconds. Failed requests notify the sender and let the next queued message run; no automatic retries or duplicate replies. A room accepts up to 100 outstanding replies, then notifies additional senders that it is busy. Queues and memory are process-local; room routing must remain on one server instance. Public chat context is sent to the configured provider when enabled.

Check: `node --test tests/ai-chat.check.mjs`

Deployment is separate: configure the server secret in the target environment before deploying. Never commit the credential file.
