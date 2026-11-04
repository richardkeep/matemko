# Easy Math

Playful maths practice for young explorers, built with Vue 3 and Vite.

**Live:** https://maths.ricnovasoftware.com/

**Worker:** https://maths.r-kipsang.workers.dev/

## Learning and play

- Four kinds of adventure:
  - **Mix it up**: addition, subtraction, multiplication and whole-number division, with missing answers or operands. Choose a maximum of 10, 20, 50 or 100.
  - **Times tables**: drill one table from 2 to 12. Each round covers 1–12 before anything repeats.
  - **Number bonds**: pairs that make 10, 20 or 100, as a missing addend or a subtraction from the target.
  - **Tricky sums**: sums the learner most recently got wrong or skipped. Getting one right takes it off the list.
- Any adventure can be played against the clock (1, 2 or 3 minutes). The clock starts with the first answer and the round is checked automatically when time runs out.
- 5–30 questions per round. Settings lock once an attempt starts.
- Large answer boxes, keyboard navigation, friendly explanations, a cheerful star mascot and responsive phone layouts.
- Earn 1–3 stars per completed round, follow a five-star daily trail, collect six achievement stickers, and build a practice streak.
- Surprise missions create a random five-question adventure.
- Stars, stickers and streaks are saved on the device for instant feedback and synced to the account, so they follow the learner to other devices. Devices are merged by taking the larger total, so a round is never counted twice. All completed rounds earn a star, including rounds with mistakes.
- **My rounds** lists the learner's last 50 rounds, each with the sums tried and the right answers, including rounds that never made the star board.
- **Family**: a learner makes a single-use sharing code (valid 24 hours) and gives it to a parent, carer or teacher, who enters it on their own Family page. The grown-up then sees the learner's rounds, sums, stars, streak and stickers, never their email or birthday. Either side can remove the link.
- The shared star board shows each explorer's best round (best score, then most correct, then fastest). Account names and those scores are public.
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

`src/App.vue` and `src/components/` contain the interface; `src/composables/useWorksheet.js` owns each practice attempt; `src/lib/` contains the maths, reward, auth, email and family logic. `src/worker.js` routes the API and `migrations/` holds the database schema.

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

Sticker progress is cached on the device per account ID and synced to the `user_progress` table. The account name is used automatically, with no separate explorer-name field. Existing pre-account local progress is left untouched but is not automatically claimed by a new account.

### Email verification and password reset

Sign-up sends a link to confirm the email. Confirmation is a gentle banner with a "Send it again" button, not a requirement, so existing accounts keep working. "Forgot your password?" sends a reset link. It gives the same answer whether or not the email has an account. Reset links work once, for one hour. A reset signs out every other device and also confirms the email.

Links carry a 256-bit token in the URL fragment (`/#verify=…`, `/#reset=…`), so it never reaches server logs or Referer headers. Only SHA-256 digests are stored, in `auth_tokens`. Sending is throttled per email, per account and per IP.

**Email delivery needs a provider.** Easy Math sends through [Resend](https://resend.com):

```sh
npx wrangler secret put RESEND_API_KEY
```

The sender is set in `wrangler.jsonc` (its domain must be verified in Resend):

```jsonc
"vars": { "MAIL_FROM": "Easy Math <hello@ricnovasoftware.com>" }
```

Without these, production accounts still work, but no verification or reset emails are sent (a `mail_not_configured` error is logged). In local development the links are printed to the Worker console instead. `src/lib/mail.js` is the only file to change for another provider.

Apply D1 migrations before deploying code that uses new tables: `npx wrangler d1 migrations apply matemko --remote`. Migrations from `0004` onwards were added after the original release. The `npm run deploy` script applies migrations before deployment. Cloudflare's connected build currently runs tests and builds the site, then deploys the Worker; database changes must be applied first.

`npm test` includes isolated SQLite-backed integration tests for registration, validation, password verification, sessions, logout, expiry, CSRF, throttling, authenticated score ownership, email verification, password reset, round modes and timers, my rounds, tricky sums, progress sync and family links. `npm run dev` applies local D1 migrations and starts the Worker and Vue preview.
