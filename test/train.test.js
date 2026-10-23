// Headless check: a Moblet trained with default rules should clear every sample level.
// Run: node test/train.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
for (const f of ['engine.js', 'rl.js', 'levels.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), { filename: f });
}
const MF = globalThis.MF;
let failed = 0;
for (const algo of ['q', 'sarsa']) {
  for (const lvl of MF.SAMPLES) {
    const world = new MF.World(lvl, MF.defaultRules());
    const brain = new MF.Brain(world.numStates, { algo });
    const t0 = Date.now();
    let episodes = 0;
    for (; episodes < 6000; episodes++) {
      brain.runEpisode(world);
      if (episodes % 200 === 199 && brain.rollout(world.clone()).won) break;
    }
    const roll = brain.rollout(world.clone());
    const ok = roll.won;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${algo}] ${lvl.name}: ${episodes + 1} episodes, ` +
      `greedy path ${roll.path.length - 1} steps, return ${roll.ret.toFixed(2)}, ${Date.now() - t0} ms`);
  }
}
process.exit(failed ? 1 : 0);
