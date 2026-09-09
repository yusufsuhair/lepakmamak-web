# Project workflow

- Work and commit directly on `main`.
- After completing and verifying changes, deploy them by default. The user explicitly requested automatic deployment on 2026-09-09; no separate deployment confirmation is needed.
- Deploy frontend changes to both Cloudflare Pages projects (`lepakmamak` and `lepak-city`), and verify `lepakmamak.my` plus both default Pages domains. Deploy Railway when backend changes require it.
- Keep the archived KLCC rebuild off production unless explicitly requested.
