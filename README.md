# Boresight Target Generator

A web page that prints a true-scale laser boresight target for your firearm, sight height, load and zero range.

- Pick a rifle, pistol or shotgun, the caliber, sight height, bullet weight and shape, and the zero range.
- The page works out where the laser (which follows the bore) crosses the line of sight, and how far below the aim point the laser spot sits at a closer target range.
- Print a boresight target (Letter or A4, light measuring grid, 1 in and 5 cm bars for checking the scale), a 1-inch-grid sight-in target for the first shots, or a one-page report with a trajectory table.
- After the first shots, enter how far the group is off and get the scope clicks (MOA or mil).
- Adjust the typical velocity for your barrel length (test barrel length and change per inch are editable).
- Search the caliber list, and save named setups in your browser.
- Save to file downloads a JSON file with your saved setups, the current setup and the table, wind and click settings; Load from file adds them back (on any device or browser). A saved setup with the same name is replaced.
- The trajectory table shows the bullet path and wind drift in inches (cm), MOA and mil. You choose how far it goes and the step (up to 40 ranges), the wind speed (10 mph by default) and the direction it comes from (o'clock).
- A range card below the trajectory table shows the scope clicks to dial for elevation and wind at each range, exactly as it prints (3 x 5 in, or 4 x 6 in for long tables). Its click size is shared with the click calculator, and its zoom button (like the chart's) fills the window with the card.
- Works offline after the first visit, and can be installed as an app (Install app button in Chrome, Edge and Android; Share, then Add to Home Screen on iPhone and iPad).
- Every setting is kept in a short code after the `#`, so a link opens the exact same setup. Each printed sheet carries a QR code of that link.

Ballistics use a G1 point-mass model in standard atmosphere (59 °F, 29.53 inHg). Typical velocities and ballistic coefficients are estimates; enter your own values for best results.

## Files

- `index.html`, `css/`, `js/`: the site. No build step or server code; open `index.html` directly or host the folder as-is.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline copy and app install. The service worker answers from its copy and refreshes it in the background, so a new version appears on the visit after it is published.
- `js/vendor/qrcode.js`: [QR Code Generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 by Kazuhiko Arase (MIT license).
- `tests/test.html`: engine checks. `tests/share.html`: shareable-link checks. `tests/ui.html`: caliber search, saved setups, click calculator and trajectory table. Open any of them in a browser; the summary at the top shows the result.
