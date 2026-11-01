# Matemko

A simple maths worksheet for kids that runs entirely in the browser.

**Live:** https://maths.r-kipsang.workers.dev/

## What it does

- Generates random sums using addition, subtraction, multiplication and division. Choose which operations to include, the largest allowed result and how many questions (laid out 30 per A4 page).
- In each sum one number is missing, either the answer or one of the operands, for the child to fill in.
- Asks for the child's name before they start.
- The child types answers on screen. **Check answers** marks each one right or wrong, shows the correct answer where needed and gives a score.
- Once answering has started, the worksheet and settings are locked until the answers are checked, so an attempt can't be discarded halfway through.
- Every checked attempt is saved to a shared **History**, so everyone can see each other's attempts: name, start and finish times, time taken, settings and score, best first.
- Worksheets can be printed on A4.

## How it's built

- `public/index.html`: the whole app, with no build step.
- `src/worker.js`: a Cloudflare Worker that serves the page and a small API (`GET`/`POST /api/attempts`).
- `migrations/`: the D1 (SQLite) table that stores attempts.

## Running locally

```sh
npm install
npm run dev   # creates the local database and serves http://localhost:8787
```

## Deploying

One-time setup:

```sh
npx wrangler login
npx wrangler d1 create matemko   # put the printed database_id into wrangler.jsonc
```

Then, for each deploy:

```sh
npm run deploy   # applies any new migrations and deploys the Worker
```

## Credits

Credits go to [Lovro Papež](https://github.com/cannonsh/matemko).
