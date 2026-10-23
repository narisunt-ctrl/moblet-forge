/* Moblet Forge — engine.js
 * Grid world + event-rule system. The rules a creator writes are the reward
 * function the Moblet learns from.
 * Copyright (c) 2026 Narisan Nakakes. MIT License.
 */
(function (g) {
  'use strict';
  const MF = (g.MF = g.MF || {});

  // Tile chars used in saved levels
  const TILES = {
    '.': { id: 'floor', th: 'พื้น', solid: false },
    '#': { id: 'wall', th: 'กำแพง', solid: true },
    'S': { id: 'start', th: 'จุดเกิด', solid: false },
    'B': { id: 'beacon', th: 'ตะเกียงเส้นชัย', solid: false },
    'e': { id: 'ember', th: 'ถ่านไฟ', solid: false },
    'x': { id: 'thorn', th: 'หนาม', solid: false },
    'k': { id: 'key', th: 'กุญแจ', solid: false },
    'G': { id: 'gate', th: 'ประตูกุญแจ', solid: false },
    'w': { id: 'wind', th: 'ลมพัด', solid: false },
    'm': { id: 'mud', th: 'โคลนลื่น', solid: false },
  };
  const SLIP_CHANCE = 0.4; // chance a step taken from mud goes in a random direction

  // Small seeded PRNG so worlds and training runs can be reproduced
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const MAX_EMBERS = 8;

  // Events a rule can listen to
  const EVENTS = {
    every_step: 'ทุกก้าวที่เดิน',
    bump_wall: 'ชนกำแพง / ประตูปิด',
    touch_ember: 'เก็บถ่านไฟ',
    all_embers: 'เก็บถ่านไฟครบทุกก้อน',
    pick_key: 'เก็บกุญแจ',
    touch_thorn: 'เหยียบหนาม',
    reach_beacon: 'ถึงตะเกียงเส้นชัย',
    blown: 'โดนลมพัด',
    slip: 'ลื่นโคลน',
    timeout: 'หมดเวลา',
  };
  const CONDITIONS = {
    always: 'เสมอ',
    has_key: 'ถ้ามีกุญแจ',
    no_key: 'ถ้ายังไม่มีกุญแจ',
    all_embers: 'ถ้าเก็บถ่านไฟครบ',
    missing_embers: 'ถ้าถ่านไฟยังไม่ครบ',
  };
  // dx, dy for actions 0..3 = up, right, down, left
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function defaultRules() {
    return [
      { id: 'r1', on: true, when: 'every_step', cond: 'always', reward: -0.02, end: false, win: false },
      { id: 'r2', on: true, when: 'bump_wall', cond: 'always', reward: -0.1, end: false, win: false },
      { id: 'r3', on: true, when: 'touch_ember', cond: 'always', reward: 0.5, end: false, win: false },
      { id: 'r4', on: true, when: 'touch_thorn', cond: 'always', reward: -1, end: true, win: false },
      { id: 'r5', on: true, when: 'reach_beacon', cond: 'all_embers', reward: 2, end: true, win: true },
      { id: 'r6', on: true, when: 'timeout', cond: 'always', reward: -0.5, end: true, win: false },
    ];
  }

  class World {
    constructor(level, rules, seed) {
      this.seed = seed == null ? 99 : seed;
      this.rand = mulberry32(this.seed);
      this.load(level, rules);
    }
    reseed(seed) {
      this.seed = seed;
      this.rand = mulberry32(seed);
    }
    load(level, rules) {
      this.level = level;
      this.rules = rules || defaultRules();
      this.w = level.w;
      this.h = level.h;
      this.grid = [];
      this.emberIndex = new Int16Array(this.w * this.h).fill(-1);
      this.start = 0;
      let embers = 0;
      for (let y = 0; y < this.h; y++) {
        const row = level.grid[y] || '';
        for (let x = 0; x < this.w; x++) {
          let c = row[x] || '.';
          if (!TILES[c]) c = '.';
          const i = y * this.w + x;
          if (c === 'S') this.start = i;
          if (c === 'e') {
            if (embers < MAX_EMBERS) this.emberIndex[i] = embers++;
            else c = '.';
          }
          this.grid.push(c);
        }
      }
      if (!level.grid.some((r) => r.includes('S'))) {
        const free = this.grid.findIndex((c) => c === '.');
        this.start = free < 0 ? 0 : free;
      }
      this.embers = embers;
      this.fullMask = (1 << embers) - 1;
      this.maxSteps = level.maxSteps || this.w * this.h * 2;
      this.reset();
    }
    get numStates() {
      return this.w * this.h * 2 * (1 << this.embers);
    }
    reset() {
      this.pos = this.start;
      this.mask = 0;
      this.hasKey = 0;
      this.steps = 0;
      this.done = false;
      this.won = false;
      this.ret = 0;
      return this.state();
    }
    state() {
      return ((this.pos * 2 + this.hasKey) << this.embers) | this.mask;
    }
    stateOf(pos, hasKey, mask) {
      return ((pos * 2 + hasKey) << this.embers) | mask;
    }
    tileAt(i) {
      const c = this.grid[i];
      if (c === 'e' && this.emberIndex[i] >= 0 && this.mask & (1 << this.emberIndex[i])) return '.';
      if (c === 'k' && this.hasKey) return '.';
      return c;
    }
    _blocked(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
      const c = this.grid[y * this.w + x];
      return c === '#' || (c === 'G' && !this.hasKey);
    }
    condOk(cond) {
      switch (cond) {
        case 'has_key': return this.hasKey === 1;
        case 'no_key': return this.hasKey === 0;
        case 'all_embers': return this.mask === this.fullMask;
        case 'missing_embers': return this.mask !== this.fullMask;
        default: return true;
      }
    }
    step(a) {
      if (this.done) return { s: this.state(), r: 0, done: true, events: [] };
      const events = ['every_step'];
      // Mud is a "behavior" tile: it may override the chosen action (stochastic world)
      if (this.grid[this.pos] === 'm' && this.rand() < SLIP_CHANCE) {
        a = (this.rand() * 4) | 0;
        events.push('slip');
      }
      const [dx, dy] = DIRS[a];
      let x = this.pos % this.w, y = (this.pos / this.w) | 0;
      if (this._blocked(x + dx, y + dy)) events.push('bump_wall');
      else { x += dx; y += dy; }
      // Wind tiles push the Moblet one more cell in the same direction
      if (this.grid[y * this.w + x] === 'w' && !this._blocked(x + dx, y + dy)) {
        x += dx; y += dy;
        events.push('blown');
      }
      this.pos = y * this.w + x;
      const c = this.tileAt(this.pos);
      if (c === 'e') {
        this.mask |= 1 << this.emberIndex[this.pos];
        events.push('touch_ember');
        if (this.mask === this.fullMask) events.push('all_embers');
      } else if (c === 'k') {
        this.hasKey = 1;
        events.push('pick_key');
      } else if (c === 'x') events.push('touch_thorn');
      else if (c === 'B') events.push('reach_beacon');
      this.steps++;
      const timedOut = this.steps >= this.maxSteps;
      if (timedOut) events.push('timeout');

      let r = 0;
      for (const rule of this.rules) {
        if (!rule.on || !events.includes(rule.when) || !this.condOk(rule.cond)) continue;
        r += +rule.reward || 0;
        if (rule.end) this.done = true;
        if (rule.win) { this.won = true; this.done = true; }
      }
      if (timedOut) this.done = true;
      this.ret += r;
      return { s: this.state(), r, done: this.done, events };
    }
    clone(seed) {
      return new World(this.level, this.rules, seed == null ? this.seed : seed);
    }
  }

  function blankLevel(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) row += x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.';
      grid.push(row);
    }
    grid[1] = '#S' + grid[1].slice(2);
    grid[h - 2] = grid[h - 2].slice(0, w - 2) + 'B#';
    return { name: 'ด่านใหม่', w, h, grid };
  }

  function setTile(level, x, y, c) {
    const row = level.grid[y];
    if (c === 'S') level.grid = level.grid.map((r) => r.replace(/S/g, '.'));
    const r2 = level.grid[y];
    level.grid[y] = r2.slice(0, x) + c + r2.slice(x + 1);
    return row !== level.grid[y];
  }

  function resizeLevel(level, w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) row += (level.grid[y] && level.grid[y][x]) || '.';
      grid.push(row);
    }
    return Object.assign({}, level, { w, h, grid });
  }

  MF.TILES = TILES;
  MF.EVENTS = EVENTS;
  MF.CONDITIONS = CONDITIONS;
  MF.DIRS = DIRS;
  MF.MAX_EMBERS = MAX_EMBERS;
  MF.World = World;
  MF.mulberry32 = mulberry32;
  MF.SLIP_CHANCE = SLIP_CHANCE;
  MF.defaultRules = defaultRules;
  MF.blankLevel = blankLevel;
  MF.setTile = setTile;
  MF.resizeLevel = resizeLevel;
})(typeof window !== 'undefined' ? window : globalThis);
