# Matemko

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
- Nicknames and checked scores are public on the shared star board; use a nickname rather than a full name.
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

`src/App.vue` and `src/components/` contain the interface; `src/composables/useWorksheet.js` owns each practice attempt; `src/lib/` contains the maths and reward logic. `src/worker.js` retains the shared-attempt API and `migrations/` retains the existing database schema.

## Deployment

Cloudflare Workers Builds runs tests, builds the Vue app, then deploys the existing `maths` Worker on pushes to `main`. Static assets are served directly by Cloudflare; `/api/*` runs the Worker with its existing D1 binding.

For an authenticated manual deployment:

```sh
npm run deploy
```

This builds the app, applies pending remote migrations and deploys. Do not create a new database for an existing installation. The current deployment keeps the existing database and its scores.

## Credits

Inspired by [Lovro Papež](https://github.com/cannonsh/matemko).
