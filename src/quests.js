/* Moblet Forge — quests.js
 * "ภารกิจครูฝึก" (Coach Quests): a reward-design puzzle mode.
 * The player never moves the Moblet. They write reward rules within a budget,
 * then the quest trains a fresh brain with a fixed seed and grades the trained
 * Moblet against a hidden-from-the-reward objective.
 * Game design: Narisan Nakakes (นริสันต์ นาคะเกศ). MIT License.
 */
(function (g) {
  'use strict';
  const MF = (g.MF = g.MF || {});

  const END_AT_BEACON = { id: 'L1', on: true, when: 'reach_beacon', cond: 'always', reward: 0, end: true, win: true, locked: true };
  const END_AT_TIMEOUT = { id: 'L2', on: true, when: 'timeout', cond: 'always', reward: 0, end: true, win: false, locked: true };
  const starter = (when, cond) => ({ id: 'p' + when, on: true, when, cond: cond || 'always', reward: 0, end: false, win: false });

  const QUESTS = [
    {
      id: 'q1', title: 'ก้าวแรกของครูฝึก',
      brief: 'ให้โมบเล็ตเดินถึงตะเกียงเส้นชัย ตอนนี้มันไม่รู้เลยว่าตะเกียงดี ต้องบอกมันด้วยคะแนน',
      goal: { beacon: true }, budget: 3, maxRules: 2, episodes: 400, checkpoint: 20, par: [100, 60],
      level: { name: 'ก้าวแรกของครูฝึก', w: 8, h: 5, maxSteps: 40, grid: ['########', '#S....B#', '#.####.#', '#......#', '########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT], starter: [starter('reach_beacon')],
      hint: 'ลองให้คะแนนบวกเมื่อถึงตะเกียง',
    },
    {
      id: 'q2', title: 'อย่าเหยียบหนาม',
      brief: 'ทางลัดมีหนามขวาง ให้โมบเล็ตถึงตะเกียงโดยไม่เหยียบหนามเลยสักครั้ง (หนามในด่านนี้ไม่ทำให้จบรอบ)',
      goal: { beacon: true, noThorn: true }, budget: 4, maxRules: 3, episodes: 500, checkpoint: 20, par: [100, 40],
      level: { name: 'อย่าเหยียบหนาม', w: 9, h: 5, maxSteps: 40, grid: ['#########', '#S..x..B#', '#.#####.#', '#.......#', '#########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT], starter: [starter('reach_beacon'), starter('touch_thorn')],
      hint: 'ทางอ้อมแทบไม่เคยถูกสำรวจ โทษของหนามต้องหนักกว่ารางวัลของตะเกียง หรือลอง SARSA',
    },
    {
      id: 'q3', title: 'นักสะสมถ่านไฟ',
      brief: 'ตะเกียงจบรอบทันทีที่แตะ ให้โมบเล็ตเก็บถ่านไฟครบ 3 ก้อนก่อนไปแตะตะเกียง',
      goal: { beacon: true, allEmbers: true }, budget: 5, maxRules: 4, episodes: 1500, checkpoint: 50, par: [300, 100],
      level: { name: 'นักสะสมถ่านไฟ', w: 9, h: 7, maxSteps: 70, grid: ['#########', '#S.....e#', '#.#.###.#', '#e#..B#.#', '#.###.#.#', '#...e...#', '#########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT], starter: [starter('reach_beacon', 'all_embers'), starter('touch_ember')],
      hint: 'เงื่อนไข "ถ้าเก็บถ่านไฟครบ" กับ "ถ้ายังไม่ครบ" ใช้คู่กันได้',
    },
    {
      id: 'q4', title: 'ลมส่งตัว',
      brief: 'ถ่านไฟด้านล่างให้คะแนนอยู่แล้ว (+0.5 ล็อกไว้) แต่ภารกิจคือถึงตะเกียงด้วยจำนวนก้าวน้อยที่สุดเท่าที่เป็นไปได้ ผ่านช่องลม',
      goal: { beacon: true, maxSteps: 'optimal' }, budget: 5, maxRules: 3, episodes: 800, checkpoint: 25, par: [100, 25],
      level: { name: 'ลมส่งตัว', w: 11, h: 5, maxSteps: 40, grid: ['###########', '#S.w.w.w.B#', '#.#######.#', '#.e.e.e.e.#', '###########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT, { id: 'L3', on: true, when: 'touch_ember', cond: 'always', reward: 0.5, end: false, win: false, locked: true }],
      starter: [starter('reach_beacon'), starter('every_step')],
      hint: 'ทางล่างได้ถ่านไฟ +2 แต่เดินเพิ่มหลายก้าว ค่าต่อก้าวต้องแพงพอ',
    },
    {
      id: 'q5', title: 'สะพานโคลนลื่น',
      brief: 'โคลนทำให้ก้าวพลาดไปทิศสุ่ม 40% ใต้โคลนคือแนวหนาม ต้องผ่านด่านโดยไม่เหยียบหนามอย่างน้อย 18 ใน 20 รอบทดสอบ',
      goal: { beacon: true, noThorn: true, trials: 20, passRate: 0.9 }, budget: 4, maxRules: 3, episodes: 1500, checkpoint: 50, par: [250, 100],
      level: { name: 'สะพานโคลนลื่น', w: 9, h: 7, maxSteps: 60, grid: ['#########', '#.......#', '#.#####.#', '#.#####.#', '#Smmmmm.#', '#xxxxxxB#', '#########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT], starter: [starter('reach_beacon'), starter('touch_thorn')],
      hint: 'ลองเปลี่ยนวิธีเรียนรู้เป็น SARSA ที่ระวังตัวกว่า หรือทำให้หนามน่ากลัวกว่าความเร็ว',
    },
    {
      id: 'q6', title: 'กุญแจทางไกล',
      brief: 'โมบเล็ตตัวนี้ชอบเดินเล่น (ได้ +0.1 ทุกก้าว ล็อกไว้) ตะเกียงอยู่หลังประตูกุญแจ ให้ถึงตะเกียงด้วยก้าวน้อยที่สุด และห้ามชนกำแพงหรือประตูเลย',
      goal: { beacon: true, maxSteps: 'optimal', noBump: true }, budget: 5, maxRules: 4, episodes: 1500, checkpoint: 50, par: [200, 50],
      level: { name: 'กุญแจทางไกล', w: 9, h: 7, maxSteps: 60, grid: ['#########', '#S.....k#', '#.#####.#', '#.#B.G..#', '#.#####.#', '#.......#', '#########'] },
      locked: [END_AT_BEACON, END_AT_TIMEOUT, { id: 'L4', on: true, when: 'every_step', cond: 'always', reward: 0.1, end: false, win: false, locked: true }],
      starter: [starter('reach_beacon'), starter('every_step')],
      hint: 'ความสุขจากการเดินเล่นต้องถูกหักล้างก่อน ไม่งั้นมันจะเดินจนหมดเวลา',
    },
  ];

  // Breadth-first search for the fewest steps that satisfy a goal (mud treated as solid ground).
  function optimalSteps(level, goal) {
    const w = new MF.World(level, []);
    w.rand = () => 0.999; // never slip
    const seen = new Set();
    let frontier = [[w.pos, 0, 0]];
    seen.add(w.stateOf(w.pos, 0, 0));
    for (let depth = 1; depth <= 400 && frontier.length; depth++) {
      const next = [];
      for (const [pos, key, mask] of frontier) {
        for (let a = 0; a < 4; a++) {
          w.pos = pos; w.hasKey = key; w.mask = mask; w.steps = 0; w.done = false;
          const { events } = w.step(a);
          if (goal.noThorn && events.includes('touch_thorn')) continue;
          if (goal.noBump && events.includes('bump_wall')) continue;
          if (events.includes('reach_beacon')) {
            if (!goal.allEmbers || w.mask === w.fullMask) return depth;
            continue; // beacon ends the episode in quests
          }
          const s = w.stateOf(w.pos, w.hasKey, w.mask);
          if (!seen.has(s)) { seen.add(s); next.push([w.pos, w.hasKey, w.mask]); }
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  // Did one greedy rollout satisfy the quest goal?
  function checkRun(goal, roll, world, optimal) {
    const path = roll.path;
    let reachIdx = -1, thorn = false, bump = false;
    for (let i = 1; i < path.length; i++) {
      const ev = path[i].events;
      if (ev.includes('touch_thorn')) thorn = true;
      if (ev.includes('bump_wall')) bump = true;
      if (ev.includes('reach_beacon')) { reachIdx = i; break; }
    }
    const why = [];
    if (goal.beacon && reachIdx < 0) why.push('ไม่ถึงตะเกียง');
    if (goal.noThorn && thorn) why.push('เหยียบหนาม');
    if (goal.noBump && bump) why.push('เดินชนกำแพง');
    if (goal.allEmbers && reachIdx >= 0 && path[reachIdx].mask !== world.fullMask) why.push('ถ่านไฟไม่ครบ');
    if (goal.maxSteps && reachIdx >= 0) {
      const lim = goal.maxSteps === 'optimal' ? optimal : goal.maxSteps;
      if (reachIdx > lim) why.push(`ใช้ ${reachIdx} ก้าว (ต้องไม่เกิน ${lim})`);
    }
    return { ok: why.length === 0, why, steps: reachIdx < 0 ? path.length - 1 : reachIdx };
  }

  function budgetUsed(rules) {
    return rules.filter((r) => r.on && !r.locked).reduce((s, r) => s + Math.abs(+r.reward || 0), 0);
  }

  // A resumable grading run, so the UI can grade in small time slices.
  class QuestRun {
    constructor(quest, playerRules, algo) {
      this.quest = quest;
      const mine = playerRules.filter((r) => r.on).map((r) => Object.assign({}, r, { locked: false }));
      this.used = budgetUsed(mine);
      this.rules = quest.locked.concat(mine);
      this.world = new MF.World(quest.level, this.rules, 11);
      this.brain = new MF.Brain(this.world.numStates, { algo: algo || 'q', alpha: 0.5, gamma: 0.97, epsStart: 1, epsMin: 0.05, epsDecay: quest.decay || 0.99, seed: 7 });
      this.optimal = quest.goal.maxSteps === 'optimal' ? optimalSteps(quest.level, quest.goal) : null;
      this.episodes = 0;
      this.done = false;
      this.result = null;
      this.curve = []; // [episodes, passRate]
      if (this.used > quest.budget + 1e-9) this._finish(false, `ใช้งบคะแนน ${this.used.toFixed(2)} เกินงบ ${quest.budget}`);
      else if (mine.length > quest.maxRules) this._finish(false, `ใช้กฎ ${mine.length} ข้อ เกินที่อนุญาต ${quest.maxRules} ข้อ`);
    }
    evaluate() {
      const goal = this.quest.goal, trials = goal.trials || 1;
      let pass = 0, sample = null, sampleCheck = null;
      for (let i = 0; i < trials; i++) {
        const w = this.world.clone(1000 + i);
        const roll = this.brain.rollout(w, null, true);
        const c = checkRun(goal, roll, w, this.optimal);
        if (c.ok) pass++;
        if (!sample || (!c.ok && sampleCheck.ok)) { sample = roll; sampleCheck = c; }
      }
      return { rate: pass / trials, sample, check: sampleCheck };
    }
    step(msBudget) {
      if (this.done) return this;
      const q = this.quest, end = Date.now() + (msBudget || 20);
      while (!this.done && Date.now() < end) {
        for (let k = 0; k < q.checkpoint && this.episodes < q.episodes; k++) { this.brain.runEpisode(this.world); this.episodes++; }
        const ev = this.evaluate();
        this.curve.push([this.episodes, ev.rate]);
        this.last = ev;
        const need = q.goal.passRate || 1;
        if (ev.rate >= need - 1e-9) this._finish(true, null, ev);
        else if (this.episodes >= q.episodes) this._finish(false, ev.check.why.join(', ') || 'ยังไม่ผ่านเป้าหมาย', ev);
      }
      return this;
    }
    _finish(passed, reason, ev) {
      this.done = true;
      const q = this.quest;
      let stars = 0;
      if (passed) stars = this.episodes <= q.par[1] ? 3 : this.episodes <= q.par[0] ? 2 : 1;
      this.result = { passed, reason, stars, episodes: this.episodes, used: this.used, rate: ev ? ev.rate : 0, sample: ev ? ev.sample : null, optimal: this.optimal };
    }
  }

  MF.QUESTS = QUESTS;
  MF.QuestRun = QuestRun;
  MF.optimalSteps = optimalSteps;
  MF.checkRun = checkRun;
  MF.budgetUsed = budgetUsed;
})(typeof window !== 'undefined' ? window : globalThis);
