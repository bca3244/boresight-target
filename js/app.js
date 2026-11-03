// Boresight Target Generator: page logic. Lists and ballistics come from ballistics.js (window.BTS).
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const el = {
    caliber: $('caliber'), caliberLabel: $('caliber-label'), sight: $('sight'), weight: $('weight'), shape: $('shape'),
    velocity: $('velocity'), velocityUnit: $('velocity-unit'), bc: $('bc'), resetLoad: $('reset-load'), loadNote: $('load-note'),
    zero: $('zero'), target: $('target'), meet: $('meet'), meetUnit: $('meet-unit'), offset: $('offset'),
    error: $('error'), solution: $('solution'), chart: $('chart'), paper: $('paper'),
    printTarget: $('print-target'), printReport: $('print-report'), printRoot: $('print-root'),
    maxRise: $('max-rise'), chartCard: document.querySelector('.chart-card'), chartZoom: $('chart-zoom'), how: $('how'),
    copyLink: $('copy-link'), toast: $('toast')
  };

  const DEFAULTS = {
    rifle: { caliber: '308 Win (7.62x51mm)', sightIn: 1.5, zero: 100 },
    pistol: { caliber: '9mm Luger (9x19mm)', sightIn: 0.9, zero: 50 },
    shotgun: { caliber: '12 gauge slug barrel', sightIn: 0.5, zero: 50 }
  };
  const MODE_NAMES = { rifle: 'Rifle', pistol: 'Pistol', shotgun: 'Shotgun' };
  const FPS_PER_MPS = 1 / 0.3048;

  // Per-viewer preferences only; the page works the same without storage.
  function loadPref(key, fallback) { try { return localStorage.getItem('bts.' + key) || fallback; } catch (e) { return fallback; } }
  function savePref(key, value) { try { localStorage.setItem('bts.' + key, value); } catch (e) { /* storage unavailable */ } }

  const state = {
    units: loadPref('units', 'english') === 'metric' ? 'metric' : 'english',
    paper: loadPref('paper', 'letter') === 'a4' ? 'a4' : 'letter',
    plot: loadPref('plot', 'near') === 'full' ? 'full' : 'near',
    mode: 'rifle',
    lists: {},          // current option arrays: sights, weights, shapes, zeros, targets
    vFps: 0, bc: 0,     // load used for the solution
    custom: false,      // true once the user edits velocity or B.C.
    result: null
  };
  const metric = () => state.units === 'metric';

  // ---------- Select helpers ----------

  function fill(select, items, label, pick) {
    select.innerHTML = '';
    items.forEach((it, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = label(it);
      select.appendChild(o);
    });
    select.value = String(Math.max(0, Math.min(items.length - 1, pick)));
    select.disabled = items.length === 0;
  }
  const idx = select => Number(select.value);
  function nearestIndex(items, value, key) {
    let best = 0, bestD = Infinity;
    items.forEach((it, i) => { const d = Math.abs(key(it) - value); if (d < bestD - 1e-9) { best = i; bestD = d; } });
    return best;
  }

  // ---------- Building the lists (each keeps the previous choice when it still makes sense) ----------

  function buildCalibers(keepName) {
    const names = BTS.calibers(state.mode);
    let pick = names.indexOf(keepName);
    if (pick < 0) pick = names.indexOf(DEFAULTS[state.mode].caliber);
    el.caliberLabel.textContent = state.mode === 'shotgun' ? 'Gauge' : 'Caliber';
    fill(el.caliber, names, n => n, pick);
  }

  function buildSights(keepInches) {
    const sights = BTS.sightHeights(state.mode, metric());
    state.lists.sights = sights;
    const target = keepInches == null ? DEFAULTS[state.mode].sightIn : keepInches;
    fill(el.sight, sights, s => s.label, nearestIndex(sights, target, s => s.inches));
  }

  function buildWeights(keepGrains) {
    const ci = idx(el.caliber);
    const weights = BTS.weights(state.mode, ci, metric());
    state.lists.weights = weights;
    let target = keepGrains;
    if (target == null) {
      if (state.mode === 'shotgun') target = BTS.GAUGES[ci].eighths[0] === 5 ? 437.5 : 0.75 * 437.5;
      else { const row = BTS_DATA[state.mode][ci]; target = (row[2] + row[3]) / 2; }
    }
    fill(el.weight, weights, w => w.label, nearestIndex(weights, target, w => w.grains));
  }

  function buildShapes(keepLabel) {
    const shapes = BTS.shapes(state.mode, idx(el.caliber));
    state.lists.shapes = shapes;
    let pick = shapes.findIndex(s => s.label === keepLabel);
    if (pick < 0) pick = shapes.findIndex(s => s.label === 'Pointed');
    if (pick < 0) pick = shapes.findIndex(s => s.label === 'Sabot Slug');
    fill(el.shape, shapes, s => s.label, Math.max(0, pick));
  }

  function buildZeros(keep) {
    const zeros = BTS.zeroRanges(state.mode);
    state.lists.zeros = zeros;
    let pick = zeros.indexOf(keep);
    if (pick < 0) pick = zeros.indexOf(DEFAULTS[state.mode].zero);
    const unit = metric() ? 'm' : 'yd';
    fill(el.zero, zeros, z => z + ' ' + unit, Math.max(0, pick));
  }

  // Typical velocity and B.C. for the selected caliber, weight and shape.
  function setTypicalLoad() {
    const ci = idx(el.caliber), w = state.lists.weights[idx(el.weight)], s = state.lists.shapes[idx(el.shape)];
    if (!w || !s) return;
    state.vFps = BTS.typicalVelocityFps(state.mode, ci, w);
    state.bc = BTS.typicalBc(state.mode, ci, w, s.index);
    state.custom = false;
    showLoad();
  }

  function showLoad() {
    el.velocityUnit.textContent = metric() ? 'm/s' : 'fps';
    el.velocity.value = String(metric() ? BTS.roundHalfEven(state.vFps / FPS_PER_MPS) : state.vFps);
    el.bc.value = state.bc.toFixed(3);
    el.velocity.classList.toggle('custom', state.custom);
    el.bc.classList.toggle('custom', state.custom);
    el.resetLoad.hidden = !state.custom;
    el.loadNote.textContent = state.custom ? 'Using your values.' : 'Typical values for this load; enter your own if you know them.';
  }

  function readLoadInputs() {
    const v = parseFloat(el.velocity.value), bc = parseFloat(el.bc.value);
    state.vFps = metric() ? v * FPS_PER_MPS : v;
    state.bc = bc;
    state.custom = true;
    el.velocity.classList.add('custom');
    el.bc.classList.add('custom');
    el.resetLoad.hidden = false;
    el.loadNote.textContent = 'Using your values.';
  }

  // ---------- Solving ----------

  function compute() {
    const sight = state.lists.sights[idx(el.sight)];
    const zero = state.lists.zeros[idx(el.zero)];
    const sightIn = sight.inches;
    const zeroYd = metric() ? zero / BTS.METERS_PER_YARD : zero;
    const r = { sight, sightIn, zero, zeroYd, vFps: state.vFps, bc: state.bc, error: null };

    if (!(state.vFps >= 100 && state.vFps <= 6000)) r.error = 'Enter a muzzle velocity between ' + (metric() ? '30 and 1830 m/s.' : '100 and 6000 fps.');
    else if (!(state.bc >= 0.01 && state.bc <= 2)) r.error = 'Enter a ballistic coefficient between 0.010 and 2.000.';
    else {
      const sol = BTS.solve(state.vFps, state.bc, sightIn, zeroYd);
      if (sol.rising || !isFinite(sol.meetYd) || sol.meetYd <= 0) {
        r.error = '<strong>This load can’t be zeroed this close to the muzzle.</strong> The bullet is still rising near ' +
          zero + (metric() ? ' m' : ' yd') + '. Choose a longer zero range.';
      } else {
        r.angle = sol.angle;
        r.meetYd = sol.meetYd;
        r.meet = metric() ? sol.meetYd * BTS.METERS_PER_YARD : sol.meetYd;
        // Highest point of the bullet above the sight line on the way to the zero.
        const top = BTS.trajectory(state.vFps, state.bc, sightIn, sol.angle, zeroYd, zeroYd / 600)
          .reduce((a, p) => (p.y > a.y ? p : a), { x: 0, y: -Infinity });
        r.rise = {
          x: metric() ? top.x * BTS.METERS_PER_YARD : top.x,
          y: Math.max(0, metric() ? top.y * BTS.CM_PER_INCH : top.y)
        };
      }
    }
    state.result = r;
    return r;
  }

  function buildTargets(keep) {
    const r = state.result;
    const ranges = BTS.targetRanges(r.sightIn, r.meet);
    const unit = metric() ? 'm' : 'yd';
    const items = [{ value: r.meet, label: '★ ' + r.meet.toFixed(1) + ' ' + unit + ' (meet distance)', meet: true }]
      .concat(ranges.map(v => ({ value: v, label: v + ' ' + unit })));
    state.lists.targets = items;
    let pick = keep == null ? 0 : items.findIndex(t => !t.meet && t.value === keep);
    fill(el.target, items, t => t.label, Math.max(0, pick));
  }

  function currentTarget() {
    const r = state.result, t = state.lists.targets[idx(el.target)] || state.lists.targets[0];
    const offIn = BTS.laserOffset(r.sightIn, r.meet, t.value);
    return { range: t.value, meet: t.meet, offIn, offDisp: metric() ? offIn * BTS.CM_PER_INCH : offIn };
  }

  function fmtOffset(t) {
    const unit = metric() ? 'cm' : 'in';
    const v = Math.abs(t.offDisp);
    if (v < 0.005) return '0.00 ' + unit + ' · on the aim point';
    return v.toFixed(2) + ' ' + unit + ' below aim';
  }

  function riseText(rise) {
    return rise.y.toFixed(2) + (metric() ? ' cm' : ' in') + ' at ' + Math.round(rise.x) + (metric() ? ' m' : ' yd');
  }

  function offsetSentence(t) {
    const unit = metric() ? 'cm' : 'in';
    const v = Math.abs(t.offDisp);
    return v < 0.005 ? 'The laser spot is on the aim point at this range.'
      : 'The laser spot is ' + v.toFixed(2) + ' ' + unit + ' below the aim point.';
  }

  // ---------- Rendering ----------

  function render(keepTarget) {
    const r = compute();
    const ok = !r.error;
    el.error.hidden = ok;
    el.error.innerHTML = r.error || '';
    el.solution.hidden = !ok;
    el.printTarget.disabled = el.printReport.disabled = !ok;
    if (!ok) { el.chart.innerHTML = ''; syncUrl(); return; }
    buildTargets(keepTarget);
    el.meet.textContent = r.meet.toFixed(1);
    el.meetUnit.textContent = metric() ? 'm' : 'yd';
    el.maxRise.textContent = 'Max rise ' + riseText(r.rise);
    renderTarget();
  }

  function renderTarget() {
    const t = currentTarget(), v = Math.abs(t.offDisp);
    el.offset.innerHTML = v.toFixed(2) + ' ' + (metric() ? 'cm' : 'in') +
      `<small>${v < 0.005 ? 'on the aim point' : 'below the aim point'}</small>`;
    drawChart();
    syncUrl();
  }

  // ---------- Shareable link ----------
  // Every setting lives in a short base-36 code after the #, e.g. index.html#20200b2y2100:
  //   2           format version (1 = links made before weights went to 1-grain steps)
  //   flags       firearm * 8 + metric * 4 + A4 * 2 + full-zero chart
  //   2 chars     caliber, sight height and weight (positions in their lists)
  //   1 char      shape, then zero range
  //   2 chars     target range (0 = meet distance)
  //   3 + 3       optional: your own velocity (in the displayed unit) and B.C. x 1000
  const SHARE_RE = /^#([12])([0-9a-n])([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})([0-9a-z])([0-9a-z])([0-9a-z]{2})(?:([0-9a-z]{3})([0-9a-z]{3}))?$/;
  let urlReady = false;   // no URL writes while the page is still starting up
  const b36 = (n, len) => Math.max(0, Math.round(n)).toString(36).padStart(len, '0').slice(-len);

  function shareCode() {
    const flags = BTS.MODES.indexOf(state.mode) * 8 + (metric() ? 4 : 0) + (state.paper === 'a4' ? 2 : 0) + (state.plot === 'full' ? 1 : 0);
    const target = state.result && !state.result.error ? idx(el.target) : 0;
    let code = '2' + flags.toString(36) + b36(idx(el.caliber), 2) + b36(idx(el.sight), 2) + b36(idx(el.weight), 2) +
      b36(idx(el.shape), 1) + b36(idx(el.zero), 1) + b36(target, 2);
    if (state.custom && state.vFps > 0 && state.bc > 0) {
      code += b36(metric() ? state.vFps / FPS_PER_MPS : state.vFps, 3) + b36(state.bc * 1000, 3);
    }
    return code;
  }

  function syncUrl() {
    if (!urlReady || document.body.classList.contains('previewing')) return;
    const hash = '#' + shareCode();
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  // Restores settings from a link. Returns false (and changes nothing) if the hash isn't a settings code.
  function applyShareCode(hash) {
    const full = hash.match(SHARE_RE);
    if (!full) return false;
    const version = full[1], m = full.slice(1);   // m[1..9] are the fields after the version
    const n = s => parseInt(s, 36);
    const flags = n(m[1]), mode = BTS.MODES[flags >> 3];
    if (!mode) return false;
    const pick = (select, i) => { if (i < select.options.length) select.value = String(i); };
    state.mode = mode;
    state.units = flags & 4 ? 'metric' : 'english';
    state.paper = flags & 2 ? 'a4' : 'letter';
    state.plot = flags & 1 ? 'full' : 'near';
    el.paper.value = state.paper;
    setPressed('[data-mode]', 'data-mode', state.mode);
    setPressed('[data-units]', 'data-units', state.units);
    setPressed('[data-plot]', 'data-plot', state.plot);
    buildCalibers(null); pick(el.caliber, n(m[2]));
    buildSights(null); pick(el.sight, n(m[3]));
    buildWeights(null);
    if (version === '1') {
      // Version-1 links point into a coarser weight list; find the same weight in today's list.
      const old = BTS.v1Weights(state.mode, idx(el.caliber), metric())[n(m[4])];
      if (old) pick(el.weight, nearestIndex(state.lists.weights, old.grains, w => w.grains));
    } else pick(el.weight, n(m[4]));
    buildShapes(null); pick(el.shape, n(m[5]));
    buildZeros(null); pick(el.zero, n(m[6]));
    if (m[8]) {
      const v = n(m[8]);
      state.vFps = metric() ? v * FPS_PER_MPS : v;
      state.bc = n(m[9]) / 1000;
      state.custom = true;
      showLoad();
    } else setTypicalLoad();
    render();
    if (state.result && !state.result.error) { pick(el.target, n(m[7])); renderTarget(); }
    return true;
  }

  // Copies the current link; falls back to a hidden text field where the clipboard API isn't allowed.
  function copyLink() {
    syncUrl();
    const url = location.href;
    const done = () => toast('Link copied');
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      ok ? done() : window.prompt('Copy this link:', url);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback);
    else fallback();
  }

  let toastTimer = 0;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
  }

  // ---------- Chart ----------

  function niceStep(span, count) {
    const raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  function chartData() {
    const r = state.result, t = currentTarget();
    const toDisp = metric() ? BTS.METERS_PER_YARD : 1;      // yards -> display distance
    const yScale = metric() ? BTS.CM_PER_INCH : 1;          // inches -> display height
    const xMaxYd = state.plot === 'near'
      ? Math.max(r.meetYd * 1.6, (t.meet ? 0 : t.range / toDisp) * 1.15, 3)
      : r.zeroYd * 1.12;
    const pts = BTS.trajectory(r.vFps, r.bc, r.sightIn, r.angle, xMaxYd, xMaxYd / 240)
      .map(p => ({ x: p.x * toDisp, y: p.y * yScale }));
    const h = r.sightIn * yScale, meet = r.meet;
    return { pts, h, meet, rise: r.rise, xMax: xMaxYd * toDisp, target: t, yScale,
      laserAt: x => -h + h * x / meet,
      xUnit: metric() ? 'm' : 'yd', yUnit: metric() ? 'cm' : 'in' };
  }

  // Returns an SVG string. `colors` lets the printed report use a light palette.
  function chartSVG(d, w, h, colors, interactive) {
    // Text size grows with the chart (the maximized view gets the largest type).
    const fs = w >= 1100 ? 17 : w >= 700 ? 15 : 14;
    const m = { l: Math.round(fs * 4.3), r: 18, t: 18, b: Math.round(fs * 3.3) };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const riseShown = d.rise && d.rise.y > 0.005 && d.rise.x <= d.xMax;
    let yMin = Math.min(-d.h, ...d.pts.map(p => p.y)), yMax = Math.max(d.laserAt(d.xMax), ...d.pts.map(p => p.y), 0);
    const pad = (yMax - yMin) * 0.08 || 0.1;
    yMin -= pad; yMax += pad;
    const ys = niceStep(yMax - yMin, 7), xs = niceStep(d.xMax, 9);
    yMin = Math.floor(yMin / ys) * ys; yMax = Math.ceil(yMax / ys) * ys;
    const X = x => m.l + x / d.xMax * iw, Y = y => m.t + (yMax - y) / (yMax - yMin) * ih;
    const dec = v => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(ys < 0.1 ? 2 : ys < 1 ? 1 : 0));

    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Segoe UI, Arial, sans-serif">`;
    s += `<g class="grid">`;
    for (let x = 0; x <= d.xMax + 1e-9; x += xs) s += `<line x1="${X(x)}" y1="${m.t}" x2="${X(x)}" y2="${m.t + ih}" stroke="${colors.grid}"/>`;
    for (let y = yMin; y <= yMax + 1e-9; y += ys) s += `<line x1="${m.l}" y1="${Y(y)}" x2="${m.l + iw}" y2="${Y(y)}" stroke="${colors.grid}"/>`;
    s += `</g><g class="axis" fill="${colors.tick}" font-size="${fs}">`;
    for (let x = 0; x <= d.xMax + 1e-9; x += xs) s += `<text x="${X(x)}" y="${m.t + ih + fs * 1.45}" text-anchor="middle">${+x.toFixed(2)}</text>`;
    for (let y = yMin; y <= yMax + 1e-9; y += ys) s += `<text x="${m.l - 10}" y="${Y(y) + fs * 0.35}" text-anchor="end">${dec(y)}</text>`;
    s += `<text x="${m.l + iw / 2}" y="${h - 6}" text-anchor="middle" fill="${colors.title}" font-weight="600" font-size="${fs}">Range (${d.xUnit})</text>`;
    s += `<text transform="translate(${fs} ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" fill="${colors.title}" font-weight="600" font-size="${fs}">Height (${d.yUnit})</text></g>`;

    const path = d.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
    s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(d.xMax)}" y2="${Y(0)}" stroke="${colors.los}" stroke-width="2.25"/>`;
    s += `<path d="${path}" fill="none" stroke="${colors.path}" stroke-width="2.25" stroke-linejoin="round"/>`;
    s += `<line x1="${X(0)}" y1="${Y(-d.h)}" x2="${X(d.xMax)}" y2="${Y(d.laserAt(d.xMax))}" stroke="${colors.laser}" stroke-width="2.25"/>`;

    if (!d.target.meet && d.target.range <= d.xMax) {
      const tx = X(d.target.range), ty = Y(d.laserAt(d.target.range));
      s += `<line x1="${tx}" y1="${m.t}" x2="${tx}" y2="${m.t + ih}" stroke="${colors.axis}" stroke-dasharray="4 4"/>`;
      s += `<circle cx="${tx}" cy="${ty}" r="4.5" fill="${colors.laser}"/>`;
    }
    if (riseShown) {
      // Maximum rise: a drop line from the top of the arc to the sight line, with its height.
      const rx = X(d.rise.x), ry = Y(d.rise.y), anchor = rx > m.l + iw * 0.75 ? 'end' : 'middle';
      s += `<line x1="${rx}" y1="${ry}" x2="${rx}" y2="${Y(0)}" stroke="${colors.path}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      s += `<circle cx="${rx}" cy="${ry}" r="5" fill="${colors.path}" stroke="${colors.bg}" stroke-width="2"/>`;
      s += `<text x="${anchor === 'end' ? rx - 8 : rx}" y="${ry - 12}" text-anchor="${anchor}" fill="${colors.title}" stroke="${colors.bg}" stroke-width="4" paint-order="stroke" font-weight="600" font-size="${fs}">Max rise ${d.rise.y.toFixed(2)} ${d.yUnit} @ ${Math.round(d.rise.x)} ${d.xUnit}</text>`;
    }
    if (d.meet <= d.xMax) {
      const mx = X(d.meet), my = Y(0);
      s += `<circle cx="${mx}" cy="${my}" r="5.5" fill="${colors.bg}" stroke="${colors.accent}" stroke-width="2.5"/>`;
      const anchor = mx > m.l + iw * 0.8 ? 'end' : 'start';
      // Label sits below the sight line, clear of the rising laser beam; the halo keeps it readable over grid lines.
      s += `<text x="${mx + (anchor === 'end' ? -10 : 10)}" y="${my + fs + 9}" text-anchor="${anchor}" fill="${colors.title}" stroke="${colors.bg}" stroke-width="4" paint-order="stroke" font-weight="600" font-size="${fs}">Meet ${d.meet.toFixed(1)} ${d.xUnit}</text>`;
    }
    if (interactive) s += `<line class="hover-line" x1="0" y1="${m.t}" x2="0" y2="${m.t + ih}" stroke="${colors.axis}" visibility="hidden"/><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    s += `</svg>`;
    return { svg: s, X, m, iw };
  }

  function screenColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    return { grid: v('--border'), axis: v('--faint'), tick: v('--muted'), title: v('--text'), los: v('--los'), path: v('--path'), laser: v('--laser'), accent: v('--accent'), bg: v('--bg') };
  }

  function drawChart() {
    const w = Math.max(280, el.chart.clientWidth), h = Math.max(220, el.chart.clientHeight);
    const d = chartData();
    const c = chartSVG(d, w, h, screenColors(), true);
    el.chart.innerHTML = c.svg + '<div class="tooltip" hidden></div>';
    const svg = el.chart.querySelector('svg'), tip = el.chart.querySelector('.tooltip'), hover = svg.querySelector('.hover-line');
    const hit = svg.querySelector('.hit');
    const pathAt = x => {
      const p = d.pts; let i = 1;
      while (i < p.length - 1 && p[i].x < x) i++;
      const a = p[i - 1], b = p[i], f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + f * (b.y - a.y);
    };
    hit.addEventListener('pointermove', e => {
      const box = svg.getBoundingClientRect();
      const px = (e.clientX - box.left) * (w / box.width);
      const x = Math.max(0, Math.min(d.xMax, (px - c.m.l) / c.iw * d.xMax));
      hover.setAttribute('x1', c.X(x)); hover.setAttribute('x2', c.X(x)); hover.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.style.left = (c.X(x) / w * box.width) + 'px';
      tip.style.top = ((e.clientY - box.top)) + 'px';
      tip.innerHTML = `<b>${x.toFixed(1)} ${d.xUnit}</b><br><span class="t-path">Bullet ${pathAt(x).toFixed(2)} ${d.yUnit}</span><br><span class="t-laser">Laser ${d.laserAt(x).toFixed(2)} ${d.yUnit}</span>`;
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; hover.setAttribute('visibility', 'hidden'); });
  }

  // ---------- Printing ----------

  const PAPER = { letter: { w: 8.5, h: 11, css: '8.5in 11in', name: 'Letter' }, a4: { w: 210 / 25.4, h: 297 / 25.4, css: '210mm 297mm', name: 'A4' } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function settingsRows() {
    const r = state.result, t = currentTarget();
    const unitD = metric() ? 'm' : 'yd';
    const w = state.lists.weights[idx(el.weight)], s = state.lists.shapes[idx(el.shape)];
    const v = metric() ? BTS.roundHalfEven(r.vFps / FPS_PER_MPS) + ' m/s' : BTS.roundHalfEven(r.vFps) + ' fps';
    return [
      ['Firearm', MODE_NAMES[state.mode]],
      [state.mode === 'shotgun' ? 'Gauge' : 'Caliber', BTS.calibers(state.mode)[idx(el.caliber)]],
      ['Sight height', r.sight.value.toFixed(1) + (metric() ? ' cm' : ' in')],
      ['Bullet weight', w.label],
      ['Bullet shape', s.label],
      ['Muzzle velocity', v + (state.custom ? '' : ' (typical)')],
      ['G1 B.C.', r.bc.toFixed(3) + (state.custom ? '' : ' (typical)')],
      ['Zero range', r.zero + ' ' + unitD],
      ['Meet distance', r.meet.toFixed(1) + ' ' + unitD],
      ['Maximum rise', riseText(r.rise)],
      ['Target range', (t.meet ? r.meet.toFixed(1) : t.range) + ' ' + unitD],
      ['Laser position', fmtOffset(t)]
    ];
  }

  function targetSheet(paper) {
    const W = paper.w, H = paper.h, t = currentTarget(), r = state.result;
    // Footer starts at fy; the crosshair stops above it and the laser ring must clear it.
    const off = Math.abs(t.offIn), R = 0.38, fy = H - 2.45;
    const aimY = Math.max(1.5, Math.min(3.3, fy - 0.55 - R - off));
    const laserY = aimY + off, cx = W / 2;
    const unitD = metric() ? 'meters' : 'yards';
    const range = t.meet ? r.meet.toFixed(1) : String(t.range);
    const dash = 'stroke="#000" stroke-width="0.1" stroke-linecap="round" stroke-dasharray="0.32 0.16"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}in" height="${H}in" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`;
    s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
    s += `<text x="${W / 2}" y="0.55" text-anchor="middle" font-size="0.12" fill="#555">Boresight target · ${esc(BTS.calibers(state.mode)[idx(el.caliber)])}</text>`;
    s += `<text x="0.95" y="1.05" text-anchor="middle" font-size="0.34" font-weight="700">TOP</text><text x="${W - 0.95}" y="1.05" text-anchor="middle" font-size="0.34" font-weight="700">TOP</text>`;
    // Aim point crosshair (the sight goes here).
    s += `<line x1="0.45" y1="${aimY}" x2="${W - 0.45}" y2="${aimY}" ${dash}/>`;
    s += `<line x1="${cx}" y1="0.85" x2="${cx}" y2="${fy - 0.4}" ${dash}/>`;
    s += `<circle cx="${cx}" cy="${aimY}" r="0.05" fill="#000"/>`;
    s += `<text x="${cx + 0.14}" y="${aimY - 0.12}" font-size="0.12" font-weight="700">AIM</text>`;
    // Laser spot (the boresighter's dot goes here).
    s += `<circle cx="${cx}" cy="${laserY}" r="${R}" fill="#fff" stroke="#000" stroke-width="0.13"/>`;
    s += `<circle cx="${cx}" cy="${laserY}" r="0.075" fill="none" stroke="#000" stroke-width="0.035"/>`;
    s += `<text x="${cx}" y="${laserY - 0.13}" text-anchor="middle" font-size="0.085" font-weight="700" letter-spacing="0.01">LASER</text>`;
    // Footer: placement line across the page, then instructions and scale check (left) and settings (right).
    s += `<line x1="0.5" y1="${fy - 0.3}" x2="${W - 0.5}" y2="${fy - 0.3}" stroke="#bbb" stroke-width="0.01"/>`;
    s += `<text x="${W / 2}" y="${fy}" text-anchor="middle" font-size="0.2" font-weight="700">Place this target ${range} ${unitD} from the muzzle.</text>`;
    const ly = fy + 0.42;
    s += `<text x="0.5" y="${ly}" font-size="0.12" font-weight="700">${esc(offsetSentence(t))}</text>`;
    s += `<text x="0.5" y="${ly + 0.22}" font-size="0.11" fill="#333">Put the laser in the circle, then adjust the sight to the crosshair.</text>`;
    s += `<text x="0.5" y="${ly + 0.4}" font-size="0.11" fill="#333">A dim room or shaded target makes the laser easier to see.</text>`;
    // Scale check bars.
    const by = ly + 0.8;
    s += `<text x="0.5" y="${by}" font-size="0.105" font-weight="700">Scale check: these bars must measure exactly 1 in and 5 cm.</text>`;
    s += `<g stroke="#000" stroke-width="0.02"><line x1="0.5" y1="${by + 0.3}" x2="1.5" y2="${by + 0.3}" stroke-width="0.05"/><line x1="0.5" y1="${by + 0.18}" x2="0.5" y2="${by + 0.42}"/><line x1="1.5" y1="${by + 0.18}" x2="1.5" y2="${by + 0.42}"/>`;
    const cm5 = 5 / 2.54;
    s += `<line x1="1.9" y1="${by + 0.3}" x2="${1.9 + cm5}" y2="${by + 0.3}" stroke-width="0.05"/><line x1="1.9" y1="${by + 0.18}" x2="1.9" y2="${by + 0.42}"/><line x1="${1.9 + cm5}" y1="${by + 0.18}" x2="${1.9 + cm5}" y2="${by + 0.42}"/></g>`;
    s += `<text x="1" y="${by + 0.58}" text-anchor="middle" font-size="0.1">1 in</text><text x="${1.9 + cm5 / 2}" y="${by + 0.58}" text-anchor="middle" font-size="0.1">5 cm</text>`;
    const rows = settingsRows().filter(rw => rw[0] !== 'Meet distance' && rw[0] !== 'Maximum rise');
    rows.push(['Printed', new Date().toLocaleString()]);
    rows.forEach((rw, i) => {
      s += `<text x="${W - 0.5}" y="${ly + i * 0.152}" text-anchor="end" font-size="0.105"><tspan fill="#555">${esc(rw[0])}:</tspan> ${esc(rw[1])}</text>`;
    });
    s += `</svg>`;
    return `<div class="sheet">${s}</div>`;
  }

  function reportSheet(paper) {
    const r = state.result, d = chartData();
    const light = { grid: '#d9dee5', axis: '#5f6b7a', tick: '#444', title: '#222', los: '#1f6fe5', path: '#b07d0b', laser: '#e0283d', accent: '#0f9d8a', bg: '#fff' };
    // The report always shows the full zero range so the maximum rise is on the chart.
    const saved = state.plot; state.plot = 'full';
    const chart = chartSVG(chartData(), 680, 290, light, false).svg;
    state.plot = saved;
    const rows = settingsRows().map(rw => `<tr><th>${esc(rw[0])}</th><td>${esc(rw[1])}</td></tr>`).join('');
    const unitD = metric() ? 'm' : 'yd';
    return `<div class="sheet report" style="width:${paper.w}in;height:${paper.h}in">
      <header><svg viewBox="0 0 32 32" width="34" height="34"><circle cx="16" cy="16" r="11" fill="none" stroke="#0f9d8a" stroke-width="2.5"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="#0f9d8a" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="#e0283d"/></svg>
      <div><h1>Boresight Report</h1><p>${esc(BTS.calibers(state.mode)[idx(el.caliber)])} · zeroed at ${r.zero} ${unitD}</p></div></header>
      <p class="report-meet">Line of sight and laser beam meet at <strong>${r.meet.toFixed(1)} ${unitD}</strong></p>
      <div class="report-chart">${chart}</div>
      <p class="report-legend"><span style="color:#1f6fe5">━ Line of sight</span><span style="color:#b07d0b">━ Bullet path</span><span style="color:#e0283d">━ Laser beam</span></p>
      <table>${rows}</table>
      <h2>Aligning the sight at the meet distance</h2>
      <ul>
        <li><strong>Scope:</strong> center the crosshair on the laser spot.</li>
        <li><strong>Open sights:</strong> hold the laser spot just on top of the front post, level with the rear notch.</li>
        <li><strong>Red dot or holographic:</strong> put the dot on the laser spot.</li>
      </ul>
      <footer>G1 point-mass model, standard atmosphere (59 °F, 29.53 inHg). Printed ${esc(new Date().toLocaleString())}. Confirm your zero with live fire.</footer>
    </div>`;
  }

  function print(kind) {
    if (!state.result || state.result.error) return;
    const paper = PAPER[state.paper];
    let style = document.getElementById('page-size');
    if (!style) { style = document.createElement('style'); style.id = 'page-size'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${paper.css}; margin: 0; }`;
    el.printRoot.innerHTML = kind === 'target' ? targetSheet(paper) : reportSheet(paper);
    window.print();
  }
  window.addEventListener('afterprint', () => { el.printRoot.innerHTML = ''; });

  // ---------- Events ----------

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  }

  function changeMode(mode) {
    if (mode === state.mode) return;
    const prevName = BTS.calibers(state.mode)[idx(el.caliber)];
    const prevZero = state.lists.zeros[idx(el.zero)];
    state.mode = mode;
    setPressed('[data-mode]', 'data-mode', mode);
    buildCalibers(prevName);
    buildSights(null);
    buildWeights(null);
    buildShapes(null);
    buildZeros(prevZero);
    setTypicalLoad();
    render();
  }

  function changeUnits(units) {
    if (units === state.units) return;
    const sightIn = state.lists.sights[idx(el.sight)].inches;
    const grains = state.lists.weights[idx(el.weight)].grains;
    const shape = state.lists.shapes[idx(el.shape)].label;
    const zero = state.lists.zeros[idx(el.zero)];
    const keepLoad = state.custom ? { v: state.vFps, bc: state.bc } : null;
    state.units = units;
    savePref('units', units);
    setPressed('[data-units]', 'data-units', units);
    buildSights(sightIn);
    buildWeights(grains);
    buildShapes(shape);
    buildZeros(zero);
    if (keepLoad) { state.vFps = keepLoad.v; state.bc = keepLoad.bc; state.custom = true; showLoad(); } else setTypicalLoad();
    render();
  }

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => changeMode(b.dataset.mode)));
  document.querySelectorAll('[data-units]').forEach(b => b.addEventListener('click', () => changeUnits(b.dataset.units)));
  document.querySelectorAll('[data-plot]').forEach(b => b.addEventListener('click', () => {
    state.plot = b.dataset.plot; savePref('plot', state.plot);
    setPressed('[data-plot]', 'data-plot', state.plot);
    if (state.result && !state.result.error) drawChart();
    syncUrl();
  }));

  el.caliber.addEventListener('change', () => {
    buildWeights(null);
    buildShapes(state.lists.shapes[idx(el.shape)] && state.lists.shapes[idx(el.shape)].label);
    setTypicalLoad();
    render();
  });
  el.sight.addEventListener('change', () => render(keepTargetValue()));
  el.weight.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.shape.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.zero.addEventListener('change', () => render(keepTargetValue()));
  el.target.addEventListener('change', renderTarget);
  ['input', 'change'].forEach(ev => {
    el.velocity.addEventListener(ev, () => { readLoadInputs(); render(keepTargetValue()); });
    el.bc.addEventListener(ev, () => { readLoadInputs(); render(keepTargetValue()); });
  });
  el.resetLoad.addEventListener('click', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.paper.addEventListener('change', () => { state.paper = el.paper.value; savePref('paper', state.paper); syncUrl(); });
  el.copyLink.addEventListener('click', copyLink);
  el.printTarget.addEventListener('click', () => print('target'));
  el.printReport.addEventListener('click', () => print('report'));

  function keepTargetValue() {
    const t = state.lists.targets && state.lists.targets[idx(el.target)];
    return t && !t.meet ? t.value : null;
  }

  // Chart zoom: the chart card fills the window; Escape or the button restores it.
  function setChartMax(on) {
    el.chartCard.classList.toggle('maximized', on);
    document.body.classList.toggle('chart-open', on);
    el.chartZoom.setAttribute('aria-pressed', String(on));
    el.chartZoom.setAttribute('aria-label', on ? 'Restore chart' : 'Maximize chart');
    el.chartZoom.title = on ? 'Restore chart (Esc)' : 'Maximize chart';
    if (state.result && !state.result.error) drawChart();
  }
  el.chartZoom.addEventListener('click', () => setChartMax(!el.chartCard.classList.contains('maximized')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.chartCard.classList.contains('maximized')) setChartMax(false); });

  // Remember whether the how-to card is open.
  el.how.open = loadPref('how', 'open') === 'open';
  el.how.addEventListener('toggle', () => savePref('how', el.how.open ? 'open' : 'closed'));

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.result && !state.result.error) drawChart(); }, 80);
  });

  // ---------- Start ----------
  const startHash = location.hash;
  if (!applyShareCode(startHash)) {
    el.paper.value = state.paper;
    setPressed('[data-units]', 'data-units', state.units);
    setPressed('[data-plot]', 'data-plot', state.plot);
    buildCalibers(DEFAULTS.rifle.caliber);
    buildSights(null);
    buildWeights(150);
    buildShapes('Pointed');
    buildZeros(DEFAULTS.rifle.zero);
    setTypicalLoad();
    render();
  }

  // index.html#preview-target or #preview-report shows a printable sheet on screen.
  // An optional @range picks a target range, e.g. #preview-target@10.
  function showPreview(hash) {
    const m = hash.match(/^#preview-(target|report)(?:@(\d+))?$/) || [];
    const kind = m[1];
    document.body.classList.toggle('previewing', !!kind);
    if (m[2]) {
      const i = state.lists.targets.findIndex(t => !t.meet && t.value === Number(m[2]));
      if (i >= 0) { el.target.value = String(i); renderTarget(); }
    }
    if (kind && state.result && !state.result.error) {
      el.printRoot.innerHTML = kind === 'target' ? targetSheet(PAPER[state.paper]) : reportSheet(PAPER[state.paper]);
    } else if (!kind) el.printRoot.innerHTML = '';
  }
  // A link pasted into an open tab only changes the hash, so apply it here too.
  window.addEventListener('hashchange', () => {
    if (!applyShareCode(location.hash)) showPreview(location.hash);
  });
  showPreview(startHash);
  if (startHash === '#chart') setChartMax(true);
  urlReady = true;
  syncUrl();

  window.BTS_APP = { state, render, print };
})();
