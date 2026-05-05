# Cloudflare Deployment

This project deploys as Cloudflare Workers Static Assets without a Worker script.
That keeps runtime usage low: matching static asset requests are served as assets,
not as Worker CPU work.

Production URL: `https://aifight.wangnov-ai.com/`

## Local checks

```bash
npm run build
npx wrangler deploy --dry-run
```

## First deploy

```bash
npx wrangler login
npm run cf:deploy
```

## Resource posture

- `wrangler.toml` intentionally has no `main` Worker entry and no `run_worker_first`.
- SPA fallback is handled by `assets.not_found_handling = "single-page-application"`.
- `public/_headers` gives hashed Vite chunks long browser cache, sprite assets a one-day browser cache, and `index.html` revalidation.
- Keep API, analytics, KV, D1, R2, Durable Objects, and Worker routes out until the game actually needs them.

## Pre-release smoke test

- Load the workers.dev URL in a fresh browser session.
- Hard refresh the first screen and confirm no 404s in DevTools Network.
- Start PVP and PVE from the menu.
- Select each fighter at least once.
- Trigger each fighter's projectile, heavy attack, and ultimate.
- Confirm mobile-sized viewport still fits the canvas.
