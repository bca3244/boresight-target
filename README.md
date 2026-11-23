# Firearm Sight-In & Ballistics Calculator

Formerly "Boresight Target Generator". The web address, saved setups, saved loads and share links are unchanged.

A web page to boresight, sight in, dial and compare loads. It prints true-scale laser boresight and sight-in targets, and works out scope clicks, point-blank range and a trajectory table for your firearm, sight height, load and zero range. It runs entirely in the browser, works offline and can be installed as an app.

Live at <https://bca3244.github.io/boresight-target/>. The page has three views (tabs at the top, or at the bottom on a phone): **Setup**, **Field** and **Compare**.

## Setup

For the bench. Each card folds up (the page remembers which are folded), and "How to use it" gives the five boresighting steps.

- **Firearm and load.** Pick a rifle (about 200 cartridges), pistol (about 50) or shotgun (12 and 20 gauge slug barrels, weights in ounces), then the caliber, bullet weight and shape, and the zero range. The caliber list has a search box.
- **Your own loads.** Add a load with a name, bullet weight, muzzle velocity and G1 B.C. Your loads are listed first under Caliber (and found by the search), and can be edited or deleted. A link to a setup carries its load, so it opens on any device; a load from a link can be saved to your loads there.
- **Barrel length.** Adjust the typical velocity for your barrel (test barrel length and change per inch are editable), or enter your own velocity and B.C.; "Use typical values" puts them back.
- **Sight height.** For rifles, a common-mounts list fills in rule-of-thumb heights for bolt guns (low, medium and high rings: about 1.5, 1.8 and 2.0 in) and AR-15s (iron sights or a 1.5 in mount about 2.6 in; 1.93 in mount about 3.0 in; 2.26 in mount about 3.4 in). These are estimates, not measurements; "How sight height changes the path" explains the effect and how to measure your own.
- **Zeroed in.** The altitude and temperature where you sighted in (standard air by default). The zero, boresight solution, chart and Setup point-blank range are solved in that air, and it travels with the setup's link and saved setups. The trajectory table, range card and Field holds use the air where you shoot, so a rifle zeroed at home gives correct holds somewhere else.
- **Result.** Where the laser (which follows the bore) crosses the line of sight, and how far below the aim point the laser spot sits at a closer target range. Print a boresight target (Letter or A4, light measuring grid, 1 in and 5 cm bars for checking the scale), a 1-inch-grid sight-in target for the first shots, or a one-page report with a trajectory table. Copy link copies a link to these exact settings.
- **Boresight solution chart.** Line of sight, bullet path and laser beam, with the maximum rise and near zero. Switch between the near zero and the full zero, and maximize it to fill the window.
- **Point-blank range.** Enter the vital zone (6 in by default) to see how far you can aim dead-on, the zero that gives the longest point-blank range (with a button to use the nearest zero choice), and what your current zero gives.
- **Trajectory table.** Bullet path and wind drift in inches (cm), MOA and mil. You choose how far it goes and the step (up to 40 ranges), the wind speed (10 mph by default) and the direction it comes from (o'clock), and the shot angle (up to 60° uphill or downhill, in 5° steps). With a shot angle, the ranges are line-of-sight distances (what a rangefinder reads) for a rifle zeroed on level ground; the table and range card follow it, while the boresight solution and point-blank range stay on level ground. Altitude and temperature (shared with Field) set the air where you shoot.
- **Range card.** The scope clicks to dial for elevation and wind at each range, exactly as it prints (3 x 5 in, or 4 x 6 in for long tables). Its click size is shared with the click calculator, and its zoom button fills the window with the card.
- **Adjust after your first shots.** Enter how far the group is high or low and left or right, and get the scope clicks (MOA or mil, with your click size).
- **My setups.** Save named setups in your browser and open or delete them. Save to file downloads a JSON file with your saved setups, your loads, the current setup and the table, wind, shot angle and click settings; Load from file adds them back (on any device or browser). A saved setup or load with the same name is replaced.

## Field

For the range or the stand, sized for a phone and gloves. It reads the Setup profile and never changes it.

- The active profile at the top: tap it to go back to Setup, or switch to a saved setup.
- A big range readout with steppers and one-tap presets.
- The elevation and wind holds in scope clicks, with a warning when the bullet goes transonic or subsonic.
- A point-blank banner that says whether to aim dead-on at this range.
- Conditions: wind speed and direction, shot angle, altitude, temperature and click size, shared with the trajectory table and range card.
- Keeps the screen on while it's open (where the browser supports it).

## Compare

Two loads side by side, independent of Setup.

- Each side has its own firearm, caliber or load (with search), bullet weight and shape, velocity and B.C. (typical, or your own), and sight height, and can be filled from the current Setup or a saved setup. Both share one zero unless B gets its own; choose how far to compare.
- **Side by side.** Weight, diameter, sectional density, B.C., muzzle velocity, energy, momentum and Taylor KO, point-blank range with the zero and at its best zero, how far each stays supersonic, and how far each carries 1,000 / 1,500 / 2,000 ft-lb (deer, elk and moose rules of thumb), with the higher value marked and a B − A column for the difference.
- **Downrange chart.** Path (with the vital zone shaded), velocity (with the speed of sound) or energy (with the deer, elk and moose levels) for both.
- **By range.** A table that switches between trajectory (path, drift, time) and impact (velocity, energy, momentum, Taylor KO).
- Copy link shares the whole comparison (a side using one of your loads carries its numbers, so it opens anywhere), and Print comparison gives a two-page sheet: the side-by-side table and charts with a QR code, then both tables by range.
- Wind and the vital zone are the ones set in Setup and Field. The comparison is on level ground in standard air and never changes Setup.

## Settings

The gear, top right:

- Units: Imperial or Metric.
- Theme: Dark, Sun (high-contrast light for bright sun) or Night (red on black, to keep your night vision).
- Paper size for printing: Letter or A4.
- Reset all settings asks first, then puts every setting back to its default (units, paper, table, wind, shot angle, altitude, temperature, clicks, vital zone, folded cards, view, theme, the Compare loads and whether "How to use it" is open) and opens the plain address. Saved setups and your loads are kept.

## Links, offline and install

- Every Setup setting is kept in a short code after the `#`, so a link opens the exact same setup, and each printed sheet carries a QR code of that link. The plain address (no `#`) shows the defaults and stays clean until you change something. Older links keep working.
- Settings, saved setups and your loads stay in this browser only; nothing is sent anywhere.
- Works offline after the first visit. When a new version is ready, a bar offers Reload.
- Install it as an app: the Install app button in Chrome, Edge and Android; Share, then Add to Home Screen on iPhone and iPad.

## Ballistics

A G1 point-mass model in the Army Standard Metro atmosphere (59 °F, 29.53 inHg, 78% humidity), or the altitude and temperature you choose: where you zeroed (for the zero) and where you shoot (for the table, range card and Field). Pressure follows the standard atmosphere for the altitude, and humidity stays at 78%. Compare stays in standard air. Typical velocities and ballistic coefficients are estimates; enter your own values for best results. Energy thresholds and Taylor KO are rules of thumb, not measurements of killing power.

## Files

- `index.html`, `css/`, `js/`: the site. No build step or server code; open `index.html` directly or host the folder as-is.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline copy and app install. The service worker answers from its copy and checks for a new version in the background on each visit; it switches only once every file has downloaded, then offers a Reload.
- `js/vendor/qrcode.js`: [QR Code Generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 by Kazuhiko Arase (MIT license).
- `tests/test.html`: engine checks. `tests/share.html`: shareable-link checks. `tests/ui.html`: caliber search, saved setups, click calculator, trajectory table, Field mode and Compare. Serve the folder (for example `python3 -m http.server 8765`) and open any of them in a browser; the summary at the top shows the result. `node tests/run.js` runs all three in headless Chromium (Playwright; add `--offline` without network, where 6 QR checks are skipped), and GitHub Actions runs it on every pull request and push to `main`. Pull requests to `main` need the `browser-tests` check to pass.
