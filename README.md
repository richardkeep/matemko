# Easy Math

Playful maths practice for young explorers, built with Vue 3 and Vite.

**Live:** https://maths.ricnovasoftware.com/

**Worker:** https://maths.r-kipsang.workers.dev/

## Learning and play

- Addition, subtraction, multiplication and whole-number division, with missing answers or operands.
- Choose a maximum of 10, 20, 50 or 100 and 5–30 questions. Settings lock once an attempt starts.
- Large answer boxes, keyboard navigation, friendly explanations, a cheerful star mascot and responsive phone layouts.
- Earn 1–3 stars per completed round, follow a five-star daily trail, collect six achievement stickers, and build a practice streak.
- Surprise missions create a random five-question adventure.
- Rewards and nickname progress are saved on the current browser/device. They do not sync between devices. All completed rounds earn a star, including rounds with mistakes.
- **My rounds** lists the learner's last 50 rounds, each with the sums tried and the right answers, including rounds that never made the star board.
- Account names and checked scores are public on the shared star board.
- Existing shared attempts stay in Cloudflare D1. Connection failures offer a save retry.
- Print up to 30 questions per A4 page. Reduced-motion preferences are respected.

## Development

```sh
npm ci
npm run dev
```

Development builds the assets, applies **local** D1 migrations, starts the local Worker API on port 8787 and starts Vite. Vite proxies `/api` to that local Worker, so development scores never enter the production board. The default Vite port is 5173; pass `-- --port 4173` to change it.

```sh
npm test       # maths boundaries, scoring, rewards, dates and persistence
npm run build # production static assets in dist/
```

`src/App.vue` and `src/components/` contain the interface; `src/composables/useWorksheet.js` owns each practice attempt; `src/lib/` contains the maths, reward and auth logic. `src/worker.js` routes the API and `migrations/` holds the database schema.

## Deployment

Cloudflare Workers Builds runs tests, builds the Vue app, then deploys the existing `maths` Worker on pushes to `main`. Static assets are served directly by Cloudflare; `/api/*` runs the Worker with its existing D1 binding.

For an authenticated manual deployment:

```sh
npm run deploy
```

This builds the app, applies pending remote migrations and deploys. Do not create a new database for an existing installation. The current deployment keeps the existing database and its scores.

## Credits

Inspired by [Lovro Papež](https://github.com/cannonsh/matemko).

## Accounts

Easy Math requires an account before practice and leaderboard access. Sign-up collects name, email, password (10–128 characters), and date of birth. Email is normalized; invalid or future birthdays are rejected. The signed-in user’s account name, score and the existing country label are shared on the signed-in star board. Email and birthday are private. Submitted names and user IDs are ignored; score ownership and display names come from the session.

Accounts live in the existing D1 database. Passwords are salted with cryptographic randomness and derived using native PBKDF2-SHA256 at the Workers runtime ceiling of 100,000 iterations. Session tokens use 256 bits of randomness; only SHA-256 token digests are stored. Production uses a seven-day Secure, HttpOnly, SameSite=Lax __Host- cookie. Sign-out revokes the current session. Requests must come from the same origin and auth attempts are throttled by email and hashed IP. No credentials are stored in browser localStorage.

Sticker progress is device-local and scoped to account ID, so two signed-in accounts on the same browser do not share progress. The account name is used automatically, with no separate explorer-name field. Existing pre-account local progress is left untouched but is not automatically claimed by a new account. Cloud progress sync, email verification and password recovery are not included in this initial authentication flow.

Apply D1 migrations before deploying code that uses new tables: `npx wrangler d1 migrations apply matemko --remote`. Migrations from `0004` onwards were added after the original release. The `npm run deploy` script applies migrations before deployment. Cloudflare's connected build currently runs tests and builds the site, then deploys the Worker; database changes must be applied first.

`npm test` includes isolated SQLite-backed integration tests for registration, validation, password verification, sessions, logout, expiry, CSRF, throttling, authenticated score ownership and my rounds. `npm run dev` applies local D1 migrations and starts the Worker and Vue preview.
