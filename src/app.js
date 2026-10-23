/* Moblet Forge — app.js : the editor, trainer and player UI.
 * Copyright (c) 2026 Narisan Nakakes. MIT License.
 */
(function () {
  'use strict';
  const MF = window.MF;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const PRISTINE = $('#mf-root').outerHTML; // markup used when exporting a standalone game
  const STORE_KEY = 'moblet-forge/project/v1';
  const CREATOR_DEFAULT = 'นริสันต์ นาคะเกศ (Narisan Nakakes)';
  const ARROWS = ['↑', '→', '↓', '←'];
  const TOOL_ORDER = ['#', '.', 'S', 'B', 'e', 'x', 'k', 'G', 'w'];

  // ---------------------------------------------------------------- project
  const cloneLevel = (l) => ({ name: l.name || 'ด่าน', note: l.note || '', w: l.w, h: l.h, grid: l.grid.slice(), maxSteps: l.maxSteps || 0 });
  function newProject() {
    return {
      format: 'moblet-forge/1', title: 'เกมแรกของฉัน', creator: CREATOR_DEFAULT,
      level: cloneLevel(MF.SAMPLES[0]), rules: MF.defaultRules(), moblet: MF.defaultMoblet(),
      hyper: Object.assign({}, MF.DEFAULT_HYPER),
    };
  }
  function normalize(p) {
    if (!p || typeof p !== 'object') throw new Error('ไม่ใช่ไฟล์โปรเจกต์');
    const base = newProject();
    const lv = p.level;
    if (!lv || !Array.isArray(lv.grid) || !(lv.w >= 3) || !(lv.h >= 3)) throw new Error('ข้อมูลด่านไม่ครบ');
    const w = Math.min(16, lv.w | 0), h = Math.min(12, lv.h | 0);
    const out = {
      format: 'moblet-forge/1',
      title: String(p.title || base.title).slice(0, 60),
      creator: String(p.creator || base.creator).slice(0, 80),
      level: MF.resizeLevel(cloneLevel({ ...lv, grid: lv.grid.map(String) }), w, h),
      rules: Array.isArray(p.rules) ? p.rules.filter((r) => r && MF.EVENTS[r.when]).map((r, i) => ({
        id: String(r.id || 'r' + i), on: r.on !== false, when: r.when, cond: MF.CONDITIONS[r.cond] ? r.cond : 'always',
        reward: Number(r.reward) || 0, end: !!r.end, win: !!r.win,
      })) : base.rules,
      moblet: Object.assign(base.moblet, p.moblet || {}),
      hyper: Object.assign(base.hyper, p.hyper || {}),
      brain: p.brain || null,
    };
    return out;
  }
  function load() {
    try { const t = localStorage.getItem(STORE_KEY); return t ? normalize(JSON.parse(t)) : null; } catch (e) { return null; }
  }
  let saveTimer = 0;
  function save() {
    if (EMBED) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { const { brain, ...rest } = project; localStorage.setItem(STORE_KEY, JSON.stringify(rest)); } catch (e) { /* storage unavailable */ }
    }, 400);
  }

  const EMBED = window.MF_EMBED || null;
  let project;
  try { project = EMBED ? normalize(EMBED) : load() || newProject(); } catch (e) { project = newProject(); }
  if (EMBED) document.documentElement.classList.add('embed'), document.body.classList.add('embed');

  // ---------------------------------------------------------------- state
  const S = {
    tab: EMBED ? 'play' : 'build', tool: '#', overlay: 'value',
    world: null, brain: null, training: false, trainTarget: 0, trainDone: 0,
    mode: 'idle', // idle | watch | play
    actors: [], focus: null, watch: null, play: null,
    painting: false, visitCache: null, visitAt: 0,
  };

  function rebuild(opts) {
    opts = opts || {};
    S.world = new MF.World(project.level, project.rules);
    const n = S.world.numStates;
    if (!S.brain) S.brain = new MF.Brain(n, project.hyper);
    else {
      Object.assign(S.brain.hyper, project.hyper);
      if (S.brain.nS !== n || opts.resetBrain) {
        if (S.brain.episodes > 0 && !opts.quiet) toast('ขนาดสมองเปลี่ยนตามด่าน เริ่มฝึกใหม่ได้เลย');
        S.brain.resize(n);
      }
    }
    S.visitCache = null;
    if (S.mode !== 'play') setIdle();
    renderHUD();
    renderTrainStats();
  }

  function makeActor(world, spec, alpha, phase) {
    const x = world.pos % world.w, y = (world.pos / world.w) | 0;
    return { world, spec, alpha, phase: phase || 0, x, y, px: x, py: y, facing: 2, squash: 0 };
  }
  function syncActor(a) {
    const w = a.world;
    const nx = w.pos % w.w, ny = (w.pos / w.w) | 0;
    if (nx > a.x) a.facing = 1; else if (nx < a.x) a.facing = 3; else if (ny > a.y) a.facing = 2; else if (ny < a.y) a.facing = 0;
    if (nx !== a.x || ny !== a.y) a.squash = 1;
    a.x = nx; a.y = ny;
  }
  function setIdle() {
    stopWatch();
    S.mode = 'idle';
    const w = S.world.clone();
    S.focus = w;
    S.actors = [makeActor(w, project.moblet, 1)];
    setChip(S.tab === 'build' ? 'โหมดสร้างด่าน' : 'พร้อม', '');
  }

  // ---------------------------------------------------------------- canvas & palette
  const board = $('#board'), bctx = board.getContext('2d');
  let P = {};
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    P = {
      floorA: v('--floor-a'), floorB: v('--floor-b'), wall: v('--wall'), wallHi: v('--wall-hi'), beacon: v('--beacon'),
      ember: v('--ember'), emberDark: v('--ember-dark'), thorn: v('--thorn'), key: v('--key'), gateBg: v('--gate-bg'),
      wind: v('--wind'), accent: v('--accent'), ink: v('--ink'), muted: v('--muted'), bg: v('--bg'), line: v('--line'), good: v('--good'),
    };
  }
  readPalette();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(readPalette, 30)); } catch (e) { /* old browser */ }
  new MutationObserver(() => setTimeout(readPalette, 30)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  let cell = 40, dpr = 1;
  function sizeBoard() {
    const wrap = $('#boardWrap');
    const avail = Math.max(200, wrap.clientWidth - 20);
    const maxH = Math.max(260, Math.min(620, window.innerHeight * 0.66));
    const lv = project.level;
    cell = Math.max(18, Math.floor(Math.min(avail / lv.w, maxH / lv.h, 64)));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    board.width = lv.w * cell * dpr;
    board.height = lv.h * cell * dpr;
    board.style.width = lv.w * cell + 'px';
    board.style.height = lv.h * cell + 'px';
  }
  window.addEventListener('resize', sizeBoard);

  function bestAction(s) {
    const Q = S.brain.Q, b = s * 4;
    let a = 0;
    for (let i = 1; i < 4; i++) if (Q[b + i] > Q[b + a]) a = i;
    return a;
  }
  function visitsPerCell() {
    const now = performance.now();
    if (S.visitCache && now - S.visitAt < 500) return S.visitCache;
    const w = S.world, per = new Float32Array(w.w * w.h), block = 2 << w.embers;
    const V = S.brain.visits;
    for (let s = 0; s < V.length; s++) per[(s / block) | 0] += V[s];
    let mx = 0;
    for (const v of per) mx = Math.max(mx, v);
    S.visitCache = { per, mx };
    S.visitAt = now;
    return S.visitCache;
  }

  function drawBoard(t) {
    const w = S.focus || S.world, lv = project.level;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const i = y * lv.w + x;
      MF.drawTile(bctx, w.tileAt(i), x * cell, y * cell, cell, t, P, (x * 7 + y * 13) ^ (x + y));
    }
    // AI overlay
    const trained = S.brain && S.brain.episodes > 0;
    if (trained && S.overlay !== 'none') {
      const key = w.hasKey, mask = w.mask;
      if (S.overlay === 'visits') {
        const { per, mx } = visitsPerCell();
        for (let i = 0; i < per.length; i++) {
          if (w.grid[i] === '#' || !per[i]) continue;
          const a = Math.pow(per[i] / mx, 0.45) * 0.55;
          bctx.fillStyle = hexA(P.ember, a);
          bctx.fillRect((i % lv.w) * cell, ((i / lv.w) | 0) * cell, cell, cell);
        }
      } else {
        let lo = Infinity, hi = -Infinity;
        const vals = new Float32Array(lv.w * lv.h);
        for (let i = 0; i < vals.length; i++) {
          if (w.grid[i] === '#') continue;
          const v = S.brain.value(w.stateOf(i, key, mask));
          vals[i] = v;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const span = Math.max(1e-6, Math.max(Math.abs(lo), Math.abs(hi)));
        bctx.lineWidth = Math.max(1.2, cell * 0.06);
        bctx.lineCap = 'round';
        for (let i = 0; i < vals.length; i++) {
          if (w.grid[i] === '#') continue;
          const px = (i % lv.w) * cell, py = ((i / lv.w) | 0) * cell;
          if (S.overlay === 'value') {
            const v = vals[i] / span;
            bctx.fillStyle = hexA(v >= 0 ? P.accent : P.thorn, Math.min(0.62, Math.abs(v) * 0.62));
            bctx.fillRect(px, py, cell, cell);
          } else {
            const a = bestAction(w.stateOf(i, key, mask));
            const [dx, dy] = MF.DIRS[a];
            const cx = px + cell / 2, cy = py + cell / 2, L = cell * 0.26;
            bctx.strokeStyle = hexA(P.accent, 0.85);
            bctx.beginPath();
            bctx.moveTo(cx - dx * L, cy - dy * L);
            bctx.lineTo(cx + dx * L, cy + dy * L);
            bctx.moveTo(cx + dx * L, cy + dy * L);
            bctx.lineTo(cx + dx * L * 0.35 - dy * L * 0.55, cy + dy * L * 0.35 + dx * L * 0.55);
            bctx.moveTo(cx + dx * L, cy + dy * L);
            bctx.lineTo(cx + dx * L * 0.35 + dy * L * 0.55, cy + dy * L * 0.35 - dx * L * 0.55);
            bctx.stroke();
          }
        }
      }
    }
    // faint grid
    bctx.strokeStyle = hexA(P.ink, 0.06);
    bctx.lineWidth = 1;
    bctx.beginPath();
    for (let x = 1; x < lv.w; x++) { bctx.moveTo(x * cell + 0.5, 0); bctx.lineTo(x * cell + 0.5, lv.h * cell); }
    for (let y = 1; y < lv.h; y++) { bctx.moveTo(0, y * cell + 0.5); bctx.lineTo(lv.w * cell, y * cell + 0.5); }
    bctx.stroke();
    // trail during watch
    if (S.mode === 'watch' && S.watch) {
      const pts = S.watch.path.slice(0, S.watch.idx + 1);
      bctx.strokeStyle = hexA(P.accent, 0.45);
      bctx.lineWidth = Math.max(2, cell * 0.08);
      bctx.setLineDash([cell * 0.12, cell * 0.12]);
      bctx.beginPath();
      pts.forEach((p, k) => {
        const x = (p.pos % lv.w + 0.5) * cell, y = (((p.pos / lv.w) | 0) + 0.5) * cell;
        k ? bctx.lineTo(x, y) : bctx.moveTo(x, y);
      });
      bctx.stroke();
      bctx.setLineDash([]);
    }
    // actors
    for (const a of S.actors) {
      a.px += (a.x - a.px) * 0.28;
      a.py += (a.y - a.py) * 0.28;
      a.squash *= 0.82;
      MF.drawMoblet(bctx, (a.px + 0.5) * cell, (a.py + 0.5) * cell, cell, a.spec, t, a);
    }
  }
  function hexA(color, a) {
    const c = color.trim();
    if (c[0] === '#' && (c.length === 7 || c.length === 4)) {
      const f = c.length === 4 ? c.slice(1).split('').map((ch) => ch + ch).join('') : c.slice(1);
      const n = parseInt(f, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    return c;
  }

  // ---------------------------------------------------------------- render loop
  const logo = $('#logo'), lctx = logo.getContext('2d');
  const prev = $('#mobletPreview'), pctx = prev.getContext('2d');
  const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  let last = 0;
  function frame(ms) {
    const t = reduceMotion ? 0 : ms / 1000;
    if (S.mode === 'watch') advanceWatch(ms);
    drawBoard(t);
    lctx.clearRect(0, 0, 104, 104);
    MF.drawMoblet(lctx, 52, 50, 110, project.moblet, t, { facing: 2 });
    if (S.tab === 'moblet') {
      pctx.clearRect(0, 0, 300, 300);
      MF.drawMoblet(pctx, 150, 140, 330, project.moblet, t, { facing: ((t / 2) | 0) % 4 === 0 ? 1 : 2 });
    }
    if (ms - last > 250) { last = ms; renderHUD(); }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- HUD + chips
  function setChip(text, cls) {
    const c = $('#stageChip');
    c.textContent = text;
    c.className = 'chip' + (cls ? ' ' + cls : '');
  }
  function renderHUD() {
    const w = S.focus || S.world;
    if (!w) return;
    const parts = [];
    parts.push(`ก้าว <b>${w.steps}</b>/${w.maxSteps}`);
    parts.push(`คะแนน <b>${(w.ret >= 0 ? '+' : '') + w.ret.toFixed(2)}</b>`);
    if (w.embers) parts.push(`ถ่านไฟ <b>${popcount(w.mask)}/${w.embers}</b>`);
    if (w.grid.includes('k')) parts.push(w.hasKey ? '<b>มีกุญแจ</b>' : 'ยังไม่มีกุญแจ');
    if (S.mode === 'play' && S.play && S.play.ghost) parts.push(`AI: ก้าว <b>${S.play.ghost.steps}</b> คะแนน <b>${S.play.ghost.ret.toFixed(2)}</b>`);
    $('#hud').innerHTML = parts.join('<span aria-hidden="true">·</span>');
  }
  const popcount = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- tabs
  function setTab(tab) {
    S.tab = tab;
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('.pane').forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (tab === 'play') startPlay();
    else if (S.mode === 'play') setIdle();
    else if (S.mode === 'idle') setChip(tab === 'build' ? 'โหมดสร้างด่าน' : 'พร้อม', '');
    if (tab === 'train') drawChart();
    board.style.cursor = tab === 'build' && !EMBED ? 'crosshair' : 'default';
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  $$('#overlaySeg button').forEach((b) => b.addEventListener('click', () => {
    S.overlay = b.dataset.ov;
    $$('#overlaySeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#legend').hidden = S.overlay !== 'value';
  }));

  // ---------------------------------------------------------------- build tab
  function buildPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    for (const c of TOOL_ORDER) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.type = 'button';
      b.dataset.tool = c;
      b.setAttribute('aria-pressed', String(c === S.tool));
      const cv = document.createElement('canvas');
      cv.width = cv.height = 68;
      b.appendChild(cv);
      b.appendChild(document.createTextNode(MF.TILES[c].th));
      b.addEventListener('click', () => {
        S.tool = c;
        $$('#palette .tool').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      pal.appendChild(b);
    }
    paintPaletteIcons();
  }
  function paintPaletteIcons() {
    $$('#palette .tool').forEach((b) => {
      const cv = b.querySelector('canvas'), cx = cv.getContext('2d');
      cx.clearRect(0, 0, 68, 68);
      MF.drawTile(cx, b.dataset.tool, 0, 0, 68, 0.6, P, 1);
      if (b.dataset.tool === 'S') MF.drawMoblet(cx, 34, 34, 60, project.moblet, 0, { facing: 2 });
    });
  }

  function cellFromEvent(e) {
    const r = board.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * project.level.w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * project.level.h);
    if (x < 0 || y < 0 || x >= project.level.w || y >= project.level.h) return null;
    return { x, y };
  }
  function paintAt(e) {
    const p = cellFromEvent(e);
    if (!p) return;
    const erase = e.buttons === 2 || e.button === 2;
    const c = erase ? '.' : S.tool;
    const lv = project.level;
    if (c === 'e' && lv.grid[p.y][p.x] !== 'e') {
      const count = lv.grid.join('').split('e').length - 1;
      if (count >= MF.MAX_EMBERS) { toast(`ใส่ถ่านไฟได้สูงสุด ${MF.MAX_EMBERS} ก้อนต่อด่าน`); return; }
    }
    if (MF.setTile(lv, p.x, p.y, c)) { rebuild(); save(); }
  }
  board.addEventListener('contextmenu', (e) => { if (S.tab === 'build') e.preventDefault(); });
  board.addEventListener('pointerdown', (e) => {
    if (S.tab !== 'build' || EMBED) return;
    S.painting = true;
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    paintAt(e);
  });
  board.addEventListener('pointermove', (e) => { if (S.painting) paintAt(e); });
  const endPaint = () => (S.painting = false);
  board.addEventListener('pointerup', endPaint);
  board.addEventListener('pointercancel', endPaint);

  function fillBuildFields() {
    const lv = project.level;
    $('#levelName').value = lv.name;
    $('#lvW').value = lv.w;
    $('#lvH').value = lv.h;
    $('#lvMax').value = lv.maxSteps || lv.w * lv.h * 2;
    const sample = MF.SAMPLES.find((s) => s.name === lv.name);
    $('#sampleNote').textContent = (sample && sample.note) || lv.note || 'ด่านของคุณเอง: อย่าลืมวางจุดเกิดและตะเกียงเส้นชัย';
  }
  $('#levelName').addEventListener('input', (e) => { project.level.name = e.target.value.slice(0, 40); save(); });
  $('#applySize').addEventListener('click', () => {
    const w = clamp(+$('#lvW').value, 5, 16), h = clamp(+$('#lvH').value, 5, 12);
    const m = clamp(+$('#lvMax').value || w * h * 2, 10, 999);
    project.level = MF.resizeLevel(project.level, w, h);
    project.level.maxSteps = m;
    sizeBoard(); rebuild(); fillBuildFields(); save();
  });
  $('#newLevel').addEventListener('click', () => {
    project.level = MF.blankLevel(clamp(+$('#lvW').value, 5, 16), clamp(+$('#lvH').value, 5, 12));
    sizeBoard(); rebuild({ resetBrain: true, quiet: true }); fillBuildFields(); save();
    toast('สร้างด่านว่างแล้ว');
  });
  const sampleSel = $('#sampleSel');
  MF.SAMPLES.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; sampleSel.appendChild(o); });
  $('#loadSample').addEventListener('click', () => {
    project.level = cloneLevel(MF.SAMPLES[+sampleSel.value]);
    sizeBoard(); rebuild({ resetBrain: true, quiet: true }); fillBuildFields(); save();
    toast('โหลด "' + project.level.name + '" แล้ว');
  });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(v) || a));

  // ---------------------------------------------------------------- rules tab
  function opts(obj, sel) {
    return Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');
  }
  function renderRules() {
    const box = $('#rules');
    box.innerHTML = '';
    project.rules.forEach((r, idx) => {
      const el = document.createElement('div');
      el.className = 'rule' + (r.on ? '' : ' off');
      el.innerHTML =
        `<input type="checkbox" aria-label="เปิดใช้กฎ" data-k="on"${r.on ? ' checked' : ''}>` +
        `<div class="body"><select data-k="when" aria-label="เมื่อ">${opts(MF.EVENTS, r.when)}</select>` +
        `<select data-k="cond" aria-label="เงื่อนไข">${opts(MF.CONDITIONS, r.cond)}</select></div>` +
        `<button class="del" type="button" aria-label="ลบกฎ">×</button>` +
        `<span class="kw">ให้</span>` +
        `<div class="then">คะแนน <input type="number" step="0.05" data-k="reward" value="${r.reward}" aria-label="คะแนน">` +
        `<label><input type="checkbox" data-k="end"${r.end ? ' checked' : ''}> จบรอบ</label>` +
        `<label><input type="checkbox" data-k="win"${r.win ? ' checked' : ''}> นับว่าชนะ</label></div>`;
      el.querySelectorAll('[data-k]').forEach((inp) => {
        inp.id = `rule-${r.id}-${inp.dataset.k}`;
        inp.addEventListener('change', () => {
          const k = inp.dataset.k;
          r[k] = inp.type === 'checkbox' ? inp.checked : k === 'reward' ? Number(inp.value) || 0 : inp.value;
          if (k === 'on') el.classList.toggle('off', !r.on);
          rebuild(); save();
        });
      });
      el.querySelector('.del').addEventListener('click', () => { project.rules.splice(idx, 1); renderRules(); rebuild(); save(); });
      box.appendChild(el);
    });
  }
  $('#addRule').addEventListener('click', () => {
    project.rules.push({ id: 'r' + Date.now().toString(36), on: true, when: 'touch_ember', cond: 'always', reward: 0.2, end: false, win: false });
    renderRules(); rebuild(); save();
  });
  $('#resetRules').addEventListener('click', () => { project.rules = MF.defaultRules(); renderRules(); rebuild(); save(); toast('คืนค่ากฎเริ่มต้นแล้ว'); });

  // ---------------------------------------------------------------- moblet tab
  function fillMoblet() {
    const m = project.moblet;
    $('#mbName').value = m.name;
    $('#mbBody').innerHTML = opts(MF.BODY, m.body);
    $('#mbEyes').innerHTML = opts(MF.EYES, m.eyes);
    $('#mbCrest').innerHTML = opts(MF.CREST, m.crest);
    $('#mbPattern').innerHTML = opts(MF.PATTERN, m.pattern);
    $('#mbHue').value = m.hue;
  }
  const mbMap = { mbName: 'name', mbBody: 'body', mbEyes: 'eyes', mbCrest: 'crest', mbPattern: 'pattern', mbHue: 'hue' };
  Object.entries(mbMap).forEach(([id, k]) => $('#' + id).addEventListener('input', (e) => {
    project.moblet[k] = k === 'hue' ? +e.target.value : e.target.value;
    paintPaletteIcons(); save();
  }));
  $('#mbRandom').addEventListener('click', () => {
    Object.assign(project.moblet, MF.randomMoblet());
    fillMoblet(); paintPaletteIcons(); save();
  });

  // ---------------------------------------------------------------- train tab
  const hpMap = { hpAlgo: 'algo', hpAlpha: 'alpha', hpGamma: 'gamma', hpDecay: 'epsDecay', hpEpsMin: 'epsMin' };
  function fillHyper() {
    Object.entries(hpMap).forEach(([id, k]) => ($('#' + id).value = project.hyper[k]));
  }
  Object.entries(hpMap).forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => {
    project.hyper[k] = k === 'algo' ? e.target.value : Number(e.target.value);
    Object.assign(S.brain.hyper, project.hyper);
    save();
  }));

  function startTraining() {
    if (S.training) { S.training = false; renderTrainStats(); return; }
    if (!S.world.grid.includes('B')) toast('ด่านนี้ยังไม่มีตะเกียงเส้นชัย AI จะไม่มีทางชนะ');
    if (S.mode === 'watch') setIdle();
    S.training = true;
    S.trainTarget = +$('#hpBatch').value || 1000;
    S.trainDone = 0;
    setChip('AI กำลังฝึก', 'live');
    trainTick();
  }
  function trainTick() {
    if (!S.training) return;
    const end = performance.now() + 14;
    while (performance.now() < end && S.trainDone < S.trainTarget) {
      S.brain.runEpisode(S.world);
      S.trainDone++;
    }
    renderTrainStats();
    drawChart();
    if (S.trainDone >= S.trainTarget) {
      S.training = false;
      renderTrainStats();
      const wr = Math.round(S.brain.winRate(100) * 100);
      const greedyWin = S.brain.rollout(S.world.clone()).won;
      setChip(greedyWin ? 'AI ผ่านด่านได้แล้ว' : 'ยังไม่ผ่าน ลองฝึกต่อ', greedyWin ? 'win' : '');
      toast(greedyWin ? `ฝึกเสร็จ ${S.brain.episodes} รอบ กด "ดู AI เล่น" ได้เลย` : `ฝึกแล้ว ${S.brain.episodes} รอบ ชนะ ${wr}% ลองฝึกเพิ่มหรือปรับกฎ`);
      return;
    }
    setTimeout(trainTick, 0);
  }
  function renderTrainStats() {
    if (!S.brain) return;
    $('#stEp').textContent = S.brain.episodes.toLocaleString('th-TH');
    $('#stEps').textContent = S.brain.eps.toFixed(2);
    $('#stWin').textContent = Math.round(S.brain.winRate(100) * 100) + '%';
    $('#stStates').textContent = S.brain.nS.toLocaleString('th-TH');
    $('#trainBar').style.width = S.training ? (S.trainDone / S.trainTarget) * 100 + '%' : '0';
    $('#trainBtn').textContent = S.training ? 'หยุด' : 'เริ่มฝึก';
  }
  $('#trainBtn').addEventListener('click', startTraining);
  $('#resetBrain').addEventListener('click', () => {
    S.training = false;
    S.brain.resize(S.world.numStates);
    renderTrainStats(); drawChart(); setIdle();
    toast('ล้างสมองแล้ว โมบเล็ตลืมทุกอย่าง');
  });

  const chart = $('#chart'), cctx = chart.getContext('2d');
  function drawChart() {
    if (S.tab !== 'train') return;
    const W = chart.clientWidth || 360, H = chart.clientHeight || 150;
    chart.width = W * dpr; chart.height = H * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, W, H);
    const hs = S.brain.history;
    const padL = 36, padR = 34, padT = 12, padB = 20;
    const iw = W - padL - padR, ih = H - padT - padB;
    cctx.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--f-mono');
    cctx.fillStyle = P.muted;
    if (hs.length < 2) {
      cctx.textAlign = 'center';
      cctx.fillText('ยังไม่ได้ฝึก กด "เริ่มฝึก" เพื่อดูกราฟ', W / 2, H / 2);
      return;
    }
    const n = Math.min(hs.length, Math.max(2, Math.floor(iw)));
    const win = Math.max(10, Math.round(hs.length / 40));
    const ret = [], wr = [];
    for (let k = 0; k < n; k++) {
      const end = Math.round(((k + 1) / n) * hs.length);
      const start = Math.max(0, end - win);
      let sr = 0, sw = 0;
      for (let i = start; i < end; i++) { sr += hs[i].ret; sw += hs[i].won ? 1 : 0; }
      ret.push(sr / (end - start)); wr.push(sw / (end - start));
    }
    let lo = Math.min(0, ...ret), hi = Math.max(0.1, ...ret);
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const yR = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
    const yW = (v) => padT + ih - v * ih;
    const x = (k) => padL + (k / (n - 1)) * iw;
    // grid + axes
    cctx.strokeStyle = hexA(P.ink, 0.08);
    cctx.lineWidth = 1;
    cctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4, y = yR(v);
      cctx.beginPath(); cctx.moveTo(padL, y + 0.5); cctx.lineTo(W - padR, y + 0.5); cctx.stroke();
      cctx.fillStyle = P.muted; cctx.fillText(v.toFixed(1), padL - 5, y + 3);
    }
    cctx.textAlign = 'left';
    for (const v of [0, 0.5, 1]) { cctx.fillStyle = P.ember; cctx.fillText(Math.round(v * 100) + '%', W - padR + 5, yW(v) + 3); }
    cctx.strokeStyle = hexA(P.ink, 0.25);
    cctx.beginPath(); cctx.moveTo(padL, yR(0) + 0.5); cctx.lineTo(W - padR, yR(0) + 0.5); cctx.stroke();
    cctx.textAlign = 'center'; cctx.fillStyle = P.muted;
    cctx.fillText('รอบที่ ' + hs.length.toLocaleString('th-TH'), W - padR - 30, H - 5);
    // area under return
    cctx.beginPath();
    ret.forEach((v, k) => (k ? cctx.lineTo(x(k), yR(v)) : cctx.moveTo(x(k), yR(v))));
    cctx.lineTo(x(n - 1), yR(0)); cctx.lineTo(x(0), yR(0)); cctx.closePath();
    cctx.fillStyle = hexA(P.accent, 0.12); cctx.fill();
    const line = (arr, y, col, wd) => {
      cctx.beginPath();
      arr.forEach((v, k) => (k ? cctx.lineTo(x(k), y(v)) : cctx.moveTo(x(k), y(v))));
      cctx.strokeStyle = col; cctx.lineWidth = wd; cctx.stroke();
      cctx.fillStyle = col; cctx.beginPath(); cctx.arc(x(n - 1), y(arr[n - 1]), 3, 0, Math.PI * 2); cctx.fill();
    };
    line(wr, yW, P.ember, 1.5);
    line(ret, yR, P.accent, 2);
  }
  window.addEventListener('resize', drawChart);

  // ---------------------------------------------------------------- watch AI
  function startWatch() {
    if (S.training) S.training = false;
    if (S.brain.episodes === 0) { toast('ยังไม่ได้ฝึกเลย กด "เริ่มฝึก" ก่อน'); return; }
    if (S.mode === 'play') S.play = null;
    const roll = S.brain.rollout(S.world.clone());
    const w = S.world.clone();
    S.mode = 'watch';
    S.focus = w;
    S.actors = [makeActor(w, project.moblet, 1)];
    S.watch = { path: roll.path, idx: 0, won: roll.won, next: performance.now() + 300 };
    setChip('AI กำลังเล่น', 'live');
    renderTrainStats();
  }
  function advanceWatch(ms) {
    const W = S.watch;
    if (!W || ms < W.next) return;
    if (W.idx >= W.path.length - 1) {
      if (!W.ended) {
        W.ended = true;
        setChip(W.won ? 'AI ผ่านด่าน!' : 'AI ยังไม่ผ่าน', W.won ? 'win' : 'lose');
      }
      return;
    }
    W.idx++;
    const p = W.path[W.idx], w = S.focus;
    w.pos = p.pos; w.hasKey = p.hasKey; w.mask = p.mask; w.steps = W.idx;
    const prevRet = w.ret;
    w.ret = prevRet; // recompute return from events below for the HUD
    let r = 0;
    for (const rule of project.rules) if (rule.on && p.events.includes(rule.when) && w.condOk(rule.cond)) r += +rule.reward || 0;
    w.ret += r;
    syncActor(S.actors[0]);
    W.next = ms + (p.events.includes('blown') ? 240 : 170);
  }
  function stopWatch() { S.watch = null; }
  $('#watchBtn').addEventListener('click', () => { if (S.tab !== 'train') setTab('train'); startWatch(); });

  // ---------------------------------------------------------------- play
  function startPlay() {
    stopWatch();
    const human = S.world.clone();
    const race = $('#raceAI').checked && S.brain.episodes > 0;
    const ghost = race ? S.world.clone() : null;
    S.mode = 'play';
    S.play = { human, ghost, over: false };
    S.focus = human;
    S.actors = [];
    if (ghost) S.actors.push(makeActor(ghost, project.moblet, 0.38, 1.7));
    S.actors.push(makeActor(human, project.moblet, 1));
    $('#playResult').textContent = '';
    $('#playResult').className = 'result';
    setChip('คุณกำลังเล่น', 'live');
    if ($('#raceAI').checked && !race) $('#playResult').textContent = 'AI ยังไม่ได้ฝึก ตอนนี้เล่นคนเดียวไปก่อน';
    renderHUD();
  }
  function playMove(a) {
    const P2 = S.play;
    if (!P2 || P2.over) return;
    P2.human.step(a);
    syncActor(S.actors[S.actors.length - 1]);
    if (P2.ghost && !P2.ghost.done) { P2.ghost.step(S.brain.greedy(P2.ghost.state())); syncActor(S.actors[0]); }
    if (P2.human.done) {
      P2.over = true;
      const h = P2.human, g = P2.ghost;
      let msg = h.won ? `ผ่านด่าน! ${h.steps} ก้าว คะแนน ${h.ret.toFixed(2)}` : `ไม่ผ่าน คะแนน ${h.ret.toFixed(2)}`;
      if (g) {
        while (!g.done) g.step(S.brain.greedy(g.state()));
        if (h.won && (!g.won || h.ret > g.ret + 1e-6)) msg += ' · ชนะ AI';
        else if (g.won && (!h.won || g.ret > h.ret + 1e-6)) msg += ` · AI ทำได้ ${g.ret.toFixed(2)}`;
        else msg += ' · เสมอกับ AI';
      }
      $('#playResult').textContent = msg;
      $('#playResult').className = 'result ' + (h.won ? 'win' : 'lose');
      setChip(h.won ? 'ผ่านด่าน' : 'จบรอบ', h.won ? 'win' : 'lose');
    }
    renderHUD();
  }
  $('#playBtn').addEventListener('click', startPlay);
  $('#raceAI').addEventListener('change', startPlay);
  $$('#dpad button').forEach((b) => b.addEventListener('click', () => playMove(+b.dataset.a)));
  const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  window.addEventListener('keydown', (e) => {
    if (S.mode !== 'play' || !(e.code in KEYS)) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    playMove(KEYS[e.code]);
  });

  // ---------------------------------------------------------------- share
  function fillShare() {
    $('#projTitle').value = project.title;
    $('#projCreator').value = project.creator;
    $('#creatorLabel').textContent = project.creator.replace(/\s*\(.*\)\s*$/, '') || 'ไม่ระบุ';
    $('#projTitleLabel').textContent = project.title;
  }
  $('#projTitle').addEventListener('input', (e) => { project.title = e.target.value; fillShare(); save(); });
  $('#projCreator').addEventListener('input', (e) => { project.creator = e.target.value; $('#creatorLabel').textContent = e.target.value; save(); });

  function projectForExport(withBrain) {
    const { brain, ...rest } = project;
    const out = JSON.parse(JSON.stringify(rest));
    out.createdWith = 'Moblet Forge by Narisan Nakakes';
    if (withBrain && S.brain.episodes > 0) out.brain = { nS: S.brain.nS, episodes: S.brain.episodes, q: S.brain.exportQ() };
    return out;
  }
  function download(name, text, type) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('เตรียมไฟล์ ' + name + ' แล้ว');
    } catch (e) { toast('เบราว์เซอร์นี้ดาวน์โหลดไม่ได้ ใช้ "คัดลอก JSON" แทน'); }
  }
  const slug = (s) => (s || 'moblet-game').toLowerCase().replace(/[^a-z0-9฀-๿]+/g, '-').replace(/^-|-$/g, '') || 'moblet-game';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function buildStandalone() {
    const proj = projectForExport($('#incBrain').checked);
    const json = JSON.stringify(proj).replace(/</g, '\\u003c');
    const fonts = $('link[data-mf-fonts]');
    const scripts = $$('script[data-mf]').map((s) => `<script data-mf="${s.dataset.mf}">${s.textContent}<\/script>`).join('\n');
    return '<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      `<title>${esc(project.title)} · Moblet Forge</title>\n<meta name="author" content="${esc(project.creator)}">\n` +
      (fonts ? fonts.outerHTML + '\n' : '') +
      `<style id="mf-style">${$('#mf-style').textContent}</style>\n</head>\n<body>\n${PRISTINE}\n` +
      `<script>window.MF_EMBED=${json};<\/script>\n${scripts}\n</body>\n</html>\n`;
  }
  $('#exportGame').addEventListener('click', () => download(slug(project.title) + '.html', buildStandalone(), 'text/html'));
  $('#exportJson').addEventListener('click', () => download(slug(project.title) + '.moblet.json', JSON.stringify(projectForExport($('#incBrain').checked), null, 2), 'application/json'));
  $('#copyJson').addEventListener('click', async () => {
    const text = JSON.stringify(projectForExport($('#incBrain').checked));
    try { await navigator.clipboard.writeText(text); toast('คัดลอก JSON แล้ว'); }
    catch (e) { const ta = $('#importText'); ta.value = text; ta.focus(); ta.select(); toast('เลือกข้อความไว้ให้แล้ว กดคัดลอกเองได้เลย'); }
  });
  function importProject(text) {
    try {
      const p = normalize(JSON.parse(text));
      project = p;
      S.brain = null;
      sizeBoard(); rebuild({ quiet: true });
      if (p.brain && p.brain.q && S.brain.importQ(p.brain.q, S.world.numStates)) S.brain.episodes = p.brain.episodes || 1;
      delete project.brain;
      fillAll(); save();
      toast('นำเข้า "' + project.title + '" แล้ว');
    } catch (e) { toast('นำเข้าไม่สำเร็จ: ' + e.message); }
  }
  $('#importBtn').addEventListener('click', () => importProject($('#importText').value));
  $('#importFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => importProject(String(rd.result));
    rd.readAsText(f);
  });

  // ---------------------------------------------------------------- boot
  function fillAll() {
    fillBuildFields(); renderRules(); fillMoblet(); fillHyper(); fillShare(); buildPalette(); renderTrainStats();
  }
  sizeBoard();
  rebuild({ quiet: true });
  if (project.brain && project.brain.q && S.brain.importQ(project.brain.q, S.world.numStates)) S.brain.episodes = project.brain.episodes || 1;
  delete project.brain;
  fillAll();
  if (EMBED) {
    $('#subTitle').textContent = project.title + ' · เกมที่สร้างด้วย Moblet Forge';
    $('#levelName').readOnly = true;
  }
  setTab(S.tab);
  requestAnimationFrame(frame);
})();
