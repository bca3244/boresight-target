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
    savedExport: $('saved-export'), savedImport: $('saved-import'), savedFile: $('saved-file'),
    trajTable: $('traj-table'), trajNote: $('traj-note'), wind: $('wind'), windUnit: $('wind-unit'),
    windClock: $('wind-clock'), slope: $('slope'), tMax: $('t-max'), tStep: $('t-step'), trajHint: $('traj-hint'), printCard: $('print-card'),
    cardClick: $('card-click'), cardHint: $('card-hint'), cardPreview: $('card-preview'),
    pbrZone: $('pbr-zone'), pbrUnit: $('pbr-unit'), pbrUse: $('pbr-use'), pbrHint: $('pbr-hint'),
    cRange: $('c-range'), cClick: $('c-click'), cVert: $('c-vert'), cVdir: $('c-vdir'), cHoriz: $('c-horiz'), cHdir: $('c-hdir'),
    cElev: $('c-elev'), cElevSub: $('c-elev-sub'), cWind: $('c-wind'), cWindSub: $('c-wind-sub'),
    printSightin: $('print-sightin'),
    barrelField: $('barrel-field'), barrelLen: $('barrel-len'), barrelRef: $('barrel-ref'), barrelRate: $('barrel-rate'),
    barrelRateUnit: $('b-rate-unit'), barrelNote: $('barrel-note'), barrelOn: $('barrel-on'), barrelRow: $('barrel-row')
  };
  // Field mode (see the Field section near the end).
  const fe = {
    view: $('field-view'), setup: document.querySelector('main.layout'), name: $('f-name'), sub: $('f-sub'), chip: $('f-chip'),
    savedWrap: $('f-saved-wrap'), saved: $('f-saved'), error: $('f-error'), body: $('f-body'), pbr: $('f-pbr'),
    range: $('f-range'), minus: $('f-minus'), plus: $('f-plus'), presets: $('f-presets'),
    elev: $('f-elev'), elevSub: $('f-elev-sub'), wind: $('f-wind'), windSub: $('f-wind-sub'), stats: $('f-stats'), warn: $('f-warn'),
    windSpd: $('f-windspd'), windUnit: $('f-wind-unit'), wMinus: $('f-wminus'), wPlus: $('f-wplus'),
    clock: $('f-clock'), slope: $('f-slope'), click: $('f-click'),
    wakeWrap: $('f-wake-wrap'), wake: $('f-wake'), status: $('f-status')
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
  // Shot angle for the trajectory table and range card: whole degrees, + uphill, - downhill (the zero is on level ground).
  const SLOPE_MAX = 60;
  function slopePref() { const v = parseInt(loadPref('slope', '0'), 10); return Math.abs(v) <= SLOPE_MAX && v % 5 === 0 ? v : 0; }
  function slopeText(deg) { return deg ? Math.abs(deg) + '° ' + (deg > 0 ? 'uphill' : 'downhill') : 'level'; }
  // Vital zone for the point-blank range, kept in inches (6 in, about 15 cm, is a common deer-size zone).
  const VITAL_DEFAULT_IN = 6, VITAL_MIN_IN = 1, VITAL_MAX_IN = 48;
  function vitalPref() { const v = parseFloat(loadPref('vital', '')); return v >= VITAL_MIN_IN && v <= VITAL_MAX_IN ? v : VITAL_DEFAULT_IN; }
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
    vitalIn: vitalPref(), // vital zone for the point-blank range, in inches
    windClock: clockPref(), // where the wind comes from, 1-12 o'clock (3 = from the right)
    slopeDeg: slopePref(),  // shot angle in degrees, + uphill
    table: tablePrefs(),    // trajectory table extent per firearm: { max, step } in the displayed distance unit
    loads: [],           // my loads (every firearm type), see normLoad(); read from storage below, once their limits exist
    linkLoad: null,      // a load opened from a link that isn't in my loads
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

  // ---------- My loads: your own bullet weight, velocity and B.C. under a name, kept in this browser ----------
  // They head the caliber list for their firearm type. A link carries the load itself, so it opens anywhere;
  // a load from a link that isn't saved here shows as "(from link)" until it's saved.
  const LOAD_BASE = 10000;   // caliber option values at or above this are loads (LOAD_BASE + position in modeLoads())
  const LOAD_NAME_MAX = 40;
  const LOAD_SHAPE = '(your load)';   // the shape list's only entry for a load: its B.C. is already known
  const LOAD_LIMITS = { grains: [1, 4000], fps: [100, 6000], bc: [0.01, 2] };
  // A cleaned copy of a load (rounded the way links store it), or null if it isn't a valid load.
  function normLoad(l) {
    if (!l || typeof l.name !== 'string' || !BTS.MODES.includes(l.mode)) return null;
    const out = { name: l.name.trim().slice(0, LOAD_NAME_MAX), mode: l.mode, grains: Math.round(l.grains * 10) / 10, fps: Math.round(l.fps), bc: Math.round(l.bc * 1000) / 1000 };
    const within = k => out[k] >= LOAD_LIMITS[k][0] && out[k] <= LOAD_LIMITS[k][1];
    return out.name && within('grains') && within('fps') && within('bc') ? out : null;
  }
  function readLoads() {
    try { const v = JSON.parse(localStorage.getItem('bts.loads') || '[]'); return Array.isArray(v) ? v.map(normLoad).filter(Boolean) : []; }
    catch (e) { return null; }   // null = storage unavailable
  }
  function writeLoads() {
    try { localStorage.setItem('bts.loads', JSON.stringify(state.loads)); return true; } catch (e) { return false; }
  }
  state.loads = readLoads() || [];
  const sameLoad = (a, b) => a.mode === b.mode && a.name === b.name && a.grains === b.grains && a.fps === b.fps && a.bc === b.bc;
  function modeLoads(mode = state.mode) {
    const list = state.loads.filter(l => l.mode === mode);
    if (state.linkLoad && state.linkLoad.mode === mode) list.push(state.linkLoad);
    return list;
  }
  function currentLoad() {
    const v = idx(el.caliber);
    return v >= LOAD_BASE ? modeLoads()[v - LOAD_BASE] || null : null;
  }
  function caliberName() {
    const load = currentLoad();
    return load ? load.name : BTS.calibers(state.mode)[idx(el.caliber)];
  }
  // Weight label in the units the weight list uses: grains (or grams), ounces for shotgun slugs.
  function loadWeightLabel(grains, mode = state.mode) {
    if (mode === 'shotgun') return metric() ? (grains / 437.5 * 28.349518).toFixed(1) + ' g' : (grains / 437.5).toFixed(3) + ' oz';
    return metric() ? (grains * 0.06479891).toFixed(2) + ' g' : +grains.toFixed(1) + ' gr';
  }

  // ---------- Building the lists (each keeps the previous choice when it still makes sense) ----------

  function buildCalibers(keepName) {
    const names = BTS.calibers(state.mode);
    let pick = names.indexOf(keepName);
    if (pick < 0) { const k = modeLoads().findIndex(l => l.name === keepName); if (k >= 0) pick = LOAD_BASE + k; }
    if (pick < 0) pick = names.indexOf(DEFAULTS[state.mode].caliber);
    el.caliberLabel.textContent = state.mode === 'shotgun' ? 'Gauge' : 'Caliber';
    el.caliberSearch.value = '';
    el.caliberSearch.parentElement.hidden = state.mode === 'shotgun';
    fillCalibers(Math.max(0, pick), '');
  }

  // Caliber options keep their position in the full list as their value, so filtering never changes what idx() means.
  // Every word typed must appear in the name: "6.5 creed" finds "6.5mm Creedmoor".
  // Your loads come first, in their own group.
  // Calibers are listed by name, numbers in numeric order ("30-06" before "300", "6.5" before "6mm"); their values stay data positions.
  const CALIBER_ORDER = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  // Fills a caliber select (the setup's or a Compare side's) and its match count.
  function fillCaliberSelect(select, count, keepIndex, term, mode = state.mode, loads = modeLoads(mode)) {
    const names = BTS.calibers(mode);
    const all = loads.map((l, k) => ({ value: LOAD_BASE + k, name: l.name + (l === state.linkLoad || l.adhoc ? ' (from link)' : ''), mine: true }))
      .concat(names.map((name, i) => ({ value: i, name })).sort((a, b) => CALIBER_ORDER.compare(a.name, b.name)));
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = all.filter(o => words.every(w => o.name.toLowerCase().includes(w)));
    let shown = matches.length ? matches : all.filter(o => o.value === keepIndex);
    if (!shown.length) shown = [all.find(o => !o.mine)];
    select.innerHTML = '';
    const group = label => { const g = document.createElement('optgroup'); g.label = label; return g; };
    const groups = loads.length ? { mine: group('My loads'), list: group(mode === 'shotgun' ? 'Gauges' : 'Calibers') } : null;
    shown.forEach(it => {
      const o = document.createElement('option');
      o.value = String(it.value);
      o.textContent = it.name;
      (groups ? (it.mine ? groups.mine : groups.list) : select).appendChild(o);
    });
    if (groups) [groups.mine, groups.list].forEach(g => { if (g.children.length) select.appendChild(g); });
    select.value = String(shown.some(o => o.value === keepIndex) ? keepIndex : shown[0].value);
    count.textContent = !words.length ? '' : matches.length
      ? `${matches.length} of ${all.length} match “${term.trim()}”` : `No calibers match “${term.trim()}”`;
  }
  function fillCalibers(keepIndex, term) { fillCaliberSelect(el.caliber, el.caliberCount, keepIndex, term); }
  // Selects one of modeLoads() (clearing any search).
  function selectLoad(load) {
    el.caliberSearch.value = '';
    fillCalibers(LOAD_BASE + modeLoads().indexOf(load), '');
  }

  function buildSights(keepInches) {
    const sights = BTS.sightHeights(state.mode, metric());
    state.lists.sights = sights;
    const target = keepInches == null ? DEFAULTS[state.mode].sightIn : keepInches;
    fill(el.sight, sights, s => s.label, nearestIndex(sights, target, s => s.inches));
  }

  // The weight a new choice of caliber starts on: the row's common weight, or the middle of its typical range
  // (a 5/8 oz slug in 12 gauge, 3/4 oz otherwise).
  function startGrains(ci) {
    if (state.mode === 'shotgun') return BTS.GAUGES[ci].eighths[0] === 5 ? 437.5 : 0.75 * 437.5;
    const row = BTS_DATA[state.mode][ci];
    return row[7] || (row[2] + row[3]) / 2;
  }
  // The shape it starts on: the one kept from before if it's offered, else the first of these, else the first in the list.
  const START_SHAPES = ['Pointed', 'Sabot Slug', 'Flat Point', 'Round Nose'];
  function startShape(shapes, keepLabel) {
    for (const label of [keepLabel].concat(START_SHAPES)) {
      const i = shapes.findIndex(s => s.label === label);
      if (i >= 0) return i;
    }
    return 0;
  }

  function buildWeights(keepGrains) {
    const load = currentLoad();
    if (load) {
      state.lists.weights = [{ label: loadWeightLabel(load.grains), grains: load.grains }];
      fill(el.weight, state.lists.weights, w => w.label, 0);
      el.weight.disabled = true;
      return;
    }
    const ci = idx(el.caliber);
    const weights = BTS.weights(state.mode, ci, metric());
    state.lists.weights = weights;
    let target = keepGrains;
    if (target == null) target = startGrains(ci);
    fill(el.weight, weights, w => w.label, nearestIndex(weights, target, w => w.grains));
  }

  function buildShapes(keepLabel) {
    if (currentLoad()) {
      state.lists.shapes = [{ label: LOAD_SHAPE, index: -1 }];
      fill(el.shape, state.lists.shapes, s => s.label, 0);
      el.shape.disabled = true;
      return;
    }
    const shapes = BTS.shapes(state.mode, idx(el.caliber));
    state.lists.shapes = shapes;
    fill(el.shape, shapes, s => s.label, startShape(shapes, keepLabel));
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
  // A load of your own supplies its own velocity and B.C.
  function setTypicalLoad() {
    const ci = idx(el.caliber), w = state.lists.weights[idx(el.weight)], s = state.lists.shapes[idx(el.shape)], load = currentLoad();
    if (!w || !s) return;
    state.typicalFps = load ? load.fps : BTS.typicalVelocityFps(state.mode, ci, w);
    state.vFps = Math.max(100, state.typicalFps + barrelAdjustFps());
    state.bc = load ? load.bc : BTS.typicalBc(state.mode, ci, w, s.index);
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

  // Calibers loaded both supersonic and subsonic: typical velocities follow the supersonic loads, and from this weight (grains) up
  // most factory loads are subsonic instead.
  const SUBSONIC_FROM_GR = { '300 Blackout': 190, '300 Whisper': 190, '350 Legend': 250, '458 SOCOM': 400 };
  function subsonicWeight() {
    const w = state.lists.weights[idx(el.weight)], from = !currentLoad() && SUBSONIC_FROM_GR[caliberName()];
    return !!(from && w && w.grains >= from);
  }
  function showLoad() {
    el.velocityUnit.textContent = metric() ? 'm/s' : 'fps';
    el.velocity.value = String(metric() ? BTS.roundHalfEven(state.vFps / FPS_PER_MPS) : state.vFps);
    el.bc.value = state.bc.toFixed(3);
    el.velocity.classList.toggle('custom', state.custom);
    el.bc.classList.toggle('custom', state.custom);
    el.resetLoad.hidden = !state.custom;
    const load = currentLoad();
    el.resetLoad.textContent = load ? 'Use this load’s values' : 'Use typical values';
    el.loadNote.textContent = state.custom ? 'Using your values.'
      : load ? `Values from your load “${load.name}”${barrelAdjustFps() ? ', adjusted for your barrel' : ''}.`
      : subsonicWeight() ? `Typical velocity follows supersonic loads; subsonic loads at this weight run about ${metric() ? '300–320 m/s' : '1,000–1,050 fps'}, so enter yours.`
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
      r.loadOk = true;
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
    return BTS.trajectoryTable(state.vFps, state.bc, sightIn, angle, disp.map(toYd), state.slopeDeg).map((p, i) => {
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
    return `<tr><th></th><th class="grp sep" colspan="3">Bullet vs. sight line</th><th class="grp sep" colspan="3">${label}</th>` + `<th class="sep" colspan="3"></th></tr>` +
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
    let h = `<thead>${trajectoryHead(u, false)}</thead><tbody>`;
    r.table.forEach(row => {
      const cls = row.path > 0.005 ? ' up' : row.path < -0.005 ? ' down' : '';
      h += `<tr${row.zero ? ' class="zero-row"' : ''}><td>${row.range}${row.zero ? ' <span class="tag">zero</span>' : ''}</td>${trajectoryCells(row, cls)}</tr>`;
    });
    el.trajTable.innerHTML = h + '</tbody>';
    el.trajNote.textContent = (r.nearZero != null ? `Near zero ${r.nearZero.toFixed(1)} ${u.d} · ` : '') + `Max rise ${riseText(r.rise)}` + (state.slopeDeg ? ' (level ground)' : '');
    el.trajHint.textContent = (state.tableCut ? `Showing the first ${TABLE_ROWS} ranges; choose a longer step to see farther. ` : '') +
      (state.slopeDeg ? `Shooting ${slopeText(state.slopeDeg)}: ranges are line-of-sight distances (what a rangefinder reads), for a zero made on level ground. ` : '') +
      'MOA and mil are from the line of sight. 3 and 9 o\'clock winds push the bullet the most; 12 and 6 o\'clock winds don\'t push it sideways.';
    renderCard();
  }

  // The range card section shows the same drawing that prints, so it follows the table, wind and click size.
  function renderCard() {
    const c = cardDrawing(), m = 0.03;
    el.cardPreview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.x0 - m} ${c.y0 - m} ${c.w + 2 * m} ${c.h + 2 * m}" ` +
      `style="max-width:${c.w + 2 * m}in" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="Range card preview">${c.g}</svg>`;
    el.cardHint.textContent = `Prints at ${c.w} × ${c.h} in on ${PAPER[state.paper].name} paper; cut along the dashed line. ` +
      'The click size is shared with “Adjust after your first shots”.';
  }

  // Point-blank range: the longest dead-on distance for the vital zone, the zero that gives it, and what the chosen zero gives.
  const PBR_MAX_YD = 2000;
  function vitalDisplay() { return metric() ? Math.round(state.vitalIn * BTS.CM_PER_INCH * 10) / 10 : Math.round(state.vitalIn * 10) / 10; }
  function renderPbr() {
    const r = state.result, u = metric() ? { d: 'm', l: 'cm' } : { d: 'yd', l: 'in' };
    const dist = yd => metric() ? yd * BTS.METERS_PER_YARD : yd, len = inch => metric() ? inch * BTS.CM_PER_INCH : inch;
    const span = p => p.endYd == null ? `over ${Math.round(dist(PBR_MAX_YD))} ${u.d}` : `${Math.round(dist(p.startYd))}–${Math.round(dist(p.endYd))} ${u.d}`;
    const half = state.vitalIn / 2, halfText = len(half).toFixed(1) + ' ' + u.l;
    el.pbrUnit.textContent = u.l;
    if (document.activeElement !== el.pbrZone) el.pbrZone.value = String(vitalDisplay());
    const best = BTS.pointBlank(r.vFps, r.bc, r.sightIn, half, PBR_MAX_YD);
    const $t = (id, text) => { document.getElementById(id).textContent = text; };
    $t('pbr-best', span(best));
    $t('pbr-best-sub', `Highest point +${halfText} at ${Math.round(dist(best.apexYd))} ${u.d}`);
    const bestZero = dist(best.farZeroYd);
    $t('pbr-zero', `${Math.round(bestZero)} ${u.d}`);
    $t('pbr-zero-sub', best.nearZeroYd != null ? `Also crosses the sight line at ${Math.round(dist(best.nearZeroYd))} ${u.d}` : '');
    // The chosen zero: within the zone only if its highest point stays inside it.
    if (r.angle != null) {
      const mine = BTS.pointBlankAt(r.vFps, r.bc, r.sightIn, r.angle, half, PBR_MAX_YD);
      const over = mine.apexIn > half + 0.005;
      $t('pbr-yours', over ? 'Rises too high' : span(mine));
      $t('pbr-yours-sub', over ? `Your ${r.zero} ${u.d} zero rises ${len(mine.apexIn).toFixed(1)} ${u.l} at ${Math.round(dist(mine.apexYd))} ${u.d}, above the zone`
        : `With your ${r.zero} ${u.d} zero`);
    } else {
      $t('pbr-yours', '–');
      $t('pbr-yours-sub', 'This zero range can’t be used with this load');
    }
    // Zero choices come in steps; the best one is the farthest that doesn't rise above the zone.
    const zeros = state.lists.zeros, pick = zeros.filter(z => z <= bestZero + 1e-9).pop();
    if (pick == null) {
      el.pbrUse.disabled = true;
      el.pbrUse.textContent = 'Use best zero';
      el.pbrUse.dataset.zero = '';
    } else {
      el.pbrUse.dataset.zero = String(zeros.indexOf(pick));
      el.pbrUse.disabled = r.angle != null && pick === r.zero;
      el.pbrUse.textContent = el.pbrUse.disabled ? `Using ${pick} ${u.d} zero` : `Use ${pick} ${u.d} zero`;
    }
    const steps = zeros.length > 1 ? zeros[1] - zeros[0] : 0;
    el.pbrHint.textContent = `Aim dead-on and the bullet stays within ±${halfText} of your aim point (half the vital zone). ` +
      (pick == null ? `The best zero is closer than the shortest zero choice (${zeros[0]} ${u.d}).`
        : Math.abs(pick - bestZero) < 0.5 ? '' : `Zero choices go in ${steps} ${u.d} steps, so ${pick} ${u.d} is the closest one that doesn’t rise above the zone. `) +
      'Standard atmosphere; confirm on paper.';
  }

  // Shows the crosswind and table extent in the current units (the wind is stored in mph).
  function showWind() {
    const u = trajectoryUnits(), t = state.table[state.mode];
    el.windUnit.textContent = u.w;
    if (document.activeElement !== el.wind) el.wind.value = String(windDisplay());
    el.windClock.value = String(state.windClock);
    el.slope.value = String(state.slopeDeg);
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
    showLoadTools();
    const ok = !r.error;
    el.error.hidden = ok;
    el.error.innerHTML = r.error || '';
    el.solution.hidden = !ok;
    el.printTarget.disabled = el.printReport.disabled = el.printSightin.disabled = el.printCard.disabled = !ok;
    ['traj-card', 'range-card'].forEach(id => { document.getElementById(id).hidden = !ok; });
    // The point-blank range only needs a valid load, so it can still suggest a zero when the chosen one is refused.
    document.getElementById('pbr-card').hidden = !r.loadOk;
    if (r.loadOk) renderPbr();
    // The calculator's shot distance follows the zero range until the user types their own.
    if (!el.cRange.dataset.edited) el.cRange.value = String(r.zero);
    updateClicks();
    if (!ok) { el.chart.innerHTML = ''; syncUrl(); renderField(); renderCompare(); return; }
    buildTargets(keepTarget);
    el.meet.textContent = r.meet.toFixed(1);
    el.meetUnit.textContent = metric() ? 'm' : 'yd';
    el.maxRise.textContent = 'Max rise ' + riseText(r.rise);
    showWind();
    renderTable();
    renderTarget();
    renderField();
    renderCompare();
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
  //   c + 3+3+3   optional: one of my loads (the caliber, weight and shape positions are then 0): weight in tenths
  //               of a grain, velocity (fps) and B.C. x 1000, then ~ and the load's name (URL-encoded)
  const SHARE_RE = /^#([12])([0-9a-n])([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})([0-9a-z])([0-9a-z])([0-9a-z]{2})(?:([0-9a-z]{3})([0-9a-z]{3}))?(?:b([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2}))?(?:c([0-9a-z]{3})([0-9a-z]{3})([0-9a-z]{3})(?:~([^#]{1,240}))?)?$/;
  let urlReady = false;   // no URL writes while the page is still starting up
  const b36 = (n, len) => Math.max(0, Math.round(n)).toString(36).padStart(len, '0').slice(-len);

  function shareCode() {
    const flags = BTS.MODES.indexOf(state.mode) * 8 + (metric() ? 4 : 0) + (state.paper === 'a4' ? 2 : 0) + (state.plot === 'full' ? 1 : 0);
    const target = state.result && !state.result.error ? idx(el.target) : 0;
    const load = currentLoad();
    let code = '2' + flags.toString(36) + b36(load ? 0 : idx(el.caliber), 2) + b36(idx(el.sight), 2) + b36(idx(el.weight), 2) +
      b36(idx(el.shape), 1) + b36(idx(el.zero), 1) + b36(target, 2);
    if (state.custom && state.vFps > 0 && state.bc > 0) {
      code += b36(metric() ? state.vFps / FPS_PER_MPS : state.vFps, 3) + b36(state.bc * 1000, 3);
    }
    const b = state.barrel;
    if (b && b.on && b.len != null && state.mode !== 'shotgun') code += 'b' + b36(b.len * 10, 2) + b36(b.ref * 10, 2) + b36(b.rate, 2);
    if (load) code += 'c' + b36(load.grains * 10, 3) + b36(load.fps, 3) + b36(load.bc * 1000, 3) + '~' + encodeURIComponent(load.name);
    return code;
  }

  // A page opened without a code (the base URL, as after Reset) keeps a clean address until something changes.
  let plainCode = null;
  function syncUrl() {
    if (!urlReady || document.body.classList.contains('previewing')) return;
    const code = shareCode();
    if (plainCode !== null) {
      if (code === plainCode && !location.hash) return;
      plainCode = null;
    }
    if (location.hash !== '#' + code) history.replaceState(null, '', '#' + code);
  }

  function decodeName(s) {
    if (!s) return '';
    try { return decodeURIComponent(s); } catch (e) { return s; }
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
    // A load in the link: use the saved one that matches it, or list it as "(from link)".
    const linked = m[13] ? normLoad({ name: decodeName(m[16]) || 'Load from link', mode, grains: n(m[13]) / 10, fps: n(m[14]), bc: n(m[15]) / 1000 }) : null;
    const saved = linked && state.loads.find(l => sameLoad(l, linked));
    state.linkLoad = linked && !saved ? linked : null;
    buildCalibers(null);
    if (linked) selectLoad(saved || state.linkLoad); else pick(el.caliber, n(m[2]));
    buildSights(null); pick(el.sight, n(m[3]));
    buildWeights(null);
    if (version === '1') {
      // Version-1 links point into a coarser weight list; find the same weight in today's list.
      const old = BTS.v1Weights(state.mode, idx(el.caliber), metric())[n(m[4])];
      if (old) pick(el.weight, nearestIndex(state.lists.weights, old.grains, w => w.grains));
    } else pick(el.weight, Math.min(n(m[4]), el.weight.options.length - 1));   // a list's top can come down when data is corrected
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
  // `url` (optional): a link to copy instead of this setup's, e.g. a comparison.
  function copyLink(url) {
    if (typeof url !== 'string') {
      syncUrl();
      url = location.href.split('#')[0] + '#' + shareCode();   // always the full code, even on a clean address
    }
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
    const all = d.pts;
    let yMin = Math.min(-d.h, ...all.map(p => p.y)), yMax = Math.max(d.laserAt(d.xMax), ...all.map(p => p.y), 0);
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
    return { grid: v('--border'), axis: v('--faint'), tick: v('--muted'), title: v('--text'), los: v('--los'), path: v('--path'), laser: v('--laser'), accent: v('--accent'), bg: v('--bg'), compare: v('--compare') };
  }

  function drawChart() {
    const w = Math.max(280, el.chart.clientWidth), h = Math.max(220, el.chart.clientHeight);
    const d = chartData();
    const c = chartSVG(d, w, h, screenColors(), true);
    el.chart.innerHTML = c.svg + '<div class="tooltip" hidden></div>';
    const svg = el.chart.querySelector('svg'), tip = el.chart.querySelector('.tooltip'), hover = svg.querySelector('.hover-line');
    const hit = svg.querySelector('.hit');
    const pathAt = (x, p = d.pts) => {
      let i = 1;
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
      [state.mode === 'shotgun' ? 'Gauge' : 'Caliber', caliberName()],
      ['Sight height', r.sight.value.toFixed(1) + (metric() ? ' cm' : ' in')],
      ['Bullet weight', w.label],
      ['Bullet shape', s.label],
      ['Muzzle velocity', v + (state.custom ? '' : currentLoad() ? (barrelAdjustFps() ? ' (adjusted for barrel)' : '') : barrelAdjustFps() ? ' (typical, adjusted for barrel)' : ' (typical)')],
      ...(barrelAdjustFps() || (state.barrel && state.barrel.on && state.barrel.len != null && state.mode !== 'shotgun') ? [['Barrel length', barrelText()]] : []),
      ['G1 B.C.', r.bc.toFixed(3) + (state.custom || currentLoad() ? '' : ' (typical)')],
      ['Zero range', r.zero + ' ' + unitD],
      ...(state.slopeDeg ? [['Shot angle', slopeText(state.slopeDeg) + ' (table only)']] : []),
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
    s += `<text x="${W / 2}" y="0.55" text-anchor="middle" font-size="0.12" fill="#555">Boresight target · ${esc(caliberName())}</text>`;
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
  function setupUrl(code) {
    const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : PUBLIC_URL;
    return base + '#' + (code || shareCode());
  }

  // QR code of setupUrl() as SVG elements: a white square of side `size` at (x, y), quiet zone included.
  function qrCode(x, y, size, url) {
    const q = qrcode(0, 'M');
    q.addData(url || setupUrl());
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
    s += `<text x="${W / 2}" y="0.9" text-anchor="middle" font-size="0.12" fill="#555">${esc(caliberName())} · squares are 1 ${unitL}</text>`;
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
  // cardDrawing() is the card itself (inch coordinates on the page); the screen preview and the printed sheet both use it.
  function cardDrawing() {
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
    g += `<text x="${tx}" y="${y0 + pad + 0.11}" font-size="0.13" font-weight="700">${esc(caliberName())}</text>`;
    g += `<text x="${tx + tw}" y="${y0 + pad + 0.11}" text-anchor="end" font-size="0.085" fill="#444">Zero ${r.zero} ${u.d} · sight ${r.sight.value.toFixed(1)} ${metric() ? 'cm' : 'in'}</text>`;
    g += `<text x="${tx}" y="${y0 + pad + 0.26}" font-size="0.085" fill="#333">${esc(w.label + ' ' + s.label)} · ${v} · G1 B.C. ${r.bc.toFixed(3)}</text>`;
    g += `<text x="${tx}" y="${y0 + pad + 0.39}" font-size="0.085" fill="#333">Clicks to dial at ${esc(clickLabel)} · wind ${esc(windText(u))}${state.slopeDeg ? " · " + slopeText(state.slopeDeg) : ""}</text>`;
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
    return { g, x0, y0, w: CW, h: CH };
  }

  function cardSheet(paper) {
    const c = cardDrawing();
    return `<div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" width="${paper.w}in" height="${paper.h}in" viewBox="0 0 ${paper.w} ${paper.h}" font-family="Arial, Helvetica, sans-serif">` +
      `<rect width="${paper.w}" height="${paper.h}" fill="#fff"/>${c.g}` +
      `<text x="${c.x0}" y="${c.y0 + c.h + 0.3}" font-size="0.11" fill="#555">Cut along the dashed line (${c.w} × ${c.h} in). Print at 100% / Actual size.</text></svg></div>`;
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
      <header><div><h1>Boresight Report · trajectory</h1><p>${esc(caliberName())} · zeroed at ${r.zero} ${unitD} · ${esc(state.lists.weights[idx(el.weight)].label)} ${esc(state.lists.shapes[idx(el.shape)].label)}</p></div></header>
      ${traj}
      <p class="report-note">MOA and mil are from the line of sight. Drift is for ${esc(windText(u))}.${state.slopeDeg ? " Shot angle " + slopeText(state.slopeDeg) + "; ranges are line-of-sight distances." : ""}</p>
      ${footer}
    </div>`;
    return `<div class="sheet report" style="width:${paper.w}in;height:${paper.h}in">
      <header><svg viewBox="0 0 32 32" width="34" height="34"><circle cx="16" cy="16" r="11" fill="none" stroke="#0f9d8a" stroke-width="2.5"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="#0f9d8a" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="#e0283d"/></svg>
      <div><h1>Boresight Report</h1><p>${esc(caliberName())} · zeroed at ${r.zero} ${unitD}</p></div>
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
    if (kind === 'compare' ? !cmpLast : !state.result || state.result.error) return;
    const paper = PAPER[state.paper];
    let style = document.getElementById('page-size');
    if (!style) { style = document.createElement('style'); style.id = 'page-size'; document.head.appendChild(style); }
    style.textContent = `@page { size: ${paper.css}; margin: 0; }`;
    el.printRoot.innerHTML = SHEETS[kind](paper);
    window.print();
  }
  const SHEETS = { target: targetSheet, report: reportSheet, sightin: sightinSheet, card: cardSheet, compare: p => compareSheet(p) };
  window.addEventListener('afterprint', () => { el.printRoot.innerHTML = ''; });

  // ---------- Events ----------

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  }

  function changeMode(mode) {
    if (mode === state.mode) return;
    const prevName = caliberName();
    const prevZero = state.lists.zeros[idx(el.zero)];
    state.mode = mode;
    closeLoadForm();
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
    closeLoadForm();
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
  // Shot angle: 60° down to 60° up in 5° steps.
  for (let a = -SLOPE_MAX; a <= SLOPE_MAX; a += 5) {
    const o = document.createElement('option');
    o.value = String(a); o.textContent = a ? Math.abs(a) + '° ' + (a > 0 ? 'up' : 'down') : 'Level';
    el.slope.appendChild(o);
  }
  el.slope.addEventListener('change', () => {
    state.slopeDeg = Number(el.slope.value);
    savePref('slope', String(state.slopeDeg));
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

  // Point-blank range: the vital zone is typed in the display unit and kept in inches.
  el.pbrZone.addEventListener('input', () => {
    const v = parseFloat(el.pbrZone.value), inches = metric() ? v / BTS.CM_PER_INCH : v;
    if (!(inches >= VITAL_MIN_IN && inches <= VITAL_MAX_IN)) return;
    state.vitalIn = inches;
    savePref('vital', String(inches));
    if (state.result && state.result.loadOk) renderPbr();
  });
  el.pbrZone.addEventListener('blur', () => { el.pbrZone.value = String(vitalDisplay()); });
  el.pbrUse.addEventListener('click', () => {
    if (el.pbrUse.dataset.zero === '') return;
    el.zero.value = el.pbrUse.dataset.zero;
    el.zero.dispatchEvent(new Event('change'));
    toast(`Zero set to ${state.result.zero} ${metric() ? 'm' : 'yd'}`);
  });

  // Rebuilds only the trajectory table (wind and table settings don't change the boresight solution).
  function refreshTable() {
    const r = state.result;
    if (r && !r.error) { r.table = trajectoryRows(r.angle, r.sightIn, r.zero, r.zeroYd); renderTable(); }
    renderField();
    renderCompare();
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

  // ---------- My loads: the form and its buttons ----------
  const lf = {
    form: $('load-form'), title: $('lf-title'), name: $('lf-name'), weight: $('lf-weight'), weightUnit: $('lf-weight-unit'),
    velocity: $('lf-velocity'), velocityUnit: $('lf-velocity-unit'), bc: $('lf-bc'), note: $('lf-note'),
    add: $('load-add'), keep: $('load-keep'), edit: $('load-edit'), del: $('load-delete')
  };
  let editing = null;   // the saved load the form is changing, or null for a new one
  const LF_NOTE = 'Your loads are listed first under Caliber and kept in this browser; links and setup files carry them too.';
  // Weight in the form: grains (grams in metric), or ounces for shotgun slugs.
  const weightUnit = () => state.mode === 'shotgun' ? (metric() ? 'g' : 'oz') : (metric() ? 'g' : 'gr');
  const toFormWeight = gr => state.mode === 'shotgun' ? (metric() ? gr / 437.5 * 28.349518 : gr / 437.5) : (metric() ? gr * 0.06479891 : gr);
  const fromFormWeight = v => state.mode === 'shotgun' ? (metric() ? v / 28.349518 * 437.5 : v * 437.5) : (metric() ? v / 0.06479891 : v);

  function showLoadTools() {
    const load = currentLoad();
    lf.keep.hidden = !load || load !== state.linkLoad;
    lf.edit.hidden = lf.del.hidden = !load || load === state.linkLoad;
  }
  function closeLoadForm() { lf.form.hidden = true; editing = null; }
  // Opens the form for a new load (starting from what's selected now) or for changing a saved one.
  function openLoadForm(load) {
    editing = load;
    const w = state.lists.weights[idx(el.weight)];
    const grains = load ? load.grains : w.grains, fps = load ? load.fps : state.vFps, bc = load ? load.bc : state.bc;
    lf.title.textContent = load ? `Edit “${load.name}”` : 'Your own load';
    lf.name.value = load ? load.name : '';
    lf.name.placeholder = `e.g. ${currentLoad() ? 'My' : caliberName().split(' (')[0]} ${w.label} handload`;
    lf.weightUnit.textContent = weightUnit();
    lf.velocityUnit.textContent = metric() ? 'm/s' : 'fps';
    lf.weight.value = String(+toFormWeight(grains).toFixed(state.mode === 'shotgun' || metric() ? 2 : 1));
    lf.velocity.value = String(metric() ? Math.round(fps * 0.3048) : Math.round(fps));
    lf.bc.value = bc.toFixed(3);
    lf.note.textContent = LF_NOTE;
    lf.note.classList.remove('bad');
    lf.form.hidden = false;
    lf.name.focus();
  }
  // Puts a load in my loads (replacing the one being edited, or one with the same name) and selects it.
  function storeLoad(load, replace) {
    const at = state.loads.indexOf(replace), same = state.loads.findIndex(l => l !== replace && l.mode === load.mode && l.name === load.name);
    if (same >= 0) state.loads.splice(same, 1);
    if (replace && state.loads.indexOf(replace) >= 0) state.loads[state.loads.indexOf(replace)] = load; else state.loads.push(load);
    if (state.linkLoad && (state.linkLoad === replace || sameLoad(state.linkLoad, load))) state.linkLoad = null;
    const ok = writeLoads();
    if (!ok) {
      // Storage is blocked: keep it for this visit only.
      state.loads = state.loads.filter(l => l !== load);
      state.linkLoad = load;
    }
    buildCalibers(null);
    selectLoad(load);
    onCaliberChange();
    return { ok, updated: at >= 0 || same >= 0 };
  }
  lf.add.addEventListener('click', () => openLoadForm(null));
  lf.edit.addEventListener('click', () => openLoadForm(currentLoad()));
  lf.form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('lf-save').click(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeLoadForm(); }
  });
  $('lf-cancel').addEventListener('click', closeLoadForm);
  $('lf-save').addEventListener('click', () => {
    const v = parseFloat(lf.velocity.value);
    const raw = { name: lf.name.value.trim() || lf.name.placeholder.replace(/^e\.g\. /, ''), mode: state.mode,
      grains: fromFormWeight(parseFloat(lf.weight.value)), fps: metric() ? v / 0.3048 : v, bc: parseFloat(lf.bc.value) };
    const load = normLoad(raw);
    if (!load) {
      const L = LOAD_LIMITS, fpsText = metric() ? '30–1830 m/s' : '100–6000 fps';
      lf.note.textContent = !(raw.fps >= L.fps[0] && raw.fps <= L.fps[1]) ? `Enter a muzzle velocity of ${fpsText}.`
        : !(raw.bc >= L.bc[0] && raw.bc <= L.bc[1]) ? 'Enter a G1 B.C. from 0.010 to 2.000.' : 'Enter the bullet weight.';
      lf.note.classList.add('bad');
      return;
    }
    const r = storeLoad(load, editing);
    closeLoadForm();
    toast(!r.ok ? 'Couldn’t save in this browser; using it for this visit' : r.updated ? `Updated “${load.name}”` : `Saved “${load.name}”`);
  });
  lf.keep.addEventListener('click', () => {
    const load = state.linkLoad;
    if (!load) return;
    const r = storeLoad(Object.assign({}, load), null);
    toast(!r.ok ? 'Couldn’t save in this browser' : r.updated ? `Updated “${load.name}”` : `Saved “${load.name}”`);
  });
  lf.del.addEventListener('click', () => {
    const load = currentLoad();
    if (!load || load === state.linkLoad || !window.confirm(`Delete your load “${load.name}”?`)) return;
    state.loads = state.loads.filter(l => l !== load);
    writeLoads();
    closeLoadForm();
    buildCalibers(null);
    onCaliberChange();
    toast(`Deleted “${load.name}”`);
  });

  el.sight.addEventListener('change', () => render(keepTargetValue()));
  el.weight.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.shape.addEventListener('change', () => { setTypicalLoad(); render(keepTargetValue()); });
  el.zero.addEventListener('change', () => { delete el.cRange.dataset.edited; render(keepTargetValue()); });

  // Click calculator inputs.
  // The range card has its own copy of the click-size list; both stay on the same value.
  el.cardClick.innerHTML = el.cClick.innerHTML;
  el.cClick.value = loadPref('click', 'moa:0.25');
  if (!el.cClick.value) el.cClick.value = 'moa:0.25';
  el.cardClick.value = el.cClick.value;
  el.cRange.addEventListener('input', () => { el.cRange.dataset.edited = '1'; updateClicks(); });
  [el.cVert, el.cHoriz, el.cVdir, el.cHdir].forEach(i => i.addEventListener('input', updateClicks));
  function setClick(value) {
    el.cClick.value = el.cardClick.value = value;
    savePref('click', value);
    updateClicks();
    if (state.result && !state.result.error) renderCard();
    renderField();
  }
  el.cClick.addEventListener('change', () => setClick(el.cClick.value));
  el.cardClick.addEventListener('change', () => setClick(el.cardClick.value));

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
    fillFieldSaved();
    fillCompareFrom();
  }
  function suggestedName() {
    return caliberName() + ' · ' + state.lists.weights[idx(el.weight)].label + ' · ' +
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

  // ---------- Setups file: saved setups, the current setup and the table/wind/click settings as JSON ----------
  const FILE_FORMAT = 'boresight-setups', FILE_VERSION = 1;
  const CLICK_VALUES = Array.from(el.cClick.options).map(o => o.value);
  function setupsFile() {
    const current = shareCode();
    return {
      format: FILE_FORMAT, version: FILE_VERSION, app: 'Boresight Target Generator', site: PUBLIC_URL,
      saved: new Date().toISOString(),
      current: { name: suggestedName(), code: current, link: setupUrl(current) },
      setups: (readSaved() || []).map(s => ({ name: s.name, code: s.code, link: setupUrl(s.code) })),
      loads: state.loads.map(l => Object.assign({}, l)),
      settings: { windMph: state.windMph, windClock: state.windClock, slopeDeg: state.slopeDeg, click: el.cClick.value, vitalIn: state.vitalIn, table: JSON.parse(JSON.stringify(state.table)) }
    };
  }
  function exportSetups() {
    const data = setupsFile(), d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `boresight-setups-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const n = data.setups.length;
    toast(n ? `Saved ${n} setup${n === 1 ? '' : 's'} and the current one to a file` : 'Saved the current setup to a file');
  }
  // Checks a parsed file; returns { setups, current, settings } with only valid entries, or an error message.
  function readSetupsFile(data) {
    if (!data || typeof data !== 'object' || data.format !== FILE_FORMAT) return { error: 'This isn’t a setups file saved from this page.' };
    if (!(data.version <= FILE_VERSION)) return { error: 'This file was saved by a newer version of the page. Reload the page and try again.' };
    const okCode = c => typeof c === 'string' && SHARE_RE.test('#' + c);
    const setups = (Array.isArray(data.setups) ? data.setups : [])
      .filter(s => s && typeof s.name === 'string' && s.name.trim() && okCode(s.code))
      .map(s => ({ name: s.name.trim().slice(0, 60), code: s.code }));
    const current = data.current && okCode(data.current.code) ? data.current.code : null;
    const s = data.settings || {}, settings = {};
    if (typeof s.windMph === 'number' && s.windMph >= 0 && s.windMph < 100) settings.windMph = s.windMph;
    if (Number.isInteger(s.windClock) && s.windClock >= 1 && s.windClock <= 12) settings.windClock = s.windClock;
    if (Number.isInteger(s.slopeDeg) && Math.abs(s.slopeDeg) <= SLOPE_MAX && s.slopeDeg % 5 === 0) settings.slopeDeg = s.slopeDeg;
    if (CLICK_VALUES.includes(s.click)) settings.click = s.click;
    if (typeof s.vitalIn === 'number' && s.vitalIn >= VITAL_MIN_IN && s.vitalIn <= VITAL_MAX_IN) settings.vitalIn = s.vitalIn;
    if (s.table && typeof s.table === 'object') {
      settings.table = {};
      Object.keys(TABLE_DEFAULTS).forEach(mode => {
        const t = s.table[mode];
        if (t && t.max >= 10 && t.max <= TABLE_MAX && TABLE_STEPS.includes(t.step)) settings.table[mode] = { max: t.max, step: t.step };
      });
    }
    const loads = (Array.isArray(data.loads) ? data.loads : []).map(normLoad).filter(Boolean);
    if (!setups.length && !current) return { error: 'This file has no setups in it.' };
    return { setups, current, settings, loads };
  }
  // Adds the file's setups to My setups (a setup with the same name is replaced), applies its settings and opens its current setup.
  function importSetups(data) {
    const f = readSetupsFile(data);
    if (f.error) { toast(f.error); return false; }
    const st = f.settings;
    if (st.windMph != null) { state.windMph = st.windMph; savePref('wind', String(st.windMph)); }
    if (st.windClock != null) { state.windClock = st.windClock; savePref('windclock', String(st.windClock)); }
    if (st.slopeDeg != null) { state.slopeDeg = st.slopeDeg; savePref('slope', String(st.slopeDeg)); }
    if (st.table) Object.keys(st.table).forEach(mode => { state.table[mode] = st.table[mode]; savePref('table.' + mode, st.table[mode].max + ':' + st.table[mode].step); });
    if (st.click) { el.cClick.value = el.cardClick.value = st.click; savePref('click', st.click); }
    if (st.vitalIn != null) { state.vitalIn = st.vitalIn; savePref('vital', String(st.vitalIn)); }
    const list = readSaved();
    let added = 0, replaced = 0;
    if (list && f.setups.length) {
      f.setups.forEach(s => {
        const existing = list.find(x => x.name === s.name);
        if (existing) { if (existing.code !== s.code) replaced++; existing.code = s.code; } else { list.push(s); added++; }
      });
      if (!writeSaved(list)) added = replaced = 0;
    }
    renderSaved(f.setups[0] && f.setups[0].name);
    // My loads: a load with the same name and firearm type is replaced. Done before opening the setup so it can find its load.
    let loadsIn = 0;
    f.loads.forEach(l => {
      const i = state.loads.findIndex(x => x.mode === l.mode && x.name === l.name);
      if (i >= 0) { if (!sameLoad(state.loads[i], l)) loadsIn++; state.loads[i] = l; } else { state.loads.push(l); loadsIn++; }
    });
    if (loadsIn && !writeLoads()) loadsIn = 0;
    if (!applyShareCode('#' + (f.current || f.setups[0].code))) render(keepTargetValue());
    const parts = [];
    if (added) parts.push(`${added} new`);
    if (replaced) parts.push(`${replaced} updated`);
    toast('Loaded the file' + (parts.length ? ` (${parts.join(', ')} saved setup${added + replaced === 1 ? '' : 's'})` : '') +
      (loadsIn ? `, ${loadsIn} load${loadsIn === 1 ? '' : 's'}` : '') +
      (list === null && f.setups.length ? '; this browser can’t keep saved setups, so only the current one is open' : ''));
    return true;
  }
  el.savedExport.addEventListener('click', exportSetups);
  el.savedImport.addEventListener('click', () => { el.savedFile.value = ''; el.savedFile.click(); });
  el.savedFile.addEventListener('change', () => {
    const file = el.savedFile.files && el.savedFile.files[0];
    if (!file) return;
    if (file.size > 1e6) { toast('That file is too large to be a setups file.'); return; }
    file.text().then(text => {
      let data;
      try { data = JSON.parse(text); } catch (e) { toast('That file isn’t valid JSON.'); return; }
      importSetups(data);
    }, () => toast('Couldn’t read that file.'));
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
  el.paper.addEventListener('change', () => {
    state.paper = el.paper.value; savePref('paper', state.paper); syncUrl();
    if (state.result && !state.result.error) renderCard();
  });
  el.copyLink.addEventListener('click', copyLink);
  el.printTarget.addEventListener('click', () => print('target'));
  el.printReport.addEventListener('click', () => print('report'));

  function keepTargetValue() {
    const t = state.lists.targets && state.lists.targets[idx(el.target)];
    return t && !t.meet ? t.value : null;
  }

  // Zoom: a card fills the window; Escape or the button restores it. Used by the chart and the range card.
  function setCardMax(card, btn, name, bodyClass, on) {
    // Maximizing a collapsed card opens it first.
    if (on && card.classList.contains('collapsed')) card.querySelector('.fold-btn').click();
    card.classList.toggle('maximized', on);
    document.body.classList.toggle(bodyClass, on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', (on ? 'Restore ' : 'Maximize ') + name);
    btn.title = on ? `Restore ${name} (Esc)` : 'Maximize ' + name;
  }
  function setChartMax(on) {
    setCardMax(el.chartCard, el.chartZoom, 'chart', 'chart-open', on);
    if (state.result && !state.result.error) drawChart();
  }
  const rangeCard = document.getElementById('range-card'), cardZoom = document.getElementById('card-zoom');
  const setRangeCardMax = on => setCardMax(rangeCard, cardZoom, 'range card', 'card-open', on);
  el.chartZoom.addEventListener('click', () => setChartMax(!el.chartCard.classList.contains('maximized')));
  cardZoom.addEventListener('click', () => setRangeCardMax(!rangeCard.classList.contains('maximized')));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (el.chartCard.classList.contains('maximized')) setChartMax(false);
    if (rangeCard.classList.contains('maximized')) setRangeCardMax(false);
  });

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

  // Reset: forget every preference (units, paper, wind, table, clicks, folded cards, …) and open the plain page.
  // Saved setups and my loads are data, not settings, so they stay.
  const KEEP_ON_RESET = ['bts.saved', 'bts.loads'];
  $('reset-all').addEventListener('click', () => {
    if (!window.confirm('Reset all settings to their defaults? Your saved setups and loads are kept.')) return;
    try {
      Object.keys(localStorage).filter(k => k.startsWith('bts.') && !KEEP_ON_RESET.includes(k)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* storage unavailable: nothing was kept anyway */ }
    location.replace(location.pathname);   // the base URL: no settings code, no query
  });

  // ---------- Field mode: range in, holds out ----------
  // Field never changes the profile (caliber, load, sight, zero); it only reads it. Range, wind, shot angle and click size
  // are per-viewer preferences shared with Setup's trajectory table and range card. The range is kept in yards per firearm type.
  const FIELD_PRESETS = { rifle: [100, 150, 200, 250, 300, 400], pistol: [15, 25, 50, 75, 100], shotgun: [25, 50, 75, 100, 125] };
  const FIELD_STEP = { rifle: 10, pistol: 5, shotgun: 5 };
  const FIELD_MAX_YD = 2000;
  const SOUND_FPS = 1116, TRANSONIC_FPS = 1340;   // speed of sound at 59 °F, and about Mach 1.2
  state.view = ['field', 'compare'].includes(loadPref('view', 'setup')) ? loadPref('view', 'setup') : 'setup';
  state.theme = ['sun', 'night'].includes(loadPref('theme', 'dark')) ? loadPref('theme', 'dark') : 'dark';

  const toDispDist = yd => (metric() ? yd * BTS.METERS_PER_YARD : yd);
  const fromDispDist = d => (metric() ? d / BTS.METERS_PER_YARD : d);
  const roundDist = d => Math.round(d * 10) / 10;
  function fieldYd() {
    const v = parseFloat(loadPref('field.' + state.mode, ''));
    if (v >= 1 && v <= FIELD_MAX_YD) return v;
    return state.result && state.result.zeroYd ? state.result.zeroYd : DEFAULTS[state.mode].zero;
  }
  function setFieldYd(yd) {
    savePref('field.' + state.mode, String(Math.max(1, Math.min(FIELD_MAX_YD, yd))));
    renderField();
  }

  function renderField() {
    if (state.view !== 'field') return;
    const r = state.result, u = trajectoryUnits(), load = currentLoad();
    // Active profile: a saved setup's name when the current settings match one.
    const code = shareCode(), saved = (readSaved() || []).find(s => s.code === code);
    const w = state.lists.weights[idx(el.weight)];
    const desc = `${caliberName()} · ${w ? w.label : ''}`;
    fe.name.textContent = saved ? saved.name : desc;
    fe.sub.textContent = (saved ? desc + ' · ' : '') + `${r.zero} ${u.d} zero · ` +
      (metric() ? BTS.roundHalfEven(r.vFps / FPS_PER_MPS) + ' m/s' : BTS.roundHalfEven(r.vFps) + ' fps') + (load || state.custom ? '' : ' (typical)');
    fe.error.hidden = !r.error;
    fe.error.innerHTML = r.error ? r.error + ' Change it in <button type="button" class="link" data-go="setup">Setup</button>.' : '';
    fe.body.hidden = !!r.error;
    if (r.error) return;

    // Range, presets and conditions, in the displayed units.
    const yd = fieldYd(), disp = roundDist(toDispDist(yd));
    document.querySelectorAll('.f-dist').forEach(s => { s.textContent = u.d; });
    if (document.activeElement !== fe.range) fe.range.value = String(disp);
    const presets = FIELD_PRESETS[state.mode];
    if (fe.presets.dataset.key !== state.mode + u.d) {
      fe.presets.dataset.key = state.mode + u.d;
      fe.presets.innerHTML = presets.map(p => `<button type="button" data-range="${p}" aria-label="${p} ${u.d}">${p}</button>`).join('');
    }
    fe.presets.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.range) - disp) < 0.5)));
    fe.windUnit.textContent = u.w;
    if (document.activeElement !== fe.windSpd) fe.windSpd.value = String(windDisplay());
    fe.clock.value = String(state.windClock);
    fe.slope.value = String(state.slopeDeg);
    fe.click.value = el.cClick.value;

    // The holds at this range.
    const p = BTS.trajectoryTable(r.vFps, r.bc, r.sightIn, r.angle, [yd], state.slopeDeg)[0];
    if (!p) { fe.elev.textContent = fe.wind.textContent = '–'; return; }
    const [unit, value] = el.cClick.value.split(':'), click = Number(value), uName = unit === 'mil' ? 'mil' : 'MOA', dig = unit === 'mil' ? 2 : 1;
    const len = inch => (metric() ? inch * BTS.CM_PER_INCH : inch).toFixed(1) + ' ' + u.h;
    const elevA = BTS.angleOf(p.y, yd, unit), elevN = Math.round(Math.abs(elevA) / click);
    if (elevN === 0) {
      fe.elev.innerHTML = '<span class="word">Dead-on</span>';
      fe.elevSub.textContent = 'Within half a click' + (Math.abs(p.y) < 0.05 ? ' · on the aim point' : ` · bullet ${len(Math.abs(p.y))} ${p.y < 0 ? 'low' : 'high'}`);
    } else {
      fe.elev.innerHTML = `${elevN} <b>${elevA < 0 ? 'UP' : 'DOWN'}</b>`;
      fe.elevSub.textContent = `${Math.abs(elevA).toFixed(dig)} ${uName} · bullet ${len(Math.abs(p.y))} ${p.y < 0 ? 'low' : 'high'}`;
    }
    const side = driftSide(), driftIn = BTS.windDriftIn(state.windMph * windFactor(), yd, p.t, r.vFps);
    const windA = BTS.angleOf(driftIn, yd, unit), windN = side ? Math.round(Math.abs(windA) / click) : 0;
    if (!side) {
      fe.wind.innerHTML = '<span class="word">None</span>';
      fe.windSub.textContent = state.windMph ? `${windDisplay()} ${u.w} from ${state.windClock} o'clock doesn't push sideways` : 'No crosswind entered';
    } else {
      fe.wind.innerHTML = windN ? `${windN} <b>${side === 'left' ? 'RIGHT' : 'LEFT'}</b>` : '<span class="word">None</span>';
      fe.windSub.textContent = `${Math.abs(windA).toFixed(dig)} ${uName} · drifts ${len(Math.abs(driftIn))} ${side} · ${windText(u)}`;
    }
    const v = metric() ? p.v * 0.3048 : p.v, grains = w ? w.grains : 0;
    const e = metric() ? BTS.energyFtLb(grains, p.v) * 1.35582 : BTS.energyFtLb(grains, p.v);
    fe.stats.textContent = `${Math.round(v).toLocaleString()} ${u.v} · ${Math.round(e).toLocaleString()} ${u.e} · ${p.t.toFixed(3)} s` +
      ` · ${el.cClick.selectedOptions[0] ? el.cClick.selectedOptions[0].textContent : ''}` +
      (state.slopeDeg ? ` · ${slopeText(state.slopeDeg)}, line-of-sight range` : '');
    const warn = r.vFps >= SOUND_FPS && p.v < SOUND_FPS ? 'Subsonic at this range: the bullet may destabilize, so confirm on paper.'
      : r.vFps >= TRANSONIC_FPS && p.v < TRANSONIC_FPS ? 'Transonic at this range: expect more spread than the numbers suggest.' : '';
    fe.warn.hidden = !warn;
    fe.warn.textContent = warn;

    // Point-blank range for the current zero and vital zone (level ground).
    const half = state.vitalIn / 2, zone = len(state.vitalIn).replace('.0 ', ' ');
    const mine = BTS.pointBlankAt(r.vFps, r.bc, r.sightIn, r.angle, half, PBR_MAX_YD);
    const end = mine.endYd == null ? null : Math.round(toDispDist(mine.endYd)), level = state.slopeDeg ? ' (level ground)' : '';
    const endTxt = end == null ? `past ${Math.round(toDispDist(PBR_MAX_YD))} ${u.d}` : `${end} ${u.d}`;
    if (mine.apexIn > half + 0.005) {
      fe.pbr.className = 'f-pbr out';
      fe.pbr.innerHTML = `<strong>Use the holds.</strong> Your ${r.zero} ${u.d} zero rises ${len(mine.apexIn)} above a ${zone} vital zone.`;
    } else if (yd >= mine.startYd - 1e-9 && (mine.endYd == null || yd <= mine.endYd + 1e-9)) {
      fe.pbr.className = 'f-pbr in';
      fe.pbr.innerHTML = `<strong>Aim dead-on.</strong> Inside point-blank range for a ${zone} vital zone: ${Math.round(toDispDist(mine.startYd))}–${endTxt}${level}.`;
    } else {
      fe.pbr.className = 'f-pbr out';
      fe.pbr.innerHTML = yd < mine.startYd ? `<strong>Closer than point-blank range.</strong> It starts at ${Math.round(toDispDist(mine.startYd))} ${u.d} for a ${zone} vital zone.`
        : `<strong>Past point-blank range.</strong> Dead-on works to ${endTxt} for a ${zone} vital zone${level}; use the holds.`;
    }
  }

  // Saved setups as a quick profile switch (opening one changes nothing that's stored).
  function fillFieldSaved() {
    const list = (readSaved() || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    fe.savedWrap.hidden = !list.length;
    fe.saved.innerHTML = '<option value="">Switch setup…</option>' + list.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  }
  fe.saved.addEventListener('change', () => {
    const s = (readSaved() || []).find(x => x.name === fe.saved.value);
    fe.saved.value = '';
    if (s && applyShareCode('#' + s.code)) toast(`Opened “${s.name}”`);
  });

  fe.range.addEventListener('input', () => {
    const v = parseFloat(fe.range.value), yd = fromDispDist(v);
    if (yd >= 1 && yd <= FIELD_MAX_YD) setFieldYd(yd);
  });
  fe.range.addEventListener('blur', renderField);
  function stepRange(dir) {
    const step = FIELD_STEP[state.mode], cur = toDispDist(fieldYd());
    const next = dir > 0 ? Math.floor(cur / step + 1e-9) * step + step : Math.ceil(cur / step - 1e-9) * step - step;
    setFieldYd(fromDispDist(Math.max(step, next)));
  }
  fe.minus.addEventListener('click', () => stepRange(-1));
  fe.plus.addEventListener('click', () => stepRange(1));
  fe.presets.addEventListener('click', e => {
    const b = e.target.closest('button[data-range]');
    if (b) setFieldYd(fromDispDist(Number(b.dataset.range)));
  });

  // Conditions: the same preferences as Setup's trajectory controls.
  function setWindDisplay(v) {
    if (!(v >= 0 && v < 100)) return;
    state.windMph = metric() ? v / KMH_PER_MPH : v;
    savePref('wind', String(state.windMph));
    showWind();
    refreshTable();
  }
  fe.windSpd.addEventListener('input', () => setWindDisplay(fe.windSpd.value === '' ? 0 : parseFloat(fe.windSpd.value)));
  fe.windSpd.addEventListener('blur', renderField);
  fe.wMinus.addEventListener('click', () => setWindDisplay(Math.max(0, Math.ceil(windDisplay() - 1e-9) - 1)));
  fe.wPlus.addEventListener('click', () => setWindDisplay(Math.min(99, Math.floor(windDisplay() + 1e-9) + 1)));
  fe.clock.innerHTML = el.windClock.innerHTML;
  fe.slope.innerHTML = el.slope.innerHTML;
  fe.click.innerHTML = el.cClick.innerHTML;
  fe.clock.addEventListener('change', () => { el.windClock.value = fe.clock.value; el.windClock.dispatchEvent(new Event('change')); });
  fe.slope.addEventListener('change', () => { el.slope.value = fe.slope.value; el.slope.dispatchEvent(new Event('change')); });
  fe.click.addEventListener('change', () => setClick(fe.click.value));
  fe.chip.addEventListener('click', () => setView('setup'));
  fe.error.addEventListener('click', e => { if (e.target.closest('[data-go]')) setView('setup'); });

  // Keep the screen on while Field is showing (where the browser supports it); the lock drops when the page is hidden.
  let wakeLock = null;
  const wakeSupported = 'wakeLock' in navigator;
  fe.wakeWrap.hidden = !wakeSupported;
  fe.wake.checked = loadPref('wake', 'on') === 'on';
  async function syncWake() {
    const want = wakeSupported && state.view === 'field' && fe.wake.checked && document.visibilityState === 'visible';
    if (want && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; showFieldStatus(); });
      } catch (e) { wakeLock = null; }
    } else if (!want && wakeLock) {
      const l = wakeLock; wakeLock = null;
      l.release().catch(() => {});
    }
    showFieldStatus();
  }
  function showFieldStatus() {
    const offline = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
    fe.status.textContent = [wakeLock ? 'Screen stays on' : '', offline ? 'Works offline' : ''].filter(Boolean).join(' · ');
  }
  fe.wake.addEventListener('change', () => { savePref('wake', fe.wake.checked ? 'on' : 'off'); syncWake(); });
  document.addEventListener('visibilitychange', syncWake);

  // Setup / Field tabs.
  function setView(view, save = true) {
    state.view = view;
    if (save) savePref('view', view);
    setPressed('[data-view]', 'data-view', view);
    fe.setup.hidden = view !== 'setup';
    fe.view.hidden = view !== 'field';
    cmpEl.view.hidden = view !== 'compare';
    document.body.classList.toggle('in-field', view === 'field');
    document.body.classList.toggle('in-compare', view === 'compare');
    if (view === 'field') { fillFieldSaved(); renderField(); }
    else if (view === 'compare') { fillCompareFrom(); renderCompare(); }
    else if (state.result && !state.result.error) drawChart();   // drawn while hidden, the chart had no size
    syncWake();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  // Themes: Dark, Sun (high contrast for bright light) and Night (red, keeps night vision).
  const THEME_BG = { dark: '#0b0f14', sun: '#ffffff', night: '#000000' };
  function setTheme(theme, save = true) {
    state.theme = theme;
    if (save) savePref('theme', theme);
    if (theme === 'dark') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    setPressed('[data-theme-pick]', 'data-theme-pick', theme);
    document.querySelector('meta[name="color-scheme"]').content = theme === 'sun' ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]').content = THEME_BG[theme];
    if (state.result && !state.result.error && state.view === 'setup') drawChart();
    if (save && state.view === 'compare') renderCompare();   // the Compare section isn't set up yet on the first call
  }
  document.querySelectorAll('[data-theme-pick]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themePick)));
  setTheme(state.theme, false);

  // ---------- Compare: two loads side by side (trajectory and impact ballistics) ----------
  // Each side has its own firearm, caliber (or one of my loads), weight, shape, velocity, B.C. and sight height, and can be
  // filled from the current Setup or a saved setup. Both share one zero unless B gets its own. Wind and the vital zone are
  // the same preferences Setup and Field use; the comparison is on level ground. Nothing here changes Setup.
  const CMP_ZEROS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
  const CMP_MAX = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000];
  const CMP_FAR_YD = 2000;   // how far the energy cutoffs and supersonic range are looked for
  const GAME_ENERGY = [{ name: 'deer', ftlb: 1000 }, { name: 'elk', ftlb: 1500 }, { name: 'moose', ftlb: 2000 }];
  const CMP_B_START = { rifle: '6.5mm Creedmoor', pistol: '45 ACP', shotgun: '20 gauge slug barrel' };
  const cmpEl = { view: $('compare-view'), zero: $('cmp-zero'), zeroB: $('cmp-zero-b'), zeroBWrap: $('cmp-zero-b-wrap'), split: $('cmp-split'), max: $('cmp-max'),
    cond: $('cmp-cond'), error: $('cmp-error'), results: $('cmp-results'), summary: $('cmp-summary'), sumNote: $('cmp-sum-note'),
    chart: $('cmp-chart'), keyA: $('cmp-key-a'), keyB: $('cmp-key-b'), table: $('cmp-table'), tableNote: $('cmp-table-note') };
  const sides = ['a', 'b'].map(k => ({
    key: k, K: k.toUpperCase(), lists: {},
    name: $(`cmp-${k}-name`), from: $(`cmp-${k}-from`), mode: $(`cmp-${k}-mode`), sight: $(`cmp-${k}-sight`),
    caliberLabel: $(`cmp-${k}-caliber-label`), search: $(`cmp-${k}-search`), caliber: $(`cmp-${k}-caliber`), count: $(`cmp-${k}-count`),
    weight: $(`cmp-${k}-weight`), shape: $(`cmp-${k}-shape`), vel: $(`cmp-${k}-vel`), bc: $(`cmp-${k}-bc`),
    vnote: $(`cmp-${k}-vnote`), typical: $(`cmp-${k}-typical`)
  }));

  // What each side is, kept as a per-viewer preference: { mode, name, grains, shape, vFps, bc, custom, sightIn }.
  let cmp = null, cmpLast = null;   // cmpLast: the last good { A, B } results, for printing
  function cmpSave() { savePref('compare', JSON.stringify(cmp)); }
  function cmpLoadState() {
    try { const v = JSON.parse(loadPref('compare', 'null')); if (v && v.a && v.b) return v; } catch (e) { /* ignore */ }
    return null;
  }
  // A side as Setup has it now, or as a saved setup's link describes it (null if it can't be read).
  function profileFromCode(code) {
    const m0 = ('#' + code).match(SHARE_RE);
    if (!m0) return null;
    const version = m0[1], m = m0.slice(1), n = s => parseInt(s, 36);
    const flags = n(m[1]), mode = BTS.MODES[flags >> 3], met = !!(flags & 4);
    if (!mode) return null;
    const sights = BTS.sightHeights(mode, met), sg = sights[Math.min(n(m[3]), sights.length - 1)];
    const out = { mode, sightIn: sg.inches, custom: false };
    if (m[13]) {
      const linked = normLoad({ name: decodeName(m[16]) || 'Load from link', mode, grains: n(m[13]) / 10, fps: n(m[14]), bc: n(m[15]) / 1000 });
      if (!linked) return null;
      const saved = modeLoads(mode).find(l => sameLoad(l, linked)) || Object.assign(linked, { adhoc: true });
      if (saved.adhoc) out.adhoc = saved;
      Object.assign(out, { name: saved.name, grains: saved.grains, shape: LOAD_SHAPE, vFps: saved.fps, bc: saved.bc });
    } else {
      const names = BTS.calibers(mode), ci = n(m[2]);
      if (ci >= names.length) return null;
      let w;
      if (version === '1') {
        const old = BTS.v1Weights(mode, ci, met)[n(m[4])], list = BTS.weights(mode, ci, met);
        w = old ? list[nearestIndex(list, old.grains, x => x.grains)] : null;
      } else { const list = BTS.weights(mode, ci, met); w = list[Math.min(n(m[4]), list.length - 1)]; }
      const shapes = BTS.shapes(mode, ci), sh = shapes[Math.min(n(m[5]), shapes.length - 1)];
      if (!w || !sh) return null;
      Object.assign(out, { name: names[ci], grains: w.grains, shape: sh.label, vFps: BTS.typicalVelocityFps(mode, ci, w), bc: BTS.typicalBc(mode, ci, w, sh.index) });
    }
    if (m[8]) {
      const v = n(m[8]);
      Object.assign(out, { vFps: met ? v * FPS_PER_MPS : v, bc: n(m[9]) / 1000, custom: true });
    } else if (m[10] && mode !== 'shotgun') {
      const adj = Math.round((n(m[10]) / 10 - (n(m[11]) / 10 || BARREL_REF_IN[mode])) * n(m[12]));
      if (adj) Object.assign(out, { vFps: Math.max(100, out.vFps + adj), custom: true });
    }
    return out;
  }
  function cmpInit() {
    cmp = cmpLoadState();
    if (cmp) return;
    const a = profileFromCode(shareCode()) || { mode: 'rifle', name: DEFAULTS.rifle.caliber, sightIn: 1.5 };
    const b = { mode: a.mode, name: CMP_B_START[a.mode], sightIn: a.sightIn };
    const zeroYd = state.result ? state.result.zeroYd : DEFAULTS[a.mode].zero;
    cmp = { a, b, zeroYd, zeroBYd: zeroYd, split: false, maxYd: a.mode === 'rifle' ? 500 : 100, chart: 'path', table: 'trajectory' };
  }

  // My loads for the side's firearm, plus a load it brought from a link or saved setup that isn't in My loads.
  function sideLoads(st) {
    const base = modeLoads(st.mode);
    return st.adhoc && st.adhoc.mode === st.mode && !base.some(l => sameLoad(l, st.adhoc)) ? base.concat([st.adhoc]) : base;
  }

  // Rebuilds one side's lists from its kept values (typical velocity and B.C. unless they were typed or came with the profile).
  function buildSide(sd) {
    const st = cmp[sd.key], mode = BTS.MODES.includes(st.mode) ? st.mode : 'rifle';
    st.mode = mode;
    sd.mode.value = mode;
    const names = BTS.calibers(mode), loads = sideLoads(st);
    let pick = names.indexOf(st.name);
    if (pick < 0) { const k = loads.findIndex(l => l.name === st.name); if (k >= 0) pick = LOAD_BASE + k; }
    if (pick < 0) pick = Math.max(0, names.indexOf(DEFAULTS[mode].caliber));
    sd.caliberLabel.textContent = mode === 'shotgun' ? 'Gauge or load' : 'Caliber or load';
    sd.search.parentElement.hidden = mode === 'shotgun';
    if (mode === 'shotgun') sd.search.value = '';
    fillCaliberSelect(sd.caliber, sd.count, pick, sd.search.value, mode, loads);
    const v = idx(sd.caliber), load = v >= LOAD_BASE ? loads[v - LOAD_BASE] || null : null, ci = load ? -1 : v;
    const picked = load ? load.name : names[ci];
    if (picked !== st.name) { st.name = picked; st.grains = null; st.custom = false; }
    sd.lists.load = load;
    sd.lists.ci = ci;
    if (load) {
      sd.lists.weights = [{ label: loadWeightLabel(load.grains, mode), grains: load.grains }];
      sd.lists.shapes = [{ label: LOAD_SHAPE, index: -1 }];
    } else {
      sd.lists.weights = BTS.weights(mode, ci, metric());
      sd.lists.shapes = BTS.shapes(mode, ci);
    }
    fill(sd.weight, sd.lists.weights, w => w.label, nearestIndex(sd.lists.weights, st.grains == null ? (load ? load.grains : startGrainsFor(mode, ci)) : st.grains, w => w.grains));
    fill(sd.shape, sd.lists.shapes, s => s.label, startShape(sd.lists.shapes, st.shape));
    sd.weight.disabled = sd.shape.disabled = !!load;
    st.grains = sd.lists.weights[idx(sd.weight)].grains;
    st.shape = sd.lists.shapes[idx(sd.shape)].label;
    sd.lists.sights = BTS.sightHeights(mode, metric());
    fill(sd.sight, sd.lists.sights, s => s.label, nearestIndex(sd.lists.sights, st.sightIn == null ? DEFAULTS[mode].sightIn : st.sightIn, s => s.inches));
    st.sightIn = sd.lists.sights[idx(sd.sight)].inches;
    const w = sd.lists.weights[idx(sd.weight)], s = sd.lists.shapes[idx(sd.shape)];
    sd.lists.typicalFps = load ? load.fps : BTS.typicalVelocityFps(mode, ci, w);
    sd.lists.typicalBc = load ? load.bc : BTS.typicalBc(mode, ci, w, s.index);
    if (!st.custom || !(st.vFps > 0) || !(st.bc > 0)) { st.vFps = sd.lists.typicalFps; st.bc = sd.lists.typicalBc; st.custom = false; }
    if (document.activeElement !== sd.vel) sd.vel.value = String(metric() ? BTS.roundHalfEven(st.vFps / FPS_PER_MPS) : BTS.roundHalfEven(st.vFps));
    if (document.activeElement !== sd.bc) sd.bc.value = st.bc.toFixed(3);
    sd.vel.parentElement.querySelector('.cmp-vunit').textContent = metric() ? 'm/s' : 'fps';
    sd.vnote.textContent = st.custom ? 'Your velocity and B.C.' : load ? 'From your load.' : 'Typical velocity and B.C.';
    sd.typical.hidden = !st.custom;
    sd.name.textContent = cmpLabel(sd);
  }
  function startGrainsFor(mode, ci) {
    if (mode === 'shotgun') return BTS.GAUGES[ci].eighths[0] === 5 ? 437.5 : 0.75 * 437.5;
    const row = BTS_DATA[mode][ci];
    return row[7] || (row[2] + row[3]) / 2;
  }
  function cmpLabel(sd) {
    const st = cmp[sd.key];
    return sd.lists.load ? st.name : `${st.name.split(' (')[0]} ${sd.lists.weights[idx(sd.weight)].label}`;
  }
  function cmpDiameter(sd) {
    const st = cmp[sd.key], ci = sd.lists.ci;
    if (ci < 0) return null;
    return st.mode === 'shotgun' ? BTS.GAUGES[ci].diameter : BTS_DATA[st.mode][ci][1];
  }

  function fillCompareFrom() {
    const list = (readSaved() || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    // Looked up here (not through `sides`) because the saved list is first drawn before this section runs.
    document.querySelectorAll('.cmp-from select').forEach(sel => {
      sel.innerHTML = '<option value="">Fill from…</option><option value="#setup">Current Setup</option>' +
        list.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    });
  }

  function fillShared() {
    const u = metric() ? 'm' : 'yd', toD = yd => toDispDist(yd);
    const near = (list, yd) => nearestIndex(list, toD(yd), x => x);
    fill(cmpEl.zero, CMP_ZEROS, z => z + ' ' + u, near(CMP_ZEROS, cmp.zeroYd));
    fill(cmpEl.zeroB, CMP_ZEROS, z => z + ' ' + u, near(CMP_ZEROS, cmp.zeroBYd));
    fill(cmpEl.max, CMP_MAX, z => z + ' ' + u, near(CMP_MAX, cmp.maxYd));
    cmpEl.split.checked = !!cmp.split;
    cmpEl.zeroBWrap.hidden = !cmp.split;
    $('cmp-zero-label').textContent = cmp.split ? 'A’s zero range' : 'Zero range';
    setPressed('[data-cmp-chart]', 'data-cmp-chart', cmp.chart);
    setPressed('[data-cmp-table]', 'data-cmp-table', cmp.table);
  }

  // One side's solution: bore angle for its zero, plus a fine sweep for the energy cutoffs and supersonic range.
  function sideResult(sd, zeroYd) {
    const st = cmp[sd.key], grains = st.grains, dia = cmpDiameter(sd);
    const out = { label: cmpLabel(sd), vFps: st.vFps, bc: st.bc, sightIn: st.sightIn, grains, dia, zeroYd };
    const sol = BTS.solve(st.vFps, st.bc, st.sightIn, zeroYd);
    if (sol.rising || !isFinite(sol.meetYd) || sol.meetYd <= 0) { out.error = true; return out; }
    out.angle = sol.angle;
    const step = 5, far = [];
    for (let r = step; r <= CMP_FAR_YD; r += step) far.push(r);
    const pts = BTS.trajectoryTable(st.vFps, st.bc, st.sightIn, sol.angle, far, 0);
    const crossing = (valueAt, level) => {
      let prevV = valueAt(st.vFps), prevR = 0;
      if (prevV < level) return 0;
      for (let i = 0; i < pts.length; i++) {
        const v = valueAt(pts[i].v);
        if (v < level) return prevR + (prevV - level) / (prevV - v) * (far[i] - prevR);
        prevV = v; prevR = far[i];
      }
      return null;   // still above at CMP_FAR_YD
    };
    out.supersonicYd = st.vFps < BTS.ATMOSPHERE.soundFps ? 0 : crossing(v => v, BTS.ATMOSPHERE.soundFps);
    out.cutoffs = GAME_ENERGY.map(g => crossing(v => BTS.energyFtLb(grains, v), g.ftlb));
    const half = state.vitalIn / 2;
    out.pbr = BTS.pointBlankAt(st.vFps, st.bc, st.sightIn, sol.angle, half, PBR_MAX_YD);
    out.pbr.over = out.pbr.apexIn > half + 0.005;
    out.best = BTS.pointBlank(st.vFps, st.bc, st.sightIn, half, PBR_MAX_YD);
    return out;
  }

  const momentum = (gr, fps) => gr / 7000 * fps;               // lb·ft/s
  const taylorKo = (gr, fps, dia) => gr * fps * dia / 7000;
  const sectional = (gr, dia) => gr / 7000 / (dia * dia);

  function renderCompare() {
    if (state.view !== 'compare') return;
    if (!cmp) cmpInit();
    fillShared();
    sides.forEach(buildSide);
    cmpSave();
    const u = trajectoryUnits(), A = sideResult(sides[0], cmp.zeroYd), B = sideResult(sides[1], cmp.split ? cmp.zeroBYd : cmp.zeroYd);
    cmpEl.cond.textContent = `Wind ${windText(u)}, a ${len1(state.vitalIn)} vital zone for point-blank range, level ground. ` +
      'Wind and vital zone are the ones set in Setup and Field.';
    const bad = [A, B].filter(r => r.error);
    cmpEl.error.hidden = !bad.length;
    cmpEl.error.textContent = bad.map(r => `${r === A ? 'A' : 'B'} (${r.label}) can’t be zeroed at ${Math.round(toDispDist(r.zeroYd))} ${u.d}: the bullet is still rising there.`).join(' ') +
      (bad.length ? ' Choose a longer zero.' : '');
    cmpEl.results.hidden = !!bad.length;
    $('cmp-copy').disabled = false;
    $('cmp-print').disabled = !!bad.length;
    cmpLast = bad.length ? null : { A, B };
    if (bad.length) return;
    cmpEl.keyA.textContent = 'A: ' + A.label;
    cmpEl.keyB.textContent = 'B: ' + B.label;
    renderCmpSummary(A, B, u);
    renderCmpTable(A, B, u);
    drawCmpChart(A, B, u);
  }
  function len1(inch) { return metric() ? (inch * BTS.CM_PER_INCH).toFixed(1).replace(/\.0$/, '') + ' cm' : (+inch.toFixed(1)) + ' in'; }

  // The side-by-side table (screen and print). The last column is B − A where both are numbers.
  function cmpSummaryHtml(A, B, u) {
    const dist = yd => Math.round(toDispDist(yd)).toLocaleString() + ' ' + u.d;
    const velN = fps => metric() ? fps * 0.3048 : fps, enN = ftlb => metric() ? ftlb * 1.35582 : ftlb;
    const momN = (gr, fps) => metric() ? gr * 0.06479891 / 1000 * fps * 0.3048 : momentum(gr, fps);
    const vel = fps => Math.round(velN(fps)).toLocaleString() + ' ' + u.v;
    const en = ftlb => Math.round(enN(ftlb)).toLocaleString() + ' ' + u.e;
    const momU = metric() ? 'kg·m/s' : 'lb·ft/s';
    const reach = yd => yd == null ? 'past ' + dist(CMP_FAR_YD) : yd === 0 ? 'never' : dist(yd);
    const reachN = yd => yd == null ? Infinity : yd;
    const pbrText = r => r.pbr.over ? `none (rises ${len1(r.pbr.apexIn)})` : (r.pbr.endYd == null ? `${dist(r.pbr.startYd)} to past ${dist(PBR_MAX_YD)}` : `${Math.round(toDispDist(r.pbr.startYd))}–${dist(r.pbr.endYd)}`);
    const sign = (v, dig) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: dig, maximumFractionDigits: dig });
    // Difference formatters: `d(aN, bN)` gets the raw numbers and returns text in display units.
    const diffIn = (dig, unit, conv = x => x) => (a, b) => `${sign(conv(b) - conv(a), dig)}${unit ? ' ' + unit : ''}` + (conv(a) ? ` (${sign((conv(b) - conv(a)) / Math.abs(conv(a)) * 100, 0)}%)` : '');
    const diffDist = (a, b) => isFinite(a) && isFinite(b) ? `${sign(Math.round(toDispDist(b)) - Math.round(toDispDist(a)), 0)} ${u.d}` : '–';
    const rows = [];
    const row = (label, a, b, opts = {}) => rows.push(Object.assign({ label, a, b }, opts));
    const grp = label => rows.push({ grp: label });
    grp('Bullet');
    row('Weight', loadWeightLabel(A.grains, cmp.a.mode), loadWeightLabel(B.grains, cmp.b.mode),
      { aN: A.grains, bN: B.grains, diff: diffIn(1, metric() ? 'g' : 'gr', g => metric() ? g * 0.06479891 : g) });
    const diaTxt = d => d ? (metric() ? (d * 25.4).toFixed(2) + ' mm' : d.toFixed(3) + ' in') : '–';
    row('Diameter', diaTxt(A.dia), diaTxt(B.dia), { aN: A.dia, bN: B.dia, diff: diffIn(metric() ? 2 : 3, metric() ? 'mm' : 'in', d => metric() ? d * 25.4 : d) });
    const sdA = A.dia ? sectional(A.grains, A.dia) : null, sdB = B.dia ? sectional(B.grains, B.dia) : null;
    row('Sectional density', sdA != null ? sdA.toFixed(3) : '–', sdB != null ? sdB.toFixed(3) : '–',
      { better: 'high', aN: sdA, bN: sdB, diff: diffIn(3, ''), sub: 'Weight for its diameter; a rough guide to penetration' });
    row('G1 B.C.', A.bc.toFixed(3), B.bc.toFixed(3), { better: 'high', aN: A.bc, bN: B.bc, diff: diffIn(3, ''), sub: 'Higher holds velocity and bucks wind better' });
    grp('At the muzzle');
    row('Velocity', vel(A.vFps), vel(B.vFps), { better: 'high', aN: A.vFps, bN: B.vFps, diff: diffIn(0, u.v, velN) });
    const eA = BTS.energyFtLb(A.grains, A.vFps), eB = BTS.energyFtLb(B.grains, B.vFps);
    row('Energy', en(eA), en(eB), { better: 'high', aN: eA, bN: eB, diff: diffIn(0, u.e, enN) });
    row('Momentum', momN(A.grains, A.vFps).toFixed(1) + ' ' + momU, momN(B.grains, B.vFps).toFixed(1) + ' ' + momU,
      { better: 'high', aN: momentum(A.grains, A.vFps), bN: momentum(B.grains, B.vFps), diff: diffIn(1, momU, m => metric() ? m * 0.45359237 * 0.3048 : m) });
    const tA = A.dia ? taylorKo(A.grains, A.vFps, A.dia) : null, tB = B.dia ? taylorKo(B.grains, B.vFps, B.dia) : null;
    row('Taylor KO factor', tA != null ? tA.toFixed(1) : '–', tB != null ? tB.toFixed(1) : '–',
      { better: 'high', aN: tA, bN: tB, diff: diffIn(1, ''), sub: 'Weight × velocity × diameter ÷ 7000' });
    grp('Reach');
    const zA = Math.round(toDispDist(A.zeroYd)), zB = Math.round(toDispDist(B.zeroYd));
    row(`Point-blank range, ${len1(state.vitalIn)} zone`, pbrText(A) + (cmp.split ? ` (${zA} ${u.d} zero)` : ''), pbrText(B) + (cmp.split ? ` (${zB} ${u.d} zero)` : ''),
      { better: 'high', aN: A.pbr.over ? 0 : reachN(A.pbr.endYd), bN: B.pbr.over ? 0 : reachN(B.pbr.endYd), diff: diffDist, sub: cmp.split ? 'With each zero' : `With the ${zA} ${u.d} zero` });
    row('Longest point-blank range', `${reach(A.best.endYd)}<span class="sub">zero at ${A.best.farZeroYd ? dist(A.best.farZeroYd) : '–'}</span>`,
      `${reach(B.best.endYd)}<span class="sub">zero at ${B.best.farZeroYd ? dist(B.best.farZeroYd) : '–'}</span>`,
      { better: 'high', aN: reachN(A.best.endYd), bN: reachN(B.best.endYd), diff: diffDist, sub: 'With the best zero for this zone' });
    row('Supersonic to', reach(A.supersonicYd), reach(B.supersonicYd),
      { better: 'high', aN: reachN(A.supersonicYd), bN: reachN(B.supersonicYd), diff: diffDist, sub: `Above ${vel(BTS.ATMOSPHERE.soundFps)}, the speed of sound at 59 °F` });
    GAME_ENERGY.forEach((g, i) => row(`${en(g.ftlb)}+ (${g.name}) to`, reach(A.cutoffs[i]), reach(B.cutoffs[i]),
      { better: 'high', aN: reachN(A.cutoffs[i]), bN: reachN(B.cutoffs[i]), diff: diffDist }));
    let h = `<thead><tr><th></th><th class="side-a-h" title="${esc(A.label)}">A: ${esc(A.label)}</th><th class="side-b-h" title="${esc(B.label)}">B: ${esc(B.label)}</th><th class="diff-h">B − A</th></tr></thead><tbody>`;
    // The ▲ goes right after the value, before any small line under it.
    const mark = (v, win) => !win ? v : v.includes('<span class="sub">') ? v.replace('<span class="sub">', '<span class="mk" aria-label="higher"> ▲</span><span class="sub">') : v + '<span class="mk" aria-label="higher"> ▲</span>';
    rows.forEach(r => {
      if (r.grp) { h += `<tr class="grp"><th colspan="4">${r.grp}</th></tr>`; return; }
      let wa = false, wb = false;
      const both = r.aN != null && r.bN != null;
      if (r.better && both && r.aN !== r.bN) {
        const big = Math.max(Math.abs(r.aN), Math.abs(r.bN));
        if (!isFinite(big) || Math.abs(r.aN - r.bN) / big > 0.005) { wa = r.aN > r.bN; wb = !wa; }
      }
      const diff = both && r.diff ? r.diff(r.aN, r.bN) : '–';
      h += `<tr><th scope="row">${esc(r.label)}${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ''}</th><td${wa ? ' class="win"' : ''}>${mark(r.a, wa)}</td><td${wb ? ' class="win"' : ''}>${mark(r.b, wb)}</td><td class="diff">${diff}</td></tr>`;
    });
    return h + '</tbody>';
  }
  function renderCmpSummary(A, B, u) {
    cmpEl.summary.innerHTML = cmpSummaryHtml(A, B, u);
    cmpEl.sumNote.textContent = '▲ marks the higher value; B − A is the difference. Energy figures for game are common rules of thumb, not a guarantee: shot placement and bullet construction matter more.' +
      (A.dia && B.dia ? '' : ' Sectional density and Taylor KO need a caliber; a load of your own doesn’t say its diameter.');
  }

  // Rows every tenth of the chosen distance, in display units.
  function cmpRanges() {
    const maxD = Math.round(toDispDist(cmp.maxYd)), step = maxD / 10, out = [];
    for (let i = 0; i <= 10; i++) out.push(Math.round(i * step * 10) / 10);
    return out;
  }
  function sideRows(r, rangesD) {
    const windMph = state.windMph * windFactor(), k = metric() ? BTS.CM_PER_INCH : 1;
    const yds = rangesD.map(d => Math.max(0.01, fromDispDist(d)));
    return BTS.trajectoryTable(r.vFps, r.bc, r.sightIn, r.angle, yds, 0).map((p, i) => ({
      range: rangesD[i], path: i === 0 ? -r.sightIn * k : p.y * k, drift: i === 0 ? 0 : BTS.windDriftIn(windMph, yds[i], p.t, r.vFps) * k,
      time: i === 0 ? 0 : p.t, v: i === 0 ? r.vFps : p.v
    }));
  }
  function renderCmpTable(A, B, u) {
    cmpEl.table.innerHTML = cmpTableHtml(A, B, u);
    cmpEl.tableNote.textContent = cmp.table === 'impact'
      ? 'Momentum and Taylor KO favor heavy, wide bullets; energy favors speed. None of them measures how a bullet expands.'
      : `Path is from the line of sight with ${cmp.split ? 'each side’s own zero' : 'the shared zero'}. Drift is for ${windText(u)}.`;
  }
  function cmpTableHtml(A, B, u) {
    const ranges = cmpRanges(), ra = sideRows(A, ranges), rb = sideRows(B, ranges), side = driftSide();
    const vel = fps => Math.round(metric() ? fps * 0.3048 : fps).toLocaleString();
    const en = (gr, fps) => Math.round(metric() ? BTS.energyFtLb(gr, fps) * 1.35582 : BTS.energyFtLb(gr, fps)).toLocaleString();
    const mom = (gr, fps) => (metric() ? gr * 0.06479891 / 1000 * fps * 0.3048 : momentum(gr, fps)).toFixed(1);
    const tko = (r, fps) => r.dia ? taylorKo(r.grains, fps, r.dia).toFixed(1) : '–';
    const cols = cmp.table === 'impact'
      ? [[`Velocity (${u.v})`, (r, x) => vel(x.v)], [`Energy (${u.e})`, (r, x) => en(r.grains, x.v)],
         [`Momentum (${metric() ? 'kg·m/s' : 'lb·ft/s'})`, (r, x) => mom(r.grains, x.v)], ['Taylor KO', (r, x) => tko(r, x.v)]]
      : [[`Path (${u.h})`, (r, x) => signed(x.path, 1)], [`Drift${side ? ' ' + side : ''} (${u.h})`, (r, x) => x.drift.toFixed(1)], ['Time (s)', (r, x) => x.time.toFixed(3)]];
    let h = `<thead><tr><th></th>${cols.map(c => `<th class="grp sep" colspan="2">${c[0]}</th>`).join('')}</tr>` +
      `<tr><th>Range (${u.d})</th>${cols.map(() => '<th class="sep side-a-h">A</th><th class="side-b-h">B</th>').join('')}</tr></thead><tbody>`;
    ranges.forEach((d, i) => {
      h += `<tr><td>${d}</td>${cols.map(c => `<td class="sep">${c[1](A, ra[i])}</td><td class="cmp">${c[1](B, rb[i])}</td>`).join('')}</tr>`;
    });
    return h + '</tbody>';
  }

  // Path, velocity or energy for both sides, with reference marks: the vital zone around the line of sight (path),
  // the speed of sound (velocity) and the game energy levels (energy).
  function cmpChartSvg(A, B, u, kind, w, h, colors, interactive) {
    const maxD = toDispDist(cmp.maxYd), n = 120, xs = [];
    for (let i = 0; i <= n; i++) xs.push(maxD * i / n);
    const ra = sideRows(A, xs), rb = sideRows(B, xs);
    const enConv = ftlb => metric() ? ftlb * 1.35582 : ftlb, velConv = fps => metric() ? fps * 0.3048 : fps;
    const pick = {
      path: { y: x => x.path, unit: u.h, title: `Path (${u.h})` },
      velocity: { y: x => velConv(x.v), unit: u.v, title: `Velocity (${u.v})` },
      energy: { y: (x, r) => enConv(BTS.energyFtLb(r.grains, x.v)), unit: u.e, title: `Energy (${u.e})` }
    }[kind];
    const ya = ra.map(x => pick.y(x, A)), yb = rb.map(x => pick.y(x, B));
    const half = (metric() ? BTS.CM_PER_INCH : 1) * state.vitalIn / 2;
    const refs = kind === 'energy' ? GAME_ENERGY.map(g => ({ y: enConv(g.ftlb), label: g.name }))
      : kind === 'velocity' ? [{ y: velConv(BTS.ATMOSPHERE.soundFps), label: 'speed of sound' }] : [];
    const fs = w >= 700 ? 15 : 14;
    let yMin = Math.min(...ya, ...yb), yMax = Math.max(...ya, ...yb);
    if (kind === 'path') { yMin = Math.min(yMin, -half); yMax = Math.max(yMax, half); } else yMin = 0;
    const pad = (yMax - yMin) * 0.08 || 1;
    yMax += pad; if (kind === 'path') yMin -= pad;
    const ys = niceStep(yMax - yMin, 7), xst = niceStep(maxD, 9);
    yMin = Math.floor(yMin / ys) * ys; yMax = Math.ceil(yMax / ys) * ys;
    const dec = v => (Math.abs(v) < 1e-9 ? '0' : Math.abs(ys) >= 1 ? Math.round(v).toLocaleString() : v.toFixed(ys < 0.1 ? 2 : 1));
    // Room on the left for the widest tick label plus the axis title.
    const widest = Math.max(dec(yMin).length, dec(yMax).length);
    const m = { l: Math.round(fs * (2.4 + 0.6 * widest)), r: 18, t: 18, b: Math.round(fs * 3.3) }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    const X = x => m.l + x / maxD * iw, Y = y => m.t + (yMax - y) / (yMax - yMin) * ih;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Segoe UI, Arial, sans-serif" role="img" aria-label="${esc(pick.title)} for A and B">`;
    if (kind === 'path') {
      s += `<rect class="vital-band" x="${m.l}" y="${Y(half)}" width="${iw}" height="${Y(-half) - Y(half)}" fill="${colors.accent}" fill-opacity="0.13"/>`;
      s += `<text x="${m.l + 6}" y="${Y(half) - 5}" font-size="${fs - 2}" fill="${colors.accent}">${esc(len1(state.vitalIn))} vital zone</text>`;
    }
    for (let x = 0; x <= maxD + 1e-9; x += xst) s += `<line x1="${X(x)}" y1="${m.t}" x2="${X(x)}" y2="${m.t + ih}" stroke="${colors.grid}"/>`;
    for (let y = yMin; y <= yMax + 1e-9; y += ys) s += `<line x1="${m.l}" y1="${Y(y)}" x2="${m.l + iw}" y2="${Y(y)}" stroke="${colors.grid}"/>`;
    s += `<g fill="${colors.tick}" font-size="${fs}">`;
    for (let x = 0; x <= maxD + 1e-9; x += xst) s += `<text x="${X(x)}" y="${m.t + ih + fs * 1.45}" text-anchor="middle">${+x.toFixed(1)}</text>`;
    for (let y = yMin; y <= yMax + 1e-9; y += ys) s += `<text x="${m.l - 10}" y="${Y(y) + fs * 0.35}" text-anchor="end">${dec(y)}</text>`;
    s += `<text x="${m.l + iw / 2}" y="${h - 6}" text-anchor="middle" fill="${colors.title}" font-weight="600">Range (${u.d})</text>`;
    s += `<text transform="translate(${fs} ${m.t + ih / 2}) rotate(-90)" text-anchor="middle" fill="${colors.title}" font-weight="600">${esc(pick.title)}</text></g>`;
    refs.filter(r => r.y <= yMax && r.y >= yMin).forEach(r => {
      s += `<line class="ref-line" x1="${m.l}" y1="${Y(r.y)}" x2="${m.l + iw}" y2="${Y(r.y)}" stroke="${colors.tick}" stroke-width="1.25" stroke-dasharray="3 4"/>`;
      s += `<text x="${m.l + iw - 4}" y="${Y(r.y) - 5}" text-anchor="end" font-size="${fs - 2}" fill="${colors.tick}">${esc(r.label)} ${Math.round(r.y).toLocaleString()}</text>`;
    });
    if (kind === 'path') s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(maxD)}" y2="${Y(0)}" stroke="${colors.los}" stroke-width="2"/>`;
    const line = v => v.map((y, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(y).toFixed(1)).join('');
    s += `<path d="${line(ya)}" fill="none" stroke="${colors.path}" stroke-width="2.5" stroke-linejoin="round"/>`;
    s += `<path class="cmp-path" d="${line(yb)}" fill="none" stroke="${colors.compare}" stroke-width="2.5" stroke-dasharray="7 5" stroke-linejoin="round"/>`;
    if (interactive) s += `<line class="hover-line" x1="0" y1="${m.t}" x2="0" y2="${m.t + ih}" stroke="${colors.axis}" visibility="hidden"/><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    return { svg: s + '</svg>', xs, ya, yb, X, m, iw, n, unit: pick.unit };
  }
  function drawCmpChart(A, B, u) {
    const w = Math.max(280, cmpEl.chart.clientWidth), h = Math.max(220, cmpEl.chart.clientHeight);
    const c = cmpChartSvg(A, B, u, cmp.chart, w, h, screenColors(), true);
    cmpEl.chart.innerHTML = c.svg + '<div class="tooltip" hidden></div>';
    const svg = cmpEl.chart.querySelector('svg'), tip = cmpEl.chart.querySelector('.tooltip'), hover = svg.querySelector('.hover-line');
    const fmt = v => cmp.chart === 'path' ? signed(v, 1) : Math.round(v).toLocaleString();
    svg.querySelector('.hit').addEventListener('pointermove', e => {
      const box = svg.getBoundingClientRect(), px = (e.clientX - box.left) * (w / box.width);
      const i = Math.max(0, Math.min(c.n, Math.round((px - c.m.l) / c.iw * c.n)));
      hover.setAttribute('x1', c.X(c.xs[i])); hover.setAttribute('x2', c.X(c.xs[i])); hover.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.style.left = (c.X(c.xs[i]) / w * box.width) + 'px';
      tip.style.top = (e.clientY - box.top) + 'px';
      tip.innerHTML = `<b>${c.xs[i].toFixed(0)} ${u.d}</b><br><span class="t-a">A ${fmt(c.ya[i])} ${c.unit}</span><br><span class="t-cmp">B ${fmt(c.yb[i])} ${c.unit}</span>`;
    });
    svg.querySelector('.hit').addEventListener('pointerleave', () => { tip.hidden = true; hover.setAttribute('visibility', 'hidden'); });
  }

  // Wiring: every change updates the kept state and re-renders.
  sides.forEach(sd => {
    const st = () => cmp[sd.key];
    sd.from.addEventListener('change', () => {
      const v = sd.from.value;
      sd.from.value = '';
      const saved = v === '#setup' ? null : (readSaved() || []).find(x => x.name === v);
      const p = profileFromCode(v === '#setup' ? shareCode() : saved ? saved.code : '');
      if (!p) { toast('That setup couldn’t be read'); return; }
      sd.search.value = '';
      cmp[sd.key] = p;
      renderCompare();
      toast(`${sd.K} filled from ${v === '#setup' ? 'Setup' : '“' + v + '”'}`);
    });
    sd.mode.addEventListener('change', () => {
      sd.search.value = '';
      cmp[sd.key] = { mode: sd.mode.value, name: sd.key === 'b' ? CMP_B_START[sd.mode.value] : DEFAULTS[sd.mode.value].caliber, sightIn: DEFAULTS[sd.mode.value].sightIn };
      renderCompare();
    });
    sd.caliber.addEventListener('change', () => {
      const v = idx(sd.caliber), loads = sideLoads(st());
      Object.assign(st(), { name: v >= LOAD_BASE ? loads[v - LOAD_BASE].name : BTS.calibers(st().mode)[v], grains: null, custom: false });
      renderCompare();
    });
    sd.search.addEventListener('input', renderCompare);
    sd.search.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sd.search.value) { sd.search.value = ''; renderCompare(); e.stopPropagation(); }
      if (e.key === 'Enter') { e.preventDefault(); sd.caliber.focus(); }
    });
    sd.weight.addEventListener('change', () => { Object.assign(st(), { grains: sd.lists.weights[idx(sd.weight)].grains, custom: false }); renderCompare(); });
    sd.shape.addEventListener('change', () => { Object.assign(st(), { shape: sd.lists.shapes[idx(sd.shape)].label, custom: false }); renderCompare(); });
    sd.sight.addEventListener('change', () => { st().sightIn = sd.lists.sights[idx(sd.sight)].inches; renderCompare(); });
    sd.vel.addEventListener('input', () => {
      const v = parseFloat(sd.vel.value), fps = metric() ? v * FPS_PER_MPS : v;
      if (fps >= LOAD_LIMITS.fps[0] && fps <= LOAD_LIMITS.fps[1]) { Object.assign(st(), { vFps: fps, custom: true }); renderCompare(); }
    });
    sd.bc.addEventListener('input', () => {
      const v = parseFloat(sd.bc.value);
      if (v >= LOAD_LIMITS.bc[0] && v <= LOAD_LIMITS.bc[1]) { Object.assign(st(), { bc: v, custom: true }); renderCompare(); }
    });
    [sd.vel, sd.bc].forEach(i => i.addEventListener('blur', renderCompare));
    sd.typical.addEventListener('click', () => { st().custom = false; renderCompare(); });
  });
  cmpEl.zero.addEventListener('change', () => { cmp.zeroYd = fromDispDist(CMP_ZEROS[idx(cmpEl.zero)]); if (!cmp.split) cmp.zeroBYd = cmp.zeroYd; renderCompare(); });
  cmpEl.zeroB.addEventListener('change', () => { cmp.zeroBYd = fromDispDist(CMP_ZEROS[idx(cmpEl.zeroB)]); renderCompare(); });
  cmpEl.split.addEventListener('change', () => { cmp.split = cmpEl.split.checked; if (!cmp.split) cmp.zeroBYd = cmp.zeroYd; renderCompare(); });
  cmpEl.max.addEventListener('change', () => { cmp.maxYd = fromDispDist(CMP_MAX[idx(cmpEl.max)]); renderCompare(); });
  document.querySelectorAll('[data-cmp-chart]').forEach(b => b.addEventListener('click', () => { cmp.chart = b.dataset.cmpChart; renderCompare(); }));
  document.querySelectorAll('[data-cmp-table]').forEach(b => b.addEventListener('click', () => { cmp.table = b.dataset.cmpTable; renderCompare(); }));
  let cmpResize = 0;
  window.addEventListener('resize', () => { clearTimeout(cmpResize); cmpResize = setTimeout(() => { if (state.view === 'compare') renderCompare(); }, 150); });

  // ---------- Compare: link and printed sheet ----------
  // A comparison link is #compare= followed by base64url JSON. A side that uses one of my loads carries its numbers,
  // so it opens on a device that doesn't have that load (shown as "from link").
  const b64url = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  const r2 = v => Math.round(v * 100) / 100;
  function cmpEncode() {
    const side = st => {
      const o = { m: st.mode, n: st.name, g: st.grains, s: st.shape, h: r2(st.sightIn) };
      if (st.custom) { o.v = Math.round(st.vFps); o.b = st.bc; }
      const load = sideLoads(st).find(l => l.name === st.name);
      if (load) o.L = [load.grains, load.fps, load.bc];
      return o;
    };
    return b64url(JSON.stringify({ a: side(cmp.a), b: side(cmp.b), z: r2(cmp.zeroYd), zb: r2(cmp.zeroBYd), sp: cmp.split ? 1 : 0, x: r2(cmp.maxYd), c: cmp.chart, t: cmp.table }));
  }
  function cmpDecode(code) {
    let o;
    try { o = JSON.parse(unb64url(code)); } catch (e) { return null; }
    const side = s => {
      if (!s || !BTS.MODES.includes(s.m) || typeof s.n !== 'string') return null;
      const st = { mode: s.m, name: s.n, grains: +s.g || null, shape: typeof s.s === 'string' ? s.s : null, sightIn: +s.h || null, custom: false };
      if (s.v > 0 && s.b > 0) Object.assign(st, { vFps: +s.v, bc: +s.b, custom: true });
      if (Array.isArray(s.L) && !BTS.calibers(s.m).includes(s.n)) {
        const load = normLoad({ name: s.n, mode: s.m, grains: s.L[0], fps: s.L[1], bc: s.L[2] });
        if (!load) return null;
        if (!modeLoads(s.m).some(l => sameLoad(l, load))) st.adhoc = Object.assign(load, { adhoc: true });
      }
      return st;
    };
    const a = side(o && o.a), b = side(o && o.b), num = (v, lo, hi, d) => (v >= lo && v <= hi ? +v : d);
    if (!a || !b) return null;
    return { a, b, zeroYd: num(o.z, 1, 2000, 100), zeroBYd: num(o.zb, 1, 2000, num(o.z, 1, 2000, 100)), split: !!o.sp, maxYd: num(o.x, 10, 2000, 500),
      chart: ['path', 'velocity', 'energy'].includes(o.c) ? o.c : 'path', table: o.t === 'impact' ? 'impact' : 'trajectory' };
  }
  const compareUrl = () => setupUrl('compare=' + cmpEncode());
  // Opens a #compare= link: the comparison replaces this browser's, Compare shows, and the address goes back to plain.
  function openCompareLink(hash) {
    const c = cmpDecode(hash.slice('#compare='.length));
    history.replaceState(null, '', location.pathname + location.search);
    if (!c) { toast('That comparison link couldn’t be read'); return false; }
    cmp = c;
    cmpSave();
    toast('Opened a comparison from a link');
    return true;
  }
  $('cmp-copy').addEventListener('click', () => { if (cmp) copyLink(compareUrl()); });
  $('cmp-print').addEventListener('click', () => print('compare'));

  // The printed comparison: the side-by-side table and two charts on page 1, both by-range tables on page 2.
  function compareSheet(paper) {
    const { A, B } = cmpLast, u = trajectoryUnits();
    const light = { grid: '#d9dee5', axis: '#5f6b7a', tick: '#444', title: '#222', los: '#1f6fe5', path: '#b07d0b', laser: '#e0283d', accent: '#0f9d8a', bg: '#fff', compare: '#7b3fc4' };
    const pathChart = cmpChartSvg(A, B, u, 'path', 540, 300, light, false).svg, energyChart = cmpChartSvg(A, B, u, 'energy', 540, 300, light, false).svg;
    const saved = cmp.table;
    cmp.table = 'trajectory'; const traj = cmpTableHtml(A, B, u);
    cmp.table = 'impact'; const impact = cmpTableHtml(A, B, u);
    cmp.table = saved;
    const zeroTxt = cmp.split ? `A zeroed at ${Math.round(toDispDist(A.zeroYd))} ${u.d}, B at ${Math.round(toDispDist(B.zeroYd))} ${u.d}` : `both zeroed at ${Math.round(toDispDist(A.zeroYd))} ${u.d}`;
    const sub = `<span style="color:#b07d0b">A</span> ${esc(A.label)} vs <span style="color:#7b3fc4">B</span> ${esc(B.label)} · ${zeroTxt}`;
    const footer = `<footer>G1 point-mass model, standard atmosphere (59 °F, 29.53 inHg), level ground. Wind ${esc(windText(u))}. Printed ${esc(new Date().toLocaleString())}.</footer>`;
    return `<div class="sheet report cmp-sheet" style="width:${paper.w}in;height:${paper.h}in">
      <header><svg viewBox="0 0 32 32" width="34" height="34"><circle cx="16" cy="16" r="11" fill="none" stroke="#0f9d8a" stroke-width="2.5"/><path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="#0f9d8a" stroke-width="2.5"/><circle cx="16" cy="16" r="3" fill="#e0283d"/></svg>
      <div><h1>Load Comparison</h1><p>${sub}</p></div>
      <div class="report-qr"><span>Scan to open<br>this comparison</span><svg viewBox="0 0 1 1" width="0.8in" height="0.8in">${qrCode(0, 0, 1, compareUrl())}</svg></div></header>
      <table class="cmp-print-sum">${cmpSummaryHtml(A, B, u)}</table>
      <div class="report-cols cmp-print-charts"><div class="report-chart">${pathChart}</div><div class="report-chart">${energyChart}</div></div>
      <p class="report-legend"><span style="color:#b07d0b">━ A: ${esc(A.label)}</span><span style="color:#7b3fc4">╍ B: ${esc(B.label)}</span></p>
      ${footer}
    </div>
    <div class="sheet report cmp-sheet" style="width:${paper.w}in;height:${paper.h}in">
      <header><div><h1>Load Comparison · by range</h1><p>${sub}</p></div></header>
      <h2>Trajectory</h2>
      <table class="report-traj">${traj}</table>
      <h2>Impact</h2>
      <table class="report-traj">${impact}</table>
      <p class="report-note">Path is from the line of sight. Momentum and Taylor KO favor heavy, wide bullets; energy favors speed. Energy levels for game are rules of thumb, not a guarantee.</p>
      ${footer}
    </div>`;
  }

  // ---------- Start ----------
  const compareLink = /^#compare=/.test(location.hash) && openCompareLink(location.hash);
  if (compareLink) state.view = 'compare';
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
    if (/^#compare=/.test(location.hash)) { if (openCompareLink(location.hash)) setView('compare'); return; }
    if (!applyShareCode(location.hash)) showPreview(location.hash);
  });
  showPreview(startHash);
  if (startHash === '#chart') setChartMax(true);
  if (!startHash) plainCode = shareCode();
  urlReady = true;
  syncUrl();
  if (!document.body.classList.contains('previewing')) setView(state.view, false);

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

  window.BTS_APP = { state, render, print, shareCode };
})();
