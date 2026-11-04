// Boresight Target Generator: ballistics engine and the rules that build each dropdown list.
// No page code lives here, so tests/test.html can load it on its own.
(function () {
  'use strict';

  // Standard G1 drag function: Mach number -> drag coefficient.
  const G1_MACH = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.725, 0.75, 0.775, 0.8, 0.825, 0.85, 0.875, 0.9, 0.925, 0.95, 0.975, 1.0, 1.025, 1.05, 1.075, 1.1, 1.125, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.15, 2.2, 2.25, 2.3, 2.35, 2.4, 2.45, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0];
  const G1_CD = [0.2629, 0.2558, 0.2487, 0.2413, 0.2344, 0.2278, 0.2214, 0.2155, 0.2104, 0.2061, 0.2032, 0.2020, 0.2034, 0.2165, 0.2230, 0.2313, 0.2417, 0.2546, 0.2706, 0.2901, 0.3136, 0.3415, 0.3734, 0.4084, 0.4448, 0.4805, 0.5136, 0.5427, 0.5677, 0.5883, 0.6053, 0.6191, 0.6393, 0.6518, 0.6589, 0.6621, 0.6625, 0.6607, 0.6573, 0.6528, 0.6474, 0.6413, 0.6347, 0.6280, 0.6210, 0.6141, 0.6072, 0.6003, 0.5934, 0.5867, 0.5804, 0.5743, 0.5685, 0.5630, 0.5577, 0.5527, 0.5481, 0.5438, 0.5397, 0.5325, 0.5264, 0.5211, 0.5168, 0.5133, 0.5105, 0.5084, 0.5067, 0.5054, 0.5040, 0.5030, 0.5022, 0.5016, 0.5010, 0.5006, 0.4998, 0.4995, 0.4992, 0.4990, 0.4988];

  // Army Standard Metro atmosphere (59 F, 29.53 inHg, 78% RH). Feet, seconds, pounds.
  const RHO = 0.0751;
  const SOUND = 1116.45;
  const GRAVITY = 32.174;
  const DT = 0.00002;

  const GRAMS_PER_GRAIN = 0.06479891;
  const GRAMS_PER_OUNCE = 28.349518;
  const GRAINS_PER_OUNCE = 437.5;
  const CM_PER_INCH = 2.54;
  const METERS_PER_YARD = 0.9144;
  const IRON_SIGHT_MAX_IN = 1.0001; // at or below this, target ranges start at 1 instead of 8
  // A zero is refused once the top of the arc reaches this fraction of the zero range
  // (0.954 is accepted, 0.965 is refused).
  const APEX_LIMIT = 0.96;

  // Rounds halves to the even neighbour (banker's rounding).
  function roundHalfEven(x) {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
  }

  function cdG1(mach) {
    if (mach <= 0) return G1_CD[0];
    for (let i = 1; i < G1_MACH.length; i++) {
      if (mach < G1_MACH[i]) {
        const f = (mach - G1_MACH[i - 1]) / (G1_MACH[i] - G1_MACH[i - 1]);
        return G1_CD[i - 1] + f * (G1_CD[i] - G1_CD[i - 1]);
      }
    }
    return G1_CD[G1_CD.length - 1];
  }

  // Point-mass flight along the bore at `angle` (radians). Calls sample(xFt, yFt, vyFtPerS) at each step
  // and stops once x passes maxFt (or when sample returns true). y is measured from the bore's starting point.
  // x runs along the line of sight; slopeDeg tilts that line up (+) or down (-), so gravity has a part along it
  // (slowing an uphill bullet) and only g x cos(slope) across it. Air density is the same at every angle.
  function fly(v0, bc, angle, maxFt, sample, slopeDeg) {
    const k = RHO * Math.PI / (8 * bc * 144), s = (slopeDeg || 0) * Math.PI / 180;
    const gAlong = GRAVITY * Math.sin(s), gAcross = GRAVITY * Math.cos(s);
    let x = 0, y = 0, t = 0, vx = v0 * Math.cos(angle), vy = v0 * Math.sin(angle);
    sample(0, 0, vy, vx, 0);
    while (x < maxFt && vx > 1) {
      const v = Math.sqrt(vx * vx + vy * vy);
      const a = k * cdG1(v / SOUND) * v;
      x += vx * DT;
      y += vy * DT;
      t += DT;
      vx -= (a * vx + gAlong) * DT;
      vy -= (a * vy + gAcross) * DT;
      if (sample(x, y, vy, vx, t) === true) return;
    }
  }

  // Height (ft) above the bore's starting point and vertical speed at exactly xFt.
  function stateAt(v0, bc, angle, xFt) {
    let px = 0, py = 0, pvy = 0, out = null;
    fly(v0, bc, angle, xFt, (x, y, vy) => {
      if (out) return;
      if (x >= xFt) {
        const f = x === px ? 0 : (xFt - px) / (x - px);
        out = { y: py + f * (y - py), vy: pvy + f * (vy - pvy) };
      }
      px = x; py = y; pvy = vy;
    });
    return out || { y: py, vy: pvy };
  }

  // Solve the bore angle that puts the bullet on the sight line at the zero range.
  // Returns the meet distance (where the laser, which follows the bore, crosses the sight line) and
  // whether the zero is valid: a zero too close to the top of the arc is refused.
  function solve(v0, bc, sightIn, zeroYd) {
    const h = sightIn / 12, z = zeroYd * 3;
    let angle = 0, state = null;
    for (let i = 0; i < 30; i++) {
      state = stateAt(v0, bc, angle, z);
      const miss = state.y - h;
      angle -= miss / z;
      if (Math.abs(miss) < 1e-7) break;
    }
    // Still rising at APEX_LIMIT of the zero range means the top of the arc is too close to the zero.
    const tooNear = stateAt(v0, bc, angle, z * APEX_LIMIT).vy >= 0;
    return { angle, meetYd: h / Math.tan(angle) / 3, rising: tooNear };
  }

  // Bullet path relative to the sight line (inches), sampled every stepYd out to maxYd.
  function trajectory(v0, bc, sightIn, angle, maxYd, stepYd) {
    const pts = [];
    let next = 0, px = 0, py = 0;
    fly(v0, bc, angle, maxYd * 3 + 1, (x, y) => {
      while (next <= maxYd + 1e-9 && x >= next * 3) {
        const f = x === px ? 0 : (next * 3 - px) / (x - px);
        pts.push({ x: next, y: (py + f * (y - py)) * 12 - sightIn });
        next += stepYd;
      }
      px = x; py = y;
    });
    return pts;
  }

  // Height (in, relative to the sight line), speed (fps) and time of flight (s) at each range in rangesYd.
  // With slopeDeg the ranges are line-of-sight distances (what a rangefinder reads) up or down that angle,
  // for a rifle zeroed on level ground at `angle`.
  function trajectoryTable(v0, bc, sightIn, angle, rangesYd, slopeDeg) {
    const want = rangesYd.slice().sort((a, b) => a - b), out = [];
    let i = 0, p = null;
    fly(v0, bc, angle, want[want.length - 1] * 3 + 1, (x, y, vy, vx, t) => {
      const cur = { x, y, v: Math.sqrt(vx * vx + vy * vy), t };
      while (i < want.length && x >= want[i] * 3) {
        const a = p || cur, f = cur.x === a.x ? 0 : (want[i] * 3 - a.x) / (cur.x - a.x);
        const lerp = k => a[k] + f * (cur[k] - a[k]);
        out.push({ range: want[i], y: lerp('y') * 12 - sightIn, v: lerp('v'), t: lerp('t') });
        i++;
      }
      p = cur;
    }, slopeDeg);
    return out;
  }

  // Drift (in) in a steady full-value crosswind of windMph, from the time of flight to rangeYd:
  // drift = wind x (t - x / v0), the lag rule that a point-mass model with a constant crosswind reduces to.
  function windDriftIn(windMph, rangeYd, tSec, v0) { return windMph * 5280 / 3600 * (tSec - rangeYd * 3 / v0) * 12; }

  // Angle that a height of offsetIn at rangeYd subtends, in MOA or mil.
  function angleOf(offsetIn, rangeYd, unit) {
    return offsetIn / ((unit === 'mil' ? INCHES_PER_MIL_AT_100YD : INCHES_PER_MOA_AT_100YD) * rangeYd / 100);
  }

  // First range (yd) where the rising bullet crosses the sight line, or null if it never does before the zero.
  function nearZero(v0, bc, sightIn, angle, zeroYd) {
    const pts = trajectory(v0, bc, sightIn, angle, zeroYd, zeroYd / 2000);
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].y < 0 && pts[i].y >= 0) {
        const a = pts[i - 1], b = pts[i];
        return a.x + (0 - a.y) / (b.y - a.y) * (b.x - a.x);
      }
    }
    return null;
  }

  // Point-blank range for a bore angle: where the bullet stays within ±radiusIn of the sight line.
  // Returns { startYd, nearZeroYd, apexYd, apexIn, farZeroYd, endYd }; endYd is null if the bullet never drops
  // radiusIn below the line within maxYd, and startYd > 0 only when the sight sits more than radiusIn above the bore.
  function pointBlankAt(v0, bc, sightIn, angle, radiusIn, maxYd, apexOnly) {
    const out = { startYd: null, nearZeroYd: null, apexYd: 0, apexIn: -sightIn, farZeroYd: null, endYd: null };
    let px = 0, py = -sightIn, done = false;
    const cross = (x, y, level) => (px + (level - py) / (y - py) * (x - px)) / 3;
    fly(v0, bc, angle, maxYd * 3, (x, yFt, vy) => {
      if (done) return true;
      if (apexOnly && x > 0 && vy < 0) return true;   // the bisection only needs the top of the arc
      const y = yFt * 12 - sightIn;
      if (x > 0) {
        if (out.startYd === null && y >= -radiusIn) out.startYd = py >= -radiusIn ? 0 : cross(x, y, -radiusIn);
        if (out.nearZeroYd === null && py < 0 && y >= 0) out.nearZeroYd = cross(x, y, 0);
        if (y > out.apexIn) { out.apexIn = y; out.apexYd = x / 3; }
        if (out.farZeroYd === null && out.apexIn > 0 && py > 0 && y <= 0) out.farZeroYd = cross(x, y, 0);
        if (out.startYd !== null && py > -radiusIn && y <= -radiusIn) { out.endYd = cross(x, y, -radiusIn); done = true; }
      }
      px = x; py = y;
    });
    if (out.startYd === null) out.startYd = 0;
    return out;
  }

  // Maximum point-blank range: the bore angle whose highest point is exactly radiusIn above the sight line,
  // so the bullet stays inside a vital zone of 2 x radiusIn for the longest distance. The best zero is where
  // that path comes back down through the sight line.
  function pointBlank(v0, bc, sightIn, radiusIn, maxYd = 2000) {
    const apexOf = a => pointBlankAt(v0, bc, sightIn, a, radiusIn, maxYd, true);
    let lo = 0, hi = 0.002;
    for (let i = 0; i < 20 && apexOf(hi).apexIn < radiusIn; i++) { lo = hi; hi *= 2; }
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (apexOf(mid).apexIn < radiusIn) lo = mid; else hi = mid;
    }
    return Object.assign({ angle: lo }, pointBlankAt(v0, bc, sightIn, lo, radiusIn, maxYd));
  }

  // Scope adjustment for a group that landed offsetIn inches from the aim point at rangeYd yards.
  // click: { unit: 'moa' | 'mil', value } (e.g. 0.25 MOA or 0.1 mil per click). Returns the angle and whole clicks.
  const INCHES_PER_MOA_AT_100YD = 1.04720;
  const INCHES_PER_MIL_AT_100YD = 3.6;
  function clicks(offsetIn, rangeYd, click) {
    const per100 = click.unit === 'mil' ? INCHES_PER_MIL_AT_100YD : INCHES_PER_MOA_AT_100YD;
    const angle = Math.abs(offsetIn) / (per100 * rangeYd / 100);
    return { angle, clicks: Math.round(angle / click.value) };
  }

  // Kinetic energy: ft-lb from grains and fps.
  function energyFtLb(grains, fps) { return grains * fps * fps / 450436; }

  // ---- Dropdown rules ----

  const MODES = ['rifle', 'pistol', 'shotgun'];
  const GAUGES = [
    { name: '12 gauge slug barrel', eighths: [5, 12], diameter: 0.729, fps: 1400, ff: { sabot: 1.54, full: 0.9 } },
    { name: '20 gauge slug barrel', eighths: [4, 10], diameter: 0.617, fps: 1050, ff: { sabot: 1.54, full: 0.8 } }
  ];
  const SLUGS = [{ key: 'sabot', name: 'Sabot Slug' }, { key: 'full', name: 'Slug (full bore size)' }];

  function calibers(mode) {
    if (mode === 'shotgun') return GAUGES.map(g => g.name);
    return window.BTS_DATA[mode].map(r => r[0]);
  }

  function sightHeights(mode, metric) {
    const [from, to, iron, scope, bead] = metric ? [10, 178, 23, 38, 13] : [4, 70, 9, 15, 5];
    const out = [];
    for (let i = from; i <= to; i++) {
      let label = (i / 10).toFixed(1) + (metric ? ' cm' : ' in');
      if (mode === 'shotgun') { if (i === bead) label += '  (typical shotgun bead)'; }
      else if (i === iron) label += '  (typical iron sights)';
      else if (i === scope) label += '  (typical optical scope)';
      out.push({ value: i / 10, inches: metric ? i / 10 / CM_PER_INCH : i / 10, label });
    }
    return out;
  }

  function shotgunWeights(calIndex, metric) {
    const out = [];
    const [a, b] = GAUGES[calIndex].eighths;
    for (let e = a; e <= b; e++) {
      const oz = e / 8;
      out.push({ label: metric ? (oz * GRAMS_PER_OUNCE).toFixed(2) + ' g' : oz.toFixed(3) + ' oz', grains: oz * GRAINS_PER_OUNCE, ounces: oz });
    }
    return out;
  }

  // Each weight is { label, grains }, from 0.8 x typical min to 1.2 x typical max,
  // in every whole grain (or every 0.1 g in metric; 0.05 or 0.02 g for small bullets).
  function weights(mode, calIndex, metric) {
    if (mode === 'shotgun') return shotgunWeights(calIndex, metric);
    const row = window.BTS_DATA[mode][calIndex];
    const out = [];
    if (!metric) {
      const lo = roundHalfEven(0.8 * row[2]), hi = roundHalfEven(1.2 * row[3]);
      for (let g = lo; g <= hi; g++) out.push({ label: g + ' gr', grains: g });
      return out;
    }
    const loG = 0.8 * row[2] * GRAMS_PER_GRAIN, hiG = 1.2 * row[3] * GRAMS_PER_GRAIN;
    const span = hiG - loG, per = span < 1 ? 50 : span < 5 ? 20 : 10;   // steps per gram
    const lo = Math.round(loG * per), hi = Math.round(hiG * per);
    for (let t = lo; t <= hi; t++) out.push({ label: (t / per).toFixed(per === 10 ? 1 : 2) + ' g', grains: t / per / GRAMS_PER_GRAIN });
    return out;
  }

  // The coarser weight lists that version-1 share links point into (also used by the tests).
  function v1Weights(mode, calIndex, metric) {
    const out = [];
    if (mode === 'shotgun') return shotgunWeights(calIndex, metric);
    const row = window.BTS_DATA[mode][calIndex];
    const mn = row[2], mx = row[3];
    if (!metric) {
      const step = Math.max(1, roundHalfEven(0.02 * (mn + mx) / 2));
      const lo = roundHalfEven(0.8 * mn), hi = roundHalfEven(1.2 * mx);
      const n = roundHalfEven(hi / step) - roundHalfEven(lo / step) + 1;
      for (let k = 0; k < n; k++) out.push({ label: (lo + k * step) + ' gr', grains: lo + k * step });
      return out;
    }
    // Metric: twentieths of a gram, at least 11 choices.
    const g1 = mn * GRAMS_PER_GRAIN, g2 = mx * GRAMS_PER_GRAIN;
    const step = Math.max(1, roundHalfEven((g1 + g2) / 2 * 0.02 * 20));
    const lo = 0.8 * g1 * 20, hi = 1.2 * g2 * 20;
    const first = Math.max(1, roundHalfEven(lo / step));
    let last = roundHalfEven(hi / step);
    if (first + 10 > last) last = first + 10;
    let v = roundHalfEven(lo - step);
    for (let k = first; k <= last; k++) {
      v += step;
      out.push({ label: (v / 20).toFixed(2) + ' g', grains: v / 20 / GRAMS_PER_GRAIN });
    }
    return out;
  }

  // Each shape is { label, index } where index points into SHAPES (or SLUGS for shotguns).
  function shapes(mode, calIndex) {
    if (mode === 'shotgun') return SLUGS.map((s, i) => ({ label: s.name, index: i }));
    const ff = window.BTS_DATA[mode][calIndex][6];
    return window.BTS_DATA.SHAPES.map((name, i) => ({ label: name, index: i })).filter(s => ff[s.index] > 0);
  }

  function typicalVelocityFps(mode, calIndex, weight) {
    if (mode === 'shotgun') return roundHalfEven(GAUGES[calIndex].fps / weight.ounces);
    const row = window.BTS_DATA[mode][calIndex];
    return roundHalfEven(row[4] - row[5] * weight.grains);
  }

  function typicalBc(mode, calIndex, weight, shapeIndex) {
    let d, ff;
    if (mode === 'shotgun') {
      const g = GAUGES[calIndex];
      d = g.diameter; ff = g.ff[SLUGS[shapeIndex].key];
    } else {
      const row = window.BTS_DATA[mode][calIndex];
      d = row[1]; ff = row[6][shapeIndex];
    }
    return Math.round(weight.grains / 7000 / (d * d) * ff * 1000) / 1000;
  }

  function zeroRanges(mode) {
    const [a, b] = mode === 'rifle' ? [3, 12] : [1, 6];
    const out = [];
    for (let i = a; i <= b; i++) out.push(i * 25);
    return out;
  }

  // Whole-number target ranges (in the display unit) offered after the meet distance.
  function targetRanges(sightIn, meet) {
    const first = sightIn <= IRON_SIGHT_MAX_IN ? 1 : 8;
    const out = [];
    for (let r = first; r <= Math.trunc(meet); r++) out.push(r);
    return out;
  }

  // Laser spot relative to the aim point (negative = below), in sight-height units.
  function laserOffset(sight, meet, range) {
    return -sight * (1 - range / meet);
  }

  window.BTS = {
    roundHalfEven, solve, trajectory, trajectoryTable, nearZero, pointBlank, pointBlankAt, clicks, energyFtLb, laserOffset, windDriftIn, angleOf,
    calibers, sightHeights, weights, v1Weights, shapes, typicalVelocityFps, typicalBc, zeroRanges, targetRanges,
    MODES, GAUGES, SLUGS, CM_PER_INCH, METERS_PER_YARD,
    ATMOSPHERE: { densityLbFt3: RHO, soundFps: SOUND }
  };
})();
