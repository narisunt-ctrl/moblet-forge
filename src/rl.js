/* Moblet Forge — rl.js
 * Tabular reinforcement learning (Q-learning and SARSA) for Moblets.
 * Copyright (c) 2026 Narisan Nakakes. MIT License.
 */
(function (g) {
  'use strict';
  const MF = (g.MF = g.MF || {});

  const mulberry32 = MF.mulberry32; // defined in engine.js

  const DEFAULT_HYPER = {
    algo: 'q',          // 'q' = Q-learning (off-policy), 'sarsa' = on-policy
    alpha: 0.5,         // learning rate
    gamma: 0.97,        // discount
    epsStart: 1.0,
    epsMin: 0.05,
    epsDecay: 0.994,    // per episode
    seed: 7,
  };

  class Brain {
    constructor(numStates, hyper) {
      this.hyper = Object.assign({}, DEFAULT_HYPER, hyper || {});
      this.resize(numStates);
    }
    resize(numStates) {
      this.nS = numStates;
      this.Q = new Float32Array(numStates * 4);
      this.visits = new Uint32Array(numStates);
      this.episodes = 0;
      this.eps = this.hyper.epsStart;
      this.rand = mulberry32(this.hyper.seed);
      this.history = []; // {ret, won, steps}
    }
    greedy(s) {
      const b = s * 4, Q = this.Q;
      let best = Q[b], n = 1, a = 0;
      for (let i = 1; i < 4; i++) {
        const v = Q[b + i];
        if (v > best + 1e-9) { best = v; a = i; n = 1; }
        else if (Math.abs(v - best) <= 1e-9 && this.rand() < 1 / ++n) a = i; // random tie-break
      }
      return a;
    }
    act(s, eps) {
      return this.rand() < eps ? (this.rand() * 4) | 0 : this.greedy(s);
    }
    maxQ(s) {
      const b = s * 4, Q = this.Q;
      return Math.max(Q[b], Q[b + 1], Q[b + 2], Q[b + 3]);
    }
    value(s) { return this.maxQ(s); }

    runEpisode(world) {
      const h = this.hyper, Q = this.Q;
      let s = world.reset();
      let a = this.act(s, this.eps);
      while (!world.done) {
        this.visits[s]++;
        const { s: s2, r, done } = world.step(a);
        const a2 = done ? 0 : this.act(s2, this.eps);
        let target = r;
        if (!done) target += h.gamma * (h.algo === 'sarsa' ? Q[s2 * 4 + a2] : this.maxQ(s2));
        const idx = s * 4 + a;
        Q[idx] += h.alpha * (target - Q[idx]);
        s = s2; a = a2;
      }
      this.episodes++;
      this.eps = Math.max(h.epsMin, this.eps * h.epsDecay);
      const rec = { ret: world.ret, won: world.won, steps: world.steps };
      this.history.push(rec);
      if (this.history.length > 5000) this.history.splice(0, this.history.length - 5000);
      return rec;
    }

    // Greedy rollout without learning; returns the visited positions
    // Deterministic argmax: ties go to the lowest action index (used for grading)
    argmax(s) {
      const b = s * 4, Q = this.Q;
      let a = 0;
      for (let i = 1; i < 4; i++) if (Q[b + i] > Q[b + a] + 1e-9) a = i;
      return a;
    }
    rollout(world, maxSteps, deterministic) {
      world.reset();
      const path = [{ pos: world.pos, hasKey: 0, mask: 0, events: [] }];
      const limit = maxSteps || world.maxSteps;
      while (!world.done && path.length <= limit) {
        const s0 = world.state();
        const st = world.step(deterministic ? this.argmax(s0) : this.greedy(s0));
        path.push({ pos: world.pos, hasKey: world.hasKey, mask: world.mask, events: st.events });
      }
      return { path, won: world.won, ret: world.ret };
    }

    winRate(last) {
      const hs = this.history.slice(-(last || 100));
      if (!hs.length) return 0;
      return hs.filter((h) => h.won).length / hs.length;
    }

    exportQ() {
      const bytes = new Uint8Array(this.Q.buffer.slice(0));
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return (typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'));
    }
    importQ(b64, numStates) {
      const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      if (bin.length !== numStates * 16) return false;
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      this.resize(numStates);
      this.Q = new Float32Array(bytes.buffer);
      this.eps = this.hyper.epsMin;
      return true;
    }
  }

  MF.Brain = Brain;
  MF.DEFAULT_HYPER = DEFAULT_HYPER;
})(typeof window !== 'undefined' ? window : globalThis);
