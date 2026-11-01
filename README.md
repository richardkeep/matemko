# Matemko

A simple maths worksheet for kids that runs entirely in the browser.

**Live:** https://maths.r-kipsang.workers.dev/

## What it does

- Generates random sums using addition, subtraction, multiplication and division. Choose which operations to include, the largest allowed result and how many questions (laid out 30 per A4 page).
- In each sum one number is missing, either the answer or one of the operands, for the child to fill in.
- Asks for the child's name before they start.
- The child types answers on screen. **Check answers** marks each one right or wrong, shows the correct answer where needed and gives a score.
- Once answering has started, the worksheet and settings are locked until the answers are checked, so an attempt can't be discarded halfway through.
- Every checked attempt is saved to **History** with the name, start and finish times, time taken, settings and score.
- Worksheets can be printed on A4.

History is kept in the browser's local storage, so it stays on that device and browser only.

## Running locally

It's a single `index.html` file with no build step. Open it in a browser.

## Credits

Credits go to [Lovro Papež](https://github.com/cannonsh).
