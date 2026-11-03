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
    copyLink: $('copy-link'), toast: $('toast'),
    caliberSearch: $('caliber-search'), caliberCount: $('caliber-count'),
    savedCard: $('saved-card'), savedList: $('saved-list'), savedLoad: $('saved-load'), savedDelete: $('saved-delete'),
    savedName: $('saved-name'), savedSave: $('saved-save'), savedNote: $('saved-note'), savedCount: $('saved-count'),
    trajTable: $('traj-table'), trajNote: $('traj-note'), wind: $('wind'), windUnit: $('wind-unit'),
    windClock: $('wind-clock'), tMax: $('t-max'), tStep: $('t-step'), trajHint: $('traj-hint'), printCard: $('print-card'),
    cRange: $('c-range'), cClick: $('c-click'), cVert: $('c-vert'), cVdir: $('c-vdir'), cHoriz: $('c-horiz'), cHdir: $('c-hdir'),
    cElev: $('c-elev'), cElevSub: $('c-elev-sub'), cWind: $('c-wind'), cWindSub: $('c-wind-sub'),
    printSightin: $('print-sightin'),
    barrelField: $('barrel-field'), barrelLen: $('barrel-len'), barrelRef: $('barrel-ref'), barrelRate: $('barrel-rate'),
    barrelRateUnit: $('b-rate-unit'), barrelNote: $('barrel-note'), barrelOn: $('barrel-on'), barrelRow: $('barrel-row')
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
  const WIND_DEFAULT_MPH = 10, KMH_PER_MPH = 1.609344;
  function windPref() { const v = parseFloat(loadPref('wind', '')); return v >= 0 && v < 100 ? v : WIND_DEFAULT_MPH; }
  function clockPref() { const v = parseInt(loadPref('windclock', '3'), 10); return v >= 1 && v <= 12 ? v : 3; }
  // Trajectory table: out to `max` every `step`, plus a short first row when the step is longer.
  const TABLE_DEFAULTS = { rifle: { max: 300, step: 50 }, pistol: { max: 150, step: 25 }, shotgun: { max: 150, step: 25 } };
  const TABLE_SHORT = { rifle: 25, pistol: 10, shotgun: 10 };
  const TABLE_STEPS = [5, 10, 25, 50, 100, 200], TABLE_MAX = 2000, TABLE_ROWS = 40;
  function tablePrefs() {
    const out = {};
    Object.keys(TABLE_DEFAULTS).forEach(mode => {
      const [max, step] = loadPref('table.' + mode, '').split(':').map(Number);
      out[mode] = max >= 10 && max <= TABLE_MAX && TABLE_STEPS.includes(step) ? { max, step } : Object.assign({}, TABLE_DEFAULTS[mode]);
    });
    return out;
  }

  const state = {
    units: loadPref('units', 'english') === 'metric' ? 'metric' : 'english',
    paper: loadPref('paper', 'letter') === 'a4' ? 'a4' : 'letter',
    plot: loadPref('plot', 'full') === 'near' ? 'near' : 'full',
    mode: 'rifle',
    lists: {},          // current option arrays: sights, weights, shapes, zeros, targets
    vFps: 0, bc: 0,     // load used for the solution
    typicalFps: 0,      // typical velocity before the barrel adjustment
    custom: false,      // true once the user edits velocity or B.C.
    barrel: null,       // { len, ref, rate } in inches and fps per inch; see resetBarrel()
    windMph: windPref(), // crosswind for the drift columns, kept in mph whatever the units
    windClock: clockPref(), // where the wind comes from, 1-12 o'clock (3 = from the right)
    table: tablePrefs(),    // trajectory table extent per firearm: { max, step } in the displayed distance unit
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
    el.caliberSearch.value = '';
    el.caliberSearch.parentElement.hidden = state.mode === 'shotgun';
    fillCalibers(Math.max(0, pick), '');
  }

  // Caliber options keep their position in the full list as their value, so filtering never changes what idx() means.
  // Every word typed must appear in the name: "6.5 creed" finds "6.5mm Creedmoor".
  function fillCalibers(keepIndex, term) {
    const names = BTS.calibers(state.mode);
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = names.map((n, i) => i).filter(i => words.every(w => names[i].toLowerCase().includes(w)));
    const shown = matches.length ? matches : [keepIndex];
    el.caliber.innerHTML = '';
    shown.forEach(i => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = names[i];
      el.caliber.appendChild(o);
    });
    el.caliber.value = String(shown.includes(keepIndex) ? keepIndex : shown[0]);
    el.caliberCount.textContent = !words.length ? '' : matches.length
      ? `${matches.length} of ${names.length} match “${term.trim()}”` : `No calibers match “${term.trim()}”`;
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

  // Typical velocity (adjusted for barrel length) and B.C. for the selected caliber, weight and shape.
  function setTypicalLoad() {
    const ci = idx(el.caliber), w = state.lists.weights[idx(el.weight)], s = state.lists.shapes[idx(el.shape)];
    if (!w || !s) return;
    state.typicalFps = BTS.typicalVelocityFps(state.mode, ci, w);
    state.vFps = Math.max(100, state.typicalFps + barrelAdjustFps());
    state.bc = BTS.typicalBc(state.mode, ci, w, s.index);
    state.custom = false;
    showLoad();
  }

  // ---------- Barrel length ----------
  // Kept in inches and fps per inch; shown in cm and m/s per cm in metric. len = null means "same as the test barrel".
  const BARREL_REF_IN = { rifle: 24, pistol: 4 };
  const BARREL_RATE_FPS_PER_IN = 25;
  const MPS_PER_CM_PER_FPS_PER_IN = 0.3048 / 2.54;

  // Off by default; turning it on shows the fields with the test barrel and change per inch already filled in.
  function resetBarrel() {
    state.barrel = { on: false, len: null, ref: BARREL_REF_IN[state.mode] || 24, rate: BARREL_RATE_FPS_PER_IN };
  }

  function barrelAdjustFps() {
    const b = state.barrel;
    if (state.mode === 'shotgun' || !b || !b.on || b.len == null) return 0;
    return Math.round((b.len - b.ref) * b.rate);
  }

  function showBarrel() {
    const b = state.barrel, cm = metric();
    el.barrelField.hidden = state.mode === 'shotgun';
    el.barrelOn.checked = b.on;
    el.barrelRow.hidden = el.barrelNote.hidden = !b.on;
    document.querySelectorAll('.b-len').forEach(s => { s.textContent = cm ? 'cm' : 'in'; });
    el.barrelRateUnit.textContent = cm ? 'm/s' : 'fps';
    const len = v => (cm ? +(v * 2.54).toFixed(1) : +v.toFixed(1));
    el.barrelLen.value = b.len == null ? '' : String(len(b.len));
    el.barrelRef.value = String(len(b.ref));
    el.barrelRate.value = String(cm ? +(b.rate * MPS_PER_CM_PER_FPS_PER_IN).toFixed(1) : b.rate);
    showBarrelNote();
  }

  function showBarrelNote() {
    const b = state.barrel, adj = barrelAdjustFps(), cm = metric();
    const lenTxt = v => (cm ? (v * 2.54).toFixed(1) + ' cm' : +v.toFixed(1) + ' in');
    const vTxt = v => (cm ? Math.round(Math.abs(v) * 0.3048) + ' m/s' : Math.abs(v) + ' fps');
    el.barrelNote.classList.toggle('adjusting', b.on && b.len != null && !state.custom && adj !== 0);
    if (b.len == null) el.barrelNote.textContent = `Enter your barrel length. Typical velocities assume a ${lenTxt(b.ref)} test barrel; about 25 fps per inch is a common rule of thumb, more for magnums.`;
    else if (state.custom) el.barrelNote.textContent = 'You entered your own velocity, so the barrel adjustment isn’t applied. Use typical values to apply it.';
    else if (adj === 0) el.barrelNote.textContent = `Your ${lenTxt(b.len)} barrel matches the test barrel; no adjustment.`;
    else el.barrelNote.textContent = `Velocity ${adj < 0 ? 'lowered' : 'raised'} by ${vTxt(adj)} for your ${lenTxt(b.len)} barrel (test barrel ${lenTxt(b.ref)}).`;
  }

  function barrelText() {
    const b = state.barrel, cm = metric();
    const lenTxt = v => (cm ? (v * 2.54).toFixed(1) + ' cm' : +v.toFixed(1) + ' in');
    const rate = cm ? (b.rate * MPS_PER_CM_PER_FPS_PER_IN).toFixed(1) + ' m/s per cm' : b.rate + ' fps per in';
    return `${lenTxt(b.len)} (test ${lenTxt(b.ref)}, ${rate})`;
  }

  function readBarrel() {
    const cm = metric(), toIn = v => (cm ? v / 2.54 : v);
    const len = parseFloat(el.barrelLen.value), ref = parseFloat(el.barrelRef.value), rate = parseFloat(el.barrelRate.value);
    state.barrel.len = len > 0 ? toIn(len) : null;
    if (ref > 0) state.barrel.ref = toIn(ref);
    if (rate >= 0) state.barrel.rate = cm ? rate / MPS_PER_CM_PER_FPS_PER_IN : rate;
  }

  function showLoad() {
    el.velocityUnit.textContent = metric() ? 'm/s' : 'fps';
    el.velocity.value = String(metric() ? BTS.roundHalfEven(state.vFps / FPS_PER_MPS) : state.vFps);
    el.bc.value = state.bc.toFixed(3);
    el.velocity.classList.toggle('custom', state.custom);
    el.bc.classList.toggle('custom', state.custom);
    el.resetLoad.hidden = !state.custom;
    el.loadNote.textContent = state.custom ? 'Using your values.'
      : barrelAdjustFps() ? 'Typical values for this load, adjusted for your barrel; enter your own if you know them.'
      : 'Typical values for this load; enter your own if you know them.';
    if (state.barrel) showBarrelNote();
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
    showBarrelNote();
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
        const nz = BTS.nearZero(state.vFps, state.bc, sightIn, sol.angle, zeroYd);
        r.nearZero = nz == null ? null : (metric() ? nz * BTS.METERS_PER_YARD : nz);
        r.table = trajectoryRows(sol.angle, sightIn, zero, zeroYd);
      }
    }
    state.result = r;
    return r;
  }

  // Table ranges in display units: every `step` out to `max`, a short first row when the step is longer, and the zero.
  // Returns at most TABLE_ROWS ranges; `cut` says the list was shortened.
  function tableRanges(zero) {
    const t = state.table[state.mode], short = TABLE_SHORT[state.mode], out = [];
    if (short < t.step) out.push(short);
    for (let d = t.step; d <= t.max + 1e-9; d += t.step) out.push(d);
    const all = Array.from(new Set(out.concat(zero))).sort((a, b) => a - b);
    const list = all.slice(0, TABLE_ROWS);
    if (!list.includes(zero)) list[list.length - 1] = zero;   // the zero row always shows
    return { list: list.sort((a, b) => a - b), cut: all.length > TABLE_ROWS };
  }

  // Wind from 1-5 o'clock comes from the right and pushes the bullet left; 7-11 o'clock pushes it right.
  // Only the crosswind part counts: full at 3 and 9 o'clock, none at 12 and 6.
  function windFactor() { return Math.abs(Math.sin(state.windClock * Math.PI / 6)); }
  function driftSide() {
    if (!state.windMph || state.windClock % 6 === 0) return '';
    return state.windClock < 6 ? 'left' : 'right';
  }

  function trajectoryRows(angle, sightIn, zero, zeroYd) {
    const ranges = tableRanges(zero), disp = ranges.list;
    state.tableCut = ranges.cut;
    const toYd = d => (metric() ? d / BTS.METERS_PER_YARD : d);
    const grains = state.lists.weights[idx(el.weight)].grains;
    const windMph = state.windMph * windFactor();
    return BTS.trajectoryTable(state.vFps, state.bc, sightIn, angle, disp.map(toYd)).map((p, i) => {
      const rangeYd = toYd(disp[i]), driftIn = BTS.windDriftIn(windMph, rangeYd, p.t, state.vFps);
      return {
        range: disp[i],
        rangeYd,
        zero: disp[i] === zero,
        path: metric() ? p.y * BTS.CM_PER_INCH : p.y,
        pathMoa: BTS.angleOf(p.y, rangeYd, 'moa'), pathMil: BTS.angleOf(p.y, rangeYd, 'mil'),
        drift: metric() ? driftIn * BTS.CM_PER_INCH : driftIn,
        driftMoa: BTS.angleOf(driftIn, rangeYd, 'moa'), driftMil: BTS.angleOf(driftIn, rangeYd, 'mil'),
        velocity: metric() ? p.v * 0.3048 : p.v,
        energy: metric() ? BTS.energyFtLb(grains, p.v) * 1.35582 : BTS.energyFtLb(grains, p.v),
        time: p.t
      };
    });
  }

  function trajectoryUnits() {
    return metric() ? { d: 'm', h: 'cm', v: 'm/s', e: 'J', w: 'km/h' } : { d: 'yd', h: 'in', v: 'fps', e: 'ft-lb', w: 'mph' };
  }

  // Crosswind in the displayed unit, for labels and the input.
  function windDisplay() {
    const v = metric() ? state.windMph * KMH_PER_MPH : state.windMph;
    return Math.round(v * 10) / 10;
  }

  // Shared by the page and the printed report: header cells and one row's cells (the first cell is the range).
  const signed = (v, digits) => (Math.abs(v) < 0.5 * Math.pow(10, -digits) ? (0).toFixed(digits) : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(digits));
  function windText(u) {
    const side = driftSide();
    return side ? `${windDisplay()} ${u.w} from ${state.windClock} o'clock` : 'no crosswind';
  }
  // The page shows the wind in the controls above the table, so its header only names the direction.
  function trajectoryHead(u, withWind) {
    const side = driftSide(), label = withWind ? `Drift${side ? ' ' + side : ''}, ${windText(u)}` : (side ? 'Drift ' + side : 'Drift (no crosswind)');
    return `<tr><th></th><th class="grp sep" colspan="3">Bullet vs. sight line</th><th class="grp sep" colspan="3">${label}</th><th class="sep" colspan="3"></th></tr>` +
      `<tr><th>Range (${u.d})</th><th class="sep">${u.h}</th><th>MOA</th><th>mil</th><th class="sep">${u.h}</th><th>MOA</th><th>mil</th>` +
      `<th class="sep">Velocity (${u.v})</th><th>Energy (${u.e})</th><th>Time (s)</th></tr>`;
  }
  function trajectoryCells(row, pathClass) {
    return `<td class="sep${pathClass}">${signed(row.path, 2)}</td><td>${signed(row.pathMoa, 1)}</td><td>${signed(row.pathMil, 2)}</td>` +
      `<td class="sep">${row.drift.toFixed(2)}</td><td>${row.driftMoa.toFixed(1)}</td><td>${row.driftMil.toFixed(2)}</td>` +
      `<td class="sep">${Math.round(row.velocity)}</td><td>${Math.round(row.energy)}</td><td>${row.time.toFixed(3)}</td>`;
  }

  function renderTable() {
    const r = state.result, u = trajectoryUnits();
    let h = `<thead>${trajectoryHead(u)}</thead><tbody>`;
    r.table.forEach(row => {
      const cls = row.path > 0.005 ? ' up' : row.path < -0.005 ? ' down' : '';
      h += `<tr${row.zero ? ' class="zero-row"' : ''}><td>${row.range}${row.zero ? ' <span class="tag">zero</span>' : ''}</td>${trajectoryCells(row, cls)}</tr>`;
    });
    el.trajTable.innerHTML = h + '</tbody>';
    el.trajNote.textContent = (r.nearZero != null ? `Near zero ${r.nearZero.toFixed(1)} ${u.d} · ` : '') + `Max rise ${riseText(r.rise)}`;
    el.trajHint.textContent = (state.tableCut ? `Showing the first ${TABLE_ROWS} ranges; choose a longer step to see farther. ` : '') +
      'MOA and mil are from the line of sight. 3 and 9 o\'clock winds push the bullet the most; 12 and 6 o\'clock winds don\'t push it sideways.';
  }

  // Shows the crosswind and table extent in the current units (the wind is stored in mph).
  function showWind() {
    const u = trajectoryUnits(), t = state.table[state.mode];
    el.windUnit.textContent = u.w;
    if (document.activeElement !== el.wind) el.wind.value = String(windDisplay());
    el.windClock.value = String(state.windClock);
    document.querySelectorAll('.t-dist').forEach(s => { s.textContent = u.d; });
    if (document.activeElement !== el.tMax) el.tMax.value = String(t.max);
    el.tStep.value = String(t.step);
  }

  // ---------- Click calculator ----------

  function updateClicks() {
    const u = trajectoryUnits();
    document.querySelectorAll('.c-dist').forEach(s => { s.textContent = u.d; });
    document.querySelectorAll('.c-len').forEach(s => { s.textContent = metric() ? 'cm' : 'in'; });
    const [unit, value] = el.cClick.value.split(':');
    const click = { unit, value: Number(value) };
    const range = parseFloat(el.cRange.value);
    const toIn = v => (metric() ? v / BTS.CM_PER_INCH : v);
    const rangeYd = metric() ? range / BTS.METERS_PER_YARD : range;
    const show = (outEl, subEl, amount, dirOff, dirMove) => {
      const v = amount === '' ? 0 : parseFloat(amount);
      if (!(range > 0) || !(v >= 0)) { outEl.textContent = '–'; subEl.textContent = 'Enter the shot distance and offset'; return; }
      const c = BTS.clicks(toIn(v), rangeYd, click);
      if (c.clicks === 0) { outEl.textContent = 'No change'; subEl.textContent = v > 0 ? 'Less than half a click' : ''; return; }
      outEl.innerHTML = `${c.clicks} click${c.clicks === 1 ? '' : 's'} <b>${dirMove}</b>`;
      subEl.textContent = `${c.angle.toFixed(2)} ${unit === 'mil' ? 'mil' : 'MOA'} · group is ${v} ${metric() ? 'cm' : 'in'} ${dirOff}`;
    };
    show(el.cElev, el.cElevSub, el.cVert.value, el.cVdir.value, el.cVdir.value === 'low' ? 'UP' : 'DOWN');
    show(el.cWind, el.cWindSub, el.cHoriz.value, el.cHdir.value, el.cHdir.value === 'left' ? 'RIGHT' : 'LEFT');
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
    el.printTarget.disabled = el.printReport.disabled = el.printSightin.disabled = el.printCard.disabled = !ok;
    document.getElementById('traj-card').hidden = !ok;
    // The calculator's shot distance follows the zero range until the user types their own.
    if (!el.cRange.dataset.edited) el.cRange.value = String(r.zero);
    updateClicks();
    if (!ok) { el.chart.innerHTML = ''; syncUrl(); return; }
    buildTargets(keepTarget);
    el.meet.textContent = r.meet.toFixed(1);
    el.meetUnit.textContent = metric() ? 'm' : 'yd';
    el.maxRise.textContent = 'Max rise ' + riseText(r.rise);
    showWind();
    renderTable();
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
  //   b + 2+2+2   optional: barrel length and test barrel length (tenths of an inch), change per inch (fps)
  const SHARE_RE = /^#([12])([0-9a-n])([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})([0-9a-z])([0-9a-z])([0-9a-z]{2})(?:([0-9a-z]{3})([0-9a-z]{3}))?(?:b([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2}))?$/;
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
    const b = state.barrel;
    if (b && b.on && b.len != null && state.mode !== 'shotgun') code += 'b' + b36(b.len * 10, 2) + b36(b.ref * 10, 2) + b36(b.rate, 2);
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
    resetBarrel();
    if (m[10]) state.barrel = { on: true, len: n(m[10]) / 10, ref: n(m[11]) / 10 || state.barrel.ref, rate: n(m[12]) };
    showBarrel();
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
      ['Muzzle velocity', v + (state.custom ? '' : barrelAdjustFps() ? ' (typical, adjusted for barrel)' : ' (typical)')],
      ...(barrelAdjustFps() || (state.barrel && state.barrel.on && state.barrel.len != null && state.mode !== 'shotgun') ? [['Barrel length', barrelText()]] : []),
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
    // Light grid through the aim point: 1 in squares (1 cm in metric) for reading offsets.
    s += gridLines(cx, aimY, metric() ? 1 / 2.54 : 1, 0.45, 1.25, W - 0.45, fy - 0.45, '#d3d8de', 0.008);
    // Aim point crosshair (the sight goes here).
    s += `<line x1="0.45" y1="${aimY}" x2="${W - 0.45}" y2="${aimY}" ${dash}/>`;
    s += `<line x1="${cx}" y1="0.85" x2="${cx}" y2="${fy - 0.4}" ${dash}/>`;
    s += `<circle cx="${cx}" cy="${aimY}" r="0.05" fill="#000"/>`;
    s += `<text x="${cx + 0.14}" y="${aimY - 0.12}" font-size="0.12" font-weight="700">AIM</text>`;
    // Laser spot (the boresighter's dot goes here).
    s += `<circle cx="${cx}" cy="${laserY}" r="${R}" fill="#fff" stroke="#000" stroke-width="0.13"/>`;
    s += `<circle cx="${cx}" cy="${laserY}" r="0.075" fill="none" stroke="#000" stroke-width="0.035"/>`;
    s += `<text x="${cx}" y="${laserY - 0.13}" text-anchor="middle" font-size="0.085" font-weight="700" letter-spacing="0.01">LASER</text>`;
    // QR code to reopen this setup, in the empty lower-left corner above the footer.
    const qs = 1.0, qy = fy - 0.45 - qs;
    s += qrCode(0.45, qy, qs);
    s += `<text x="${0.45 + qs + 0.05}" y="${qy + qs / 2 - 0.04}" font-size="0.1" fill="#555">Scan to open</text><text x="${0.45 + qs + 0.05}" y="${qy + qs / 2 + 0.1}" font-size="0.1" fill="#555">this setup</text>`;
    // Footer: placement line across the page, then instructions and scale check (left) and settings (right).
    s += `<line x1="0.5" y1="${fy - 0.3}" x2="${W - 0.5}" y2="${fy - 0.3}" stroke="#bbb" stroke-width="0.01"/>`;
    s += `<text x="${W / 2}" y="${fy}" text-anchor="middle" font-size="0.2" font-weight="700">Place this target ${range} ${unitD} from the muzzle.</text>`;
    const ly = fy + 0.42;
    s += `<text x="0.5" y="${ly}" font-size="0.12" font-weight="700">${esc(offsetSentence(t))}</text>`;
    s += `<text x="0.5" y="${ly + 0.22}" font-size="0.11" fill="#333">Put the laser in the circle, then adjust the sight to the crosshair.</text>`;
    s += `<text x="0.5" y="${ly + 0.4}" font-size="0.11" fill="#333">A dim room or shaded target makes the laser easier to see.</text>`;
    s += scaleBars(0.5, ly + 0.8);
    const rows = settingsRows().filter(rw => rw[0] !== 'Meet distance' && rw[0] !== 'Maximum rise');
    rows.push(['Printed', new Date().toLocaleString()]);
    rows.forEach((rw, i) => {
      s += `<text x="${W - 0.5}" y="${ly + i * 0.152}" text-anchor="end" font-size="0.105"><tspan fill="#555">${esc(rw[0])}:</tspan> ${esc(rw[1])}</text>`;
    });
    s += `</svg>`;
    return `<div class="sheet">${s}</div>`;
  }

  // Link to this exact setup for the QR codes. Opened from disk, the code points at the published site instead.
  const PUBLIC_URL = 'https://bca3244.github.io/boresight-target/';
  function setupUrl() {
    const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : PUBLIC_URL;
    return base + '#' + shareCode();
  }

  // QR code of setupUrl() as SVG elements: a white square of side `size` at (x, y), quiet zone included.
  function qrCode(x, y, size) {
    const q = qrcode(0, 'M');
    q.addData(setupUrl());
    q.make();
    const n = q.getModuleCount(), quiet = 4, m = size / (n + 2 * quiet);
    let d = '';
    for (let row = 0; row < n; row++) {
      // One rectangle per run of dark modules keeps the path short.
      for (let c = 0; c < n; c++) {
        if (!q.isDark(row, c)) continue;
        let run = 1;
        while (c + run < n && q.isDark(row, c + run)) run++;
        d += `M${(x + (c + quiet) * m).toFixed(4)} ${(y + (row + quiet) * m).toFixed(4)}h${(run * m).toFixed(4)}v${m.toFixed(4)}h-${(run * m).toFixed(4)}z`;
        c += run - 1;
      }
    }
    return `<rect class="qr" x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000" shape-rendering="crispEdges"/>`;
  }

  // Grid lines every `step` inches through (cx, cy), clipped to the box x0..x1, y0..y1. Inches are the SVG unit.
  function gridLines(cx, cy, step, x0, y0, x1, y1, color, width) {
    let g = `<g stroke="${color}" stroke-width="${width}">`;
    for (let x = cx - Math.floor((cx - x0) / step) * step; x <= x1 + 1e-9; x += step) g += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`;
    for (let y = cy - Math.floor((cy - y0) / step) * step; y <= y1 + 1e-9; y += step) g += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
    return g + '</g>';
  }

  // 1 in and 5 cm bars for checking the printer kept true scale.
  function scaleBars(x, y) {
    const cm5 = 5 / 2.54, b = x + 1.4;
    let s = `<text x="${x}" y="${y}" font-size="0.105" font-weight="700">Scale check: these bars must measure exactly 1 in and 5 cm.</text>`;
    s += `<g stroke="#000" stroke-width="0.02"><line x1="${x}" y1="${y + 0.3}" x2="${x + 1}" y2="${y + 0.3}" stroke-width="0.05"/><line x1="${x}" y1="${y + 0.18}" x2="${x}" y2="${y + 0.42}"/><line x1="${x + 1}" y1="${y + 0.18}" x2="${x + 1}" y2="${y + 0.42}"/>`;
    s += `<line x1="${b}" y1="${y + 0.3}" x2="${b + cm5}" y2="${y + 0.3}" stroke-width="0.05"/><line x1="${b}" y1="${y + 0.18}" x2="${b}" y2="${y + 0.42}"/><line x1="${b + cm5}" y1="${y + 0.18}" x2="${b + cm5}" y2="${y + 0.42}"/></g>`;
    s += `<text x="${x + 0.5}" y="${y + 0.58}" text-anchor="middle" font-size="0.1">1 in</text><text x="${b + cm5 / 2}" y="${y + 0.58}" text-anchor="middle" font-size="0.1">5 cm</text>`;
    return s;
  }

  // Sight-in target for the first shots at the zero range: grid squares (1 in, or 1 cm in metric) around a center diamond.
  function sightinSheet(paper) {
    const W = paper.w, H = paper.h, r = state.result;
    const step = metric() ? 1 / 2.54 : 1, unitL = metric() ? 'cm' : 'in', unitD = metric() ? 'm' : 'yd';
    const x0 = 0.5, x1 = W - 0.5, y0 = 1.25, y1 = H - 2.35, cx = W / 2, cy = (y0 + y1) / 2;
    // What one click and one MOA / mil measure at the zero range, in squares.
    const zeroYd = r.zeroYd, moaIn = 1.0472 * zeroYd / 100, milIn = 3.6 * zeroYd / 100;
    const fmtL = inches => (metric() ? (inches * 2.54).toFixed(2) + ' cm' : inches.toFixed(2) + ' in');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}in" height="${H}in" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif">`;
    s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
    s += `<text x="${W / 2}" y="0.62" text-anchor="middle" font-size="0.22" font-weight="700">Sight-in target · shoot from ${r.zero} ${unitD}</text>`;
    s += `<text x="${W / 2}" y="0.9" text-anchor="middle" font-size="0.12" fill="#555">${esc(BTS.calibers(state.mode)[idx(el.caliber)])} · squares are 1 ${unitL}</text>`;
    s += qrCode(x1 - 0.82, 0.22, 0.82);   // top-right corner, clear of the title and the square counts
    s += gridLines(cx, cy, step, x0, y0, x1, y1, '#b9c1cb', 0.012);
    // Every 5th line and the center lines darker, so squares are easy to count.
    s += gridLines(cx, cy, step * 5, x0, y0, x1, y1, '#6e7a88', 0.02);
    s += `<line x1="${x0}" y1="${cy}" x2="${x1}" y2="${cy}" stroke="#000" stroke-width="0.03"/><line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" stroke="#000" stroke-width="0.03"/>`;
    s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#000" stroke-width="0.03"/>`;
    // Square counts along the top and left edges.
    for (let k = 5; cx + k * step <= x1 + 1e-9; k += 5) {
      s += `<text x="${cx + k * step}" y="${y0 - 0.08}" text-anchor="middle" font-size="0.11" fill="#444">${k}</text><text x="${cx - k * step}" y="${y0 - 0.08}" text-anchor="middle" font-size="0.11" fill="#444">${k}</text>`;
    }
    for (let k = 5; cy + k * step <= y1 + 1e-9; k += 5) {
      s += `<text x="${x0 - 0.08}" y="${cy + k * step + 0.04}" text-anchor="end" font-size="0.11" fill="#444">${k}</text><text x="${x0 - 0.08}" y="${cy - k * step + 0.04}" text-anchor="end" font-size="0.11" fill="#444">${k}</text>`;
    }
    // Center diamond with a small white square to aim at.
    const d = 0.5;
    s += `<path d="M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z" fill="#000"/>`;
    s += `<rect x="${cx - 0.07}" y="${cy - 0.07}" width="0.14" height="0.14" fill="#fff"/>`;
    s += `<text x="${x0 + 0.1}" y="${y0 + 0.25}" font-size="0.2" font-weight="700">TOP</text>`;
    // Footer.
    const fy = y1 + 0.45;
    s += `<text x="0.5" y="${fy}" font-size="0.13" font-weight="700">Aim at the diamond. Count how many squares the group's center is from it, up/down and left/right,</text>`;
    s += `<text x="0.5" y="${fy + 0.2}" font-size="0.13" font-weight="700">then enter those distances in "Adjust after your first shots".</text>`;
    s += `<text x="0.5" y="${fy + 0.48}" font-size="0.115" fill="#333">At ${r.zero} ${unitD}: 1 MOA = ${fmtL(moaIn)} · ¼ MOA click = ${fmtL(moaIn / 4)} · 0.1 mil click = ${fmtL(milIn / 10)}</text>`;
    s += scaleBars(0.5, fy + 0.85);
    const info = [['Zero range', r.zero + ' ' + unitD], ['Sight height', r.sight.value.toFixed(1) + (metric() ? ' cm' : ' in')],
      ['Bullet', state.lists.weights[idx(el.weight)].label + ' ' + state.lists.shapes[idx(el.shape)].label], ['Printed', new Date().toLocaleString()]];
    info.forEach((rw, i) => { s += `<text x="${W - 0.5}" y="${fy + 0.85 + i * 0.16}" text-anchor="end" font-size="0.105"><tspan fill="#555">${esc(rw[0])}:</tspan> ${esc(rw[1])}</text>`; });
    s += `</svg>`;
    return `<div class="sheet">${s}</div>`;
  }

  // Range card: scope clicks for each table range on a card to cut out (3 x 5 in, or 4 x 6 in for long tables).
  function cardSheet(paper) {
    const r = state.result, u = trajectoryUnits(), rows = r.table;
    const [unit, value] = el.cClick.value.split(':'), click = Number(value), uName = unit === 'mil' ? 'mil' : 'MOA';
    const clickLabel = el.cClick.selectedOptions[0] ? el.cClick.selectedOptions[0].textContent : value + ' ' + uName;
    const big = rows.length > 14, cols = rows.length > 20 ? 2 : 1;
    const CW = big ? 6 : 5, CH = big ? 4 : 3, x0 = 0.5, y0 = 0.5, pad = 0.16;
    const w = state.lists.weights[idx(el.weight)], s = state.lists.shapes[idx(el.shape)];
    const v = metric() ? BTS.roundHalfEven(r.vFps / FPS_PER_MPS) + ' m/s' : BTS.roundHalfEven(r.vFps) + ' fps';
    const side = driftSide(), dialWind = side === 'left' ? 'R' : 'L';
    let g = `<rect x="${x0}" y="${y0}" width="${CW}" height="${CH}" fill="#fff" stroke="#888" stroke-width="0.01" stroke-dasharray="0.08 0.05"/>`;
    const tx = x0 + pad, tw = CW - 2 * pad;
    g += `<text x="${tx}" y="${y0 + pad + 0.11}" font-size="0.13" font-weight="700">${esc(BTS.calibers(state.mode)[idx(el.caliber)])}</text>`;
    g += `<text x="${tx + tw}" y="${y0 + pad + 0.11}" text-anchor="end" font-size="0.085" fill="#444">Zero ${r.zero} ${u.d} · sight ${r.sight.value.toFixed(1)} ${metric() ? 'cm' : 'in'}</text>`;
    g += `<text x="${tx}" y="${y0 + pad + 0.26}" font-size="0.085" fill="#333">${esc(w.label + ' ' + s.label)} · ${v} · G1 B.C. ${r.bc.toFixed(3)}</text>`;
    g += `<text x="${tx}" y="${y0 + pad + 0.39}" font-size="0.085" fill="#333">Clicks to dial at ${esc(clickLabel)} · wind ${esc(windText(u))}</text>`;
    // Table: range, elevation (clicks and angle), windage (clicks and angle), one or two column groups.
    const top = y0 + pad + 0.58, bottom = y0 + CH - pad - 0.08, perCol = Math.ceil(rows.length / cols);
    const rowH = Math.min(0.2, (bottom - top - 0.2) / perCol), fs = Math.min(0.105, rowH * 0.62);
    const gw = Math.min(4.7, (tw - (cols - 1) * 0.2) / cols);   // a single column doesn't spread across a wide card
    const cx = [0.13, 0.42, 0.62, 0.84, 1].map(f => f * gw);   // right edges of the columns, as fractions of a group
    const clicksOf = (angle, dirs) => {
      const n = Math.round(Math.abs(angle) / click);
      return n === 0 ? '0' : n + ' ' + (angle < 0 ? dirs[0] : dirs[1]);
    };
    for (let c = 0; c < cols; c++) {
      const gx = tx + c * (gw + 0.2), part = rows.slice(c * perCol, (c + 1) * perCol);
      const head = [`${u.d}`, 'Elev', uName, 'Wind', uName];
      head.forEach((h, i) => { g += `<text x="${i === 0 ? gx : gx + cx[i]}" y="${top + 0.1}" text-anchor="${i === 0 ? 'start' : 'end'}" font-size="${fs * 0.9}" font-weight="700" fill="#555">${h}</text>`; });
      g += `<line x1="${gx}" y1="${top + 0.15}" x2="${gx + gw}" y2="${top + 0.15}" stroke="#999" stroke-width="0.008"/>`;
      part.forEach((row, k) => {
        const y = top + 0.15 + (k + 1) * rowH - rowH * 0.28;
        if (row.zero) g += `<rect x="${gx}" y="${top + 0.15 + k * rowH}" width="${gw}" height="${rowH}" fill="#e8f6f3"/>`;
        else if (k % 2) g += `<rect x="${gx}" y="${top + 0.15 + k * rowH}" width="${gw}" height="${rowH}" fill="#f4f6f8"/>`;
        const pathA = unit === 'mil' ? row.pathMil : row.pathMoa, driftA = unit === 'mil' ? row.driftMil : row.driftMoa;
        // Bullet low (negative) means dial up; drift to one side means dial the other way.
        const cells = [String(row.range), clicksOf(pathA, ['U', 'D']), Math.abs(pathA).toFixed(unit === 'mil' ? 2 : 1),
          side ? clicksOf(driftA, [dialWind, dialWind]) : '0', Math.abs(driftA).toFixed(unit === 'mil' ? 2 : 1)];
        cells.forEach((t, i) => { g += `<text x="${i === 0 ? gx + 0.03 : gx + cx[i]}" y="${y}" text-anchor="${i === 0 ? 'start' : 'end'}" font-size="${fs}"${row.zero ? ' font-weight="700"' : ''}>${t}</text>`; });
      });
    }
    g += `<text x="${tx}" y="${y0 + CH - pad + 0.02}" font-size="0.07" fill="#666">U/D = dial up/down, L/R = dial left/right. Standard atmosphere; confirm with live fire.</text>`;
    return `<div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" width="${paper.w}in" height="${paper.h}in" viewBox="0 0 ${paper.w} ${paper.h}" font-family="Arial, Helvetica, sans-serif">` +
      `<rect width="${paper.w}" height="${paper.h}" fill="#fff"/>${g}` +
      `<text x="${x0}" y="${y0 + CH + 0.3}" font-size="0.11" fill="#555">Cut along the dashed line (${CW} × ${CH} in). Print at 100% / Actual size.</text></svg></div>`;
  }

  function reportSheet(paper) {
    const r = state.result, u = trajectoryUnits();
    const light = { grid: '#d9dee5', axis: '#5f6b7a', tick: '#444', title: '#222', los: '#1f6fe5', path: '#b07d0b', laser: '#e0283d', accent: '#0f9d8a', bg: '#fff' };
    // The report always shows the full zero range so the maximum rise is on the chart.
    const saved = state.plot; state.plot = 'full';
    const chart = chartSVG(chartData(), 680, 185, light, false).svg;
    state.plot = saved;
    // Settings in two side-by-side tables to leave room for the trajectory table.
    const all = settingsRows().concat(r.nearZero != null ? [['Near zero', r.nearZero.toFixed(1) + ' ' + u.d]] : []);
    const half = Math.ceil(all.length / 2);
    const tbl = list => `<table>${list.map(rw => `<tr><th>${esc(rw[0])}</th><td>${esc(rw[1])}</td></tr>`).join('')}</table>`;
    const rows = `<div class="report-cols">${tbl(all.slice(0, half))}${tbl(all.slice(half))}</div>`;
    // Up to REPORT_ROWS ranges fit under the chart; a longer table goes on a second page.
    const REPORT_ROWS = 9, second = r.table.length > REPORT_ROWS;
    const traj = `<table class="report-traj${r.table.length > 24 ? ' dense' : ''}">${trajectoryHead(u, true)}` +
      r.table.map(row => `<tr${row.zero ? ' class="zero-row"' : ''}><td>${row.range}${row.zero ? ' (zero)' : ''}</td>${trajectoryCells(row, '')}</tr>`).join('') + '</table>';
    const unitD = u.d;
    const footer = `<footer>G1 point-mass model, standard atmosphere (59 °F, 29.53 inHg). Printed ${esc(new Date().toLocaleString())}. Confirm your zero with live fire.</footer>`;
    const page2 = !second ? '' : `<div class="sheet report" style="width:${paper.w}in;height:${paper.h}in">
      <header><div><h1>Boresight Report · trajectory</h1><p>${esc(BTS.calibers(state.mode)[idx(el.caliber)])} · zeroed at ${r.zero} ${unitD} · ${esc(state.lists.weights[idx(el.weight)].label)} ${esc(state.lists.shapes[idx(el.shape)].label)}</p></div></header>
      ${traj}
      <p class="report-note">MOA and mil are from the line of sight. Drift is for ${esc(windText(u))}.</p>
      ${footer}
    </div>`;
    return `<div class="sheet report" style="width:${paper.w}in;height:${paper.h}in">
      <header><svg viewBox="0 0 32 32" width="34" height="34"><circle cx="16" cy="16" r="11" fill="none" stroke="#0f9d8a" stroke-width="2.5"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="#0f9d8a" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="#e0283d"/></svg>
      <div><h1>Boresight Report</h1><p>${esc(BTS.calibers(state.mode)[idx(el.caliber)])} · zeroed at ${r.zero} ${unitD}</p></div>
      <div class="report-qr"><span>Scan to open<br>this setup</span><svg viewBox="0 0 1 1" width="0.8in" height="0.8in">${qrCode(0, 0, 1)}</svg></div></header>
      <p class="report-meet">Line of sight and laser beam meet at <strong>${r.meet.toFixed(1)} ${unitD}</strong></p>
      <div class="report-chart">${chart}</div>
      <p class="report-legend"><span style="color:#1f6fe5">━ Line of sight</span><span style="color:#b07d0b">━ Bullet path</span><span style="color:#e0283d">━ Laser beam</span></p>
      ${rows}
      <h2>Trajectory</h2>
      ${second ? `<p>The trajectory table (${r.table.length} ranges, out to ${r.table[r.table.length - 1].range} ${unitD}) is on page 2.</p>` : traj}
      <h2>Aligning the sight at the meet distance</h2>
      <ul>
        <li><strong>Scope:</strong> center the crosshair on the laser spot.</li>
        <li><strong>Open sights:</strong> hold the laser spot just on top of the front post, level with the rear notch.</li>
        <li><strong>Red dot or holographic:</strong> put the dot on the laser spot.</li>
      </ul>
      ${footer}
    </div>${page2}`;
  }

  function print(kind) {
    if (!state.result || state.result.error) return;
    const paper = PAPER[state.paper];
    let style = document.getElementById('page-size');
    if (!style) { style = document.createElement('style'); style.id = 'page-size'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${paper.css}; margin: 0; }`;
    el.printRoot.innerHTML = SHEETS[kind](paper);
    window.print();
  }
  const SHEETS = { target: targetSheet, report: reportSheet, sightin: sightinSheet, card: cardSheet };
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
    resetBarrel();   // a rifle barrel length makes no sense for a pistol, and vice versa
    showBarrel();
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
    // Click calculator: convert the measured offsets, and let the shot distance follow the zero again.
    const f = units === 'metric' ? BTS.CM_PER_INCH : 1 / BTS.CM_PER_INCH;
    [el.cVert, el.cHoriz].forEach(i => { const v = parseFloat(i.value); if (v > 0) i.value = String(Math.round(v * f * 10) / 10); });
    delete el.cRange.dataset.edited;
    buildSights(sightIn);
    buildWeights(grains);
    buildShapes(shape);
    buildZeros(zero);
    showBarrel();   // stored in inches, so only the display changes
    if (keepLoad) { state.vFps = keepLoad.v; state.bc = keepLoad.bc; state.custom = true; showLoad(); } else setTypicalLoad();
    render();
  }

  // Crosswind for the drift columns: a per-viewer preference, not part of the link. Blank means no wind.
  el.wind.addEventListener('input', () => {
    const v = el.wind.value === '' ? 0 : parseFloat(el.wind.value);
    if (!(v >= 0 && v < 1000)) return;
    state.windMph = metric() ? v / KMH_PER_MPH : v;
    savePref('wind', String(state.windMph));
    refreshTable();
  });
  el.wind.addEventListener('blur', showWind);
  for (let h = 1; h <= 12; h++) {
    const o = document.createElement('option');
    o.value = String(h); o.textContent = h + " o'clock";
    el.windClock.appendChild(o);
  }
  el.windClock.addEventListener('change', () => {
    state.windClock = Number(el.windClock.value);
    savePref('windclock', String(state.windClock));
    refreshTable();
  });
  // Table extent, remembered per firearm type.
  function setTable(max, step) {
    const t = state.table[state.mode];
    if (max != null) t.max = max;
    if (step != null) t.step = step;
    savePref('table.' + state.mode, t.max + ':' + t.step);
    refreshTable();
  }
  el.tMax.addEventListener('input', () => {
    const v = parseFloat(el.tMax.value);
    if (v >= 10 && v <= TABLE_MAX) setTable(v, null);
  });
  el.tMax.addEventListener('blur', showWind);
  el.tStep.addEventListener('change', () => setTable(null, Number(el.tStep.value)));
  el.printCard.addEventListener('click', () => print('card'));

  // Rebuilds only the trajectory table (wind and table settings don't change the boresight solution).
  function refreshTable() {
    const r = state.result;
    if (r && !r.error) { r.table = trajectoryRows(r.angle, r.sightIn, r.zero, r.zeroYd); renderTable(); }
  }

  el.barrelOn.addEventListener('change', () => {
    state.barrel.on = el.barrelOn.checked;
    if (state.barrel.on) {
      // Fill the defaults back in if they were cleared, then start on "your barrel".
      if (!(parseFloat(el.barrelRef.value) > 0)) state.barrel.ref = BARREL_REF_IN[state.mode] || 24;
      if (!(parseFloat(el.barrelRate.value) >= 0)) state.barrel.rate = BARREL_RATE_FPS_PER_IN;
    }
    showBarrel();
    if (state.barrel.on) el.barrelLen.focus();
    if (!state.custom) setTypicalLoad();
    render(keepTargetValue());
  });
  [el.barrelLen, el.barrelRef, el.barrelRate].forEach(i => i.addEventListener('input', () => {
    readBarrel();
    if (!state.custom) setTypicalLoad(); else showBarrelNote();
    render(keepTargetValue());
  }));

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => changeMode(b.dataset.mode)));
  document.querySelectorAll('[data-units]').forEach(b => b.addEventListener('click', () => changeUnits(b.dataset.units)));
  document.querySelectorAll('[data-plot]').forEach(b => b.addEventListener('click', () => {
    state.plot = b.dataset.plot; savePref('plot', state.plot);
    setPressed('[data-plot]', 'data-plot', state.plot);
    if (state.result && !state.result.error) drawChart();
    syncUrl();
  }));

  function onCaliberChange() {
    buildWeights(null);
    buildShapes(state.lists.shapes[idx(el.shape)] && state.lists.shapes[idx(el.shape)].label);
    setTypicalLoad();
    render();
  }
  el.caliber.addEventListener('change', onCaliberChange);
  // Searching narrows the caliber list; if the current caliber drops out, the first match is selected.
  el.caliberSearch.addEventListener('input', () => {
    const before = idx(el.caliber);
    fillCalibers(before, el.caliberSearch.value);
    if (idx(el.caliber) !== before) onCaliberChange();
  });
  el.caliberSearch.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el.caliberSearch.value) { el.caliberSearch.value = ''; fillCalibers(idx(el.caliber), ''); e.stopPropagation(); }
    if (e.key === 'Enter') { e.preventDefault(); el.caliber.focus(); }
  });
  el.sight.addEventListener('change', () => render(keepTargetValue()));
  el.weight.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.shape.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.zero.addEventListener('change', () => { delete el.cRange.dataset.edited; render(keepTargetValue()); });

  // Click calculator inputs.
  el.cClick.value = loadPref('click', 'moa:0.25');
  if (!el.cClick.value) el.cClick.value = 'moa:0.25';
  el.cRange.addEventListener('input', () => { el.cRange.dataset.edited = '1'; updateClicks(); });
  [el.cVert, el.cHoriz, el.cVdir, el.cHdir].forEach(i => i.addEventListener('input', updateClicks));
  el.cClick.addEventListener('change', () => { savePref('click', el.cClick.value); updateClicks(); });

  el.printSightin.addEventListener('click', () => print('sightin'));

  // ---------- My setups: named share codes kept in this browser ----------
  function readSaved() {
    try { const v = JSON.parse(localStorage.getItem('bts.saved') || '[]'); return Array.isArray(v) ? v.filter(s => s && s.name && s.code) : []; }
    catch (e) { return null; }   // null = storage unavailable
  }
  function writeSaved(list) {
    try { localStorage.setItem('bts.saved', JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function renderSaved(selectName) {
    const list = readSaved();
    const available = list !== null;
    el.savedList.innerHTML = '';
    (list || []).slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
      const o = document.createElement('option');
      o.value = s.name; o.textContent = s.name;
      el.savedList.appendChild(o);
    });
    if (!list || !list.length) {
      const o = document.createElement('option');
      o.textContent = available ? 'No saved setups yet' : 'Saving is not available in this browser';
      o.value = ''; el.savedList.appendChild(o);
    }
    if (selectName) el.savedList.value = selectName;
    const has = !!(list && list.length);
    el.savedList.disabled = el.savedLoad.disabled = el.savedDelete.disabled = !has;
    el.savedSave.disabled = el.savedName.disabled = !available;
    el.savedCount.textContent = has ? String(list.length) : '';
    if (!available) el.savedNote.textContent = 'This browser is blocking site storage, so setups can’t be saved here. Copy link still works.';
  }
  function suggestedName() {
    return BTS.calibers(state.mode)[idx(el.caliber)] + ' · ' + state.lists.weights[idx(el.weight)].label + ' · ' +
      state.lists.zeros[idx(el.zero)] + (metric() ? ' m' : ' yd') + ' zero';
  }
  el.savedSave.addEventListener('click', () => {
    const list = readSaved();
    if (list === null) return;
    const name = (el.savedName.value.trim() || suggestedName()).slice(0, 60);
    const code = shareCode(), existing = list.find(s => s.name === name);
    if (existing) existing.code = code; else list.push({ name, code });
    if (!writeSaved(list)) { toast('Couldn’t save in this browser'); return; }
    el.savedName.value = '';
    renderSaved(name);
    toast(existing ? `Updated “${name}”` : `Saved “${name}”`);
  });
  el.savedName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.savedSave.click(); } });
  el.savedName.addEventListener('focus', () => { el.savedName.placeholder = suggestedName(); });
  el.savedLoad.addEventListener('click', () => {
    const s = (readSaved() || []).find(x => x.name === el.savedList.value);
    if (s && applyShareCode('#' + s.code)) toast(`Opened “${s.name}”`);
  });
  el.savedList.addEventListener('dblclick', () => el.savedLoad.click());
  el.savedDelete.addEventListener('click', () => {
    const name = el.savedList.value, list = readSaved();
    if (!name || !list || !window.confirm(`Delete the saved setup “${name}”?`)) return;
    writeSaved(list.filter(s => s.name !== name));
    renderSaved();
    toast(`Deleted “${name}”`);
  });
  el.savedCard.open = loadPref('savedOpen', 'closed') === 'open';
  el.savedCard.addEventListener('toggle', () => savePref('savedOpen', el.savedCard.open ? 'open' : 'closed'));
  renderSaved();
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
    // Maximizing a collapsed chart opens it first.
    if (on && el.chartCard.classList.contains('collapsed')) el.chartCard.querySelector('.fold-btn').click();
    el.chartCard.classList.toggle('maximized', on);
    document.body.classList.toggle('chart-open', on);
    el.chartZoom.setAttribute('aria-pressed', String(on));
    el.chartZoom.setAttribute('aria-label', on ? 'Restore chart' : 'Maximize chart');
    el.chartZoom.title = on ? 'Restore chart (Esc)' : 'Maximize chart';
    if (state.result && !state.result.error) drawChart();
  }
  el.chartZoom.addEventListener('click', () => setChartMax(!el.chartCard.classList.contains('maximized')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.chartCard.classList.contains('maximized')) setChartMax(false); });

  // Collapsible cards: the first child is the header; everything after it is wrapped in a body that hides.
  // Clicking the title or the chevron toggles it (other controls in the header keep working), and each card remembers its state.
  document.querySelectorAll('[data-collapse]').forEach(card => {
    const key = card.dataset.collapse, head = card.firstElementChild;
    const body = document.createElement('div');
    body.className = 'card-body';
    while (head.nextSibling) body.appendChild(head.nextSibling);
    card.appendChild(body);
    head.classList.add('card-head');
    const title = head.matches('h2') ? head : head.querySelector('h2');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fold-btn';
    btn.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    btn.setAttribute('aria-label', 'Collapse ' + title.textContent.trim());
    // Headers that already hold tools (the chart) get the chevron at the end of the tools.
    (head.querySelector('.chart-tools') || head).appendChild(btn);
    const set = (open, save) => {
      card.classList.toggle('collapsed', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + title.textContent.trim());
      if (save) savePref('fold.' + key, open ? 'open' : 'closed');
      // A chart drawn while hidden has no size; redraw once it's visible again.
      if (open && key === 'chart' && state.result && !state.result.error) drawChart();
    };
    btn.addEventListener('click', () => set(card.classList.contains('collapsed'), true));
    title.classList.add('fold-title');
    title.addEventListener('click', e => { if (!e.target.closest('.fold-btn')) btn.click(); });
    set(loadPref('fold.' + key, 'open') !== 'closed', false);
  });

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
    resetBarrel();
    showBarrel();
    setTypicalLoad();
    render();
  }

  // index.html#preview-target or #preview-report shows a printable sheet on screen.
  // An optional @range picks a target range, e.g. #preview-target@10.
  function showPreview(hash) {
    const m = hash.match(/^#preview-(target|report|sightin|card)(?:@(\d+))?$/) || [];
    const kind = m[1];
    document.body.classList.toggle('previewing', !!kind);
    if (m[2]) {
      const i = state.lists.targets.findIndex(t => !t.meet && t.value === Number(m[2]));
      if (i >= 0) { el.target.value = String(i); renderTarget(); }
    }
    if (kind && state.result && !state.result.error) {
      el.printRoot.innerHTML = SHEETS[kind](PAPER[state.paper]);
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

  // ---------- Offline and install ----------
  // The service worker keeps a copy of the site for use without a connection (not available when opened from disk).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Browsers that offer installing (Chrome, Edge, Android) get an Install button; iOS uses Share > Add to Home Screen.
  const installBtn = $('install');
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

  window.BTS_APP = { state, render, print };
})();
