# Boresight Target Generator

A web page that prints a true-scale laser boresight target for your firearm, sight height, load and zero range.

- Pick a rifle, pistol or shotgun, the caliber, sight height, bullet weight and shape, and the zero range.
- The page works out where the laser (which follows the bore) crosses the line of sight, and how far below the aim point the laser spot sits at a closer target range.
- Print a boresight target (Letter or A4, optional measuring grid, 1 in and 5 cm bars for checking the scale), a 1-inch-grid sight-in target for the first shots, or a one-page report with a trajectory table.
- After the first shots, enter how far the group is off and get the scope clicks (MOA or mil).
- Search the caliber list, and save named setups in your browser.
- Every setting is kept in a short code after the `#`, so a link opens the exact same setup.

Ballistics use a G1 point-mass model in standard atmosphere (59 °F, 29.53 inHg). Typical velocities and ballistic coefficients are estimates; enter your own values for best results.

## Files

- `index.html`, `css/`, `js/`: the site. No build step or server code; open `index.html` directly or host the folder as-is.
- `tests/test.html`: engine checks. `tests/share.html`: shareable-link checks. `tests/ui.html`: caliber search, saved setups, click calculator and trajectory table. Open any of them in a browser; the summary at the top shows the result.
