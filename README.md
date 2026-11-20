# FLAG WARS

TikTok LIVE gift events add coin-equivalent points to the configured country. The public leaderboard reads the persistent totals from Supabase.

## Services

- **Web:** static `index.html` leaderboard.
- **API / TikTok worker:** `server.js` (Node.js 20+, ES modules).
- **Database:** Supabase table `public.country_scores`.
- **Atomic point update:** Supabase RPC function `public.add_country_points(p_country_code, p_points)`.

## Required server environment variables

Set these on the Node service (for example, the Render Web Service):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; server-side only, never put this in the browser |
| `TIKTOK_USERNAME` | TikTok LIVE account username, with or without the leading `@` |
| `TIKTOK_COUNTRY_CODE` | Two-letter country code receiving gifts, e.g. `TR` |

The server exposes `/` and `/health` endpoints. Health reports whether Supabase is configured and the TikTok connection state.

## Important behavior

- A gift adds its diamond value multiplied by its streak count.
- Streak gifts are counted only when the streak finishes.
- Points are written through the database RPC; the browser never receives the service-role key.
- The leaderboard refreshes from Supabase realtime events and also polls every 30 seconds.
- Existing country totals are not reset by deploying the application.

## Deploy

Use Node.js 20 or newer and run:

```bash
npm install
npm start
```

The static leaderboard can be deployed on a static hosting service. The TikTok worker must run as a persistent Node.js web service, not as a static-site deployment.
