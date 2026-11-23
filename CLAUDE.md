# Boresight Target Generator

A static, offline-capable web app (GitHub Pages: `bca3244/boresight-target`) for boresighting, sighting in and comparing loads. It is modeled on Dexadine's SiteLite BTS, but the code and data are its own. The owner is a hunter; the main rifle is a 350 Legend.

## Layout

- `index.html` holds all markup: a header (brand, Setup/Field/Compare tabs, settings gear), then three `<main>` views. Only one view is visible at a time.
  - **Setup** (`main.layout`): bench work. Firearm, caliber, bullet, sight height and zero; the boresight result with printable target, report and sight-in sheet; trajectory chart and table; point-blank range; range card; click calculator ("Adjust after your first shots"); My setups and My loads.
  - **Field** (`#field-view`): phone-first and glove-friendly. Profile chip, range stepper and presets, elevation and wind holds in clicks, point-blank banner, conditions (wind, angle, altitude, temperature, clicks), wake lock. It reads the profile and never changes it.
  - **Compare** (`#compare-view`): two independent loads, A and B, with a shared or split zero. It has a side-by-side table with a B − A column, a path/velocity/energy chart with reference marks, a by-range table, Copy link and Print comparison. It never changes Setup.
- `css/styles.css`: theme tokens on `:root`, with Sun and Night overrides under `[data-theme]`. Print sheets have their own light styles. Breakpoints: 920px (two columns become one), 520px (phone; tab bar fixed at the bottom).
- `js/ballistics.js`: pure engine, exposed as `window.BTS`. G1 point-mass solver, standard atmosphere plus `atmosphere(altFt, tempF)` for other air (passed to `trajectoryTable`/`pointBlankAt`; the zero is always solved in standard air), list builders (calibers, weights, shapes, sight heights, zeros), point-blank range, wind drift and energy. It has no DOM code.
- `js/data.js`: caliber data (`window.BTS_DATA`). Each row is `[name, diameter in, min gr, max gr, velocity a, b, form factors by shape, common gr]`.
- `js/app.js`: all page code in one IIFE, split into sections marked `// ---------- Name ----------`: select helpers, My loads, list building, barrel length, solving, click calculator, rendering, shareable link, chart, printing, events, setups file, Field, Compare, Compare link and print, start, offline. It is exposed to tests as `window.BTS_APP`.
- `js/vendor/qrcode.js`: QR generator, used for printed sheets.
- `sw.js`: service worker, stale-while-revalidate. A new version shows on the visit after deploy. Add any new file to `FILES`.

## Conventions

- **State and storage:** per-viewer preferences go in localStorage under `bts.*`, via `loadPref` and `savePref`, wrapped in try/catch. Reset all settings clears every `bts.*` key except `bts.saved` and `bts.loads`. New preferences must survive storage being blocked.
- **Share links:** `#2…` is the Setup share code (see `SHARE_RE` and `shareCode()`/`applyShareCode()`). Keep it backward compatible; old `#1…` links still load. `#compare=` is base64url JSON for a comparison.
- **Units:** internal values are yards, inches, fps, grains and ft-lb. Convert only for display (`metric()`, `toDispDist`/`fromDispDist`, `trajectoryUnits()`).
- **Visibility:** elements hidden with the `hidden` attribute must not be shown by CSS. A test checks this. If a rule sets `display`, add a matching `[hidden] { display: none; }`.
- **Grids:** in grid layouts use `minmax(0, 1fr)`, not `1fr`, or long select text makes the page scroll sideways on phones. Check that `document.documentElement.scrollWidth === innerWidth` at 390px wide on all three tabs.
- **Accessibility:** every visible control needs a name (label, `aria-label` or `title`). A test checks this.
- **Copy:** plain, specific, sentence case. No exclamation marks.
- **Charts:** hand-built SVG, with colors from CSS variables (`screenColors()`). Print sheets use fixed light colors.

## Tests

The tests are browser pages, not a Node runner. Serve the repo root and open them:

```
python3 -m http.server 8765
# then load in a browser (or Playwright):
#   http://localhost:8765/tests/test.html   engine
#   http://localhost:8765/tests/share.html  share codes
#   http://localhost:8765/tests/ui.html     the page in an iframe: lists, setups, table, Field, Compare
```

Or run all three headless: `node tests/run.js` (add `--offline` in a sandbox without network). GitHub Actions runs `node tests/run.js` on every PR and push to `main` (`.github/workflows/tests.yml`); keep it green.

Each page writes `N passed, M failed` into `#summary`. Six QR checks in `ui.html` load the jsQR decoder from a CDN, so they fail in a sandbox without network. That is expected; everything else should pass. Add UI tests for new behavior to `tests/ui.html`, in the block for that tab.

Before shipping a visual change, take Playwright screenshots of the affected tab at 1366×900 and at iPhone 13 size, and look at them. Playwright is preinstalled in Claude's cloud sessions.

## Workflow

- Work on a branch, open a PR to `main`, and merge when asked. The owner usually says to merge right away. GitHub Pages deploys from `main`.
- Keep changes scoped. Update `README.md` when a user-visible feature changes.
- Commit messages: a short summary line, then bullets for what changed.
