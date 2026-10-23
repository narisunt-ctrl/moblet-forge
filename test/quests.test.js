// Every coach quest must be solvable within its budget, and must NOT pass with the
// untouched starter rules (all rewards 0). Run: node test/quests.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
for (const f of ['engine.js', 'rl.js', 'quests.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), { filename: f });
}
const MF = globalThis.MF;
const R = (when, reward, cond) => ({ id: when + (cond || ''), on: true, when, cond: cond || 'always', reward, end: false, win: false });

// Reference solutions (one per quest) — proof that each puzzle has an answer.
const SOLUTIONS = {
  q1: { algo: 'q', rules: [R('reach_beacon', 2), R('every_step', -0.05)] },
  q2: { algo: 'q', rules: [R('reach_beacon', 1.3), R('touch_thorn', -2.6), R('every_step', -0.05)] },
  q3: { algo: 'q', rules: [R('reach_beacon', 2, 'all_embers'), R('reach_beacon', -1, 'missing_embers'), R('touch_ember', 0.3), R('every_step', -0.03)] },
  q4: { algo: 'q', rules: [R('reach_beacon', 2), R('every_step', -0.5)] },
  q5: { algo: 'sarsa', rules: [R('reach_beacon', 1.5), R('touch_thorn', -2), R('every_step', -0.02)] },
  q6: { algo: 'q', rules: [R('reach_beacon', 2), R('bump_wall', -0.5), R('every_step', -0.2)] },
};

// Plausible-but-wrong answers that each puzzle is designed to reject.
const TRAPS = {
  q2: { algo: 'q', rules: [R('reach_beacon', 2), R('touch_thorn', -1), R('every_step', -0.05)] },
  q3: { algo: 'q', rules: [R('reach_beacon', 2), R('touch_ember', 0.5), R('every_step', -0.05)] },
  q4: { algo: 'q', rules: [R('reach_beacon', 2), R('every_step', -0.05)] },
  q5: { algo: 'q', rules: [R('reach_beacon', 2), R('touch_thorn', -0.3), R('every_step', -0.05)] },
  q6: { algo: 'q', rules: [R('reach_beacon', 2), R('every_step', -0.05)] },
};

let failed = 0;
const grade = (q, rules, algo) => { const run = new MF.QuestRun(q, rules, algo); while (!run.done) run.step(1000); return run.result; };
for (const q of MF.QUESTS) {
  const opt = MF.optimalSteps(q.level, q.goal);
  const sol = SOLUTIONS[q.id];
  const t0 = Date.now();
  const good = grade(q, sol.rules, sol.algo);
  const blank = grade(q, q.starter, 'q');
  const trap = TRAPS[q.id] ? grade(q, TRAPS[q.id].rules, TRAPS[q.id].algo) : null;
  const ok = good.passed && !blank.passed && !(trap && trap.passed);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${q.id} ${q.title}: optimal=${opt} | solution ${good.passed ? 'passed' : 'failed (' + good.reason + ')'} ` +
    `at ${good.episodes} ep, ${good.stars}★, budget ${good.used.toFixed(2)}/${q.budget}, rate ${good.rate} | blank ${blank.passed ? 'PASSED (bad)' : 'fails'}${trap ? ' | trap ' + (trap.passed ? 'PASSED (bad)' : 'fails: ' + trap.reason) : ''} | ${Date.now() - t0} ms`);
}
process.exit(failed ? 1 : 0);
