/**
 * Headless smoke for HTML/CSS/JS Aetheria testing build.
 */
import { newCampaign, foundCity, moveUnit, endTurn, queueBuilding, canAfford } from '../js/game.js';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else console.log('ok:', msg);
}

const state = newCampaign({ seed: 7 });
assert(state.world.width === 80 && state.world.height === 56, 'world size');
assert(state.units.some((u) => u.type === 'scout'), 'scout');
assert(state.units.some((u) => u.type === 'settler'), 'settler');
assert(state.rivals.length === 4, 'rivals');

const settler = state.units.find((u) => u.type === 'settler');
assert(foundCity(state, settler), 'found city');
assert(queueBuilding(state, state.cities[0], 'farm'), 'queue farm');

const scout = state.units.find((u) => u.type === 'scout');
let moved = false;
for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  if (moveUnit(state, scout, scout.x + dx, scout.y + dy)) {
    moved = true;
    break;
  }
}
assert(moved, 'scout moves');

for (let i = 0; i < 5; i++) endTurn(state);
assert(state.cities[0].buildings.includes('farm'), 'farm built');
assert(canAfford({ gold: 10 }, { gold: 5 }), 'canAfford');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
