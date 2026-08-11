/**
 * Logic + start-button smoke for Aetheria HTML game.
 */
import { newCampaign, foundCity, moveUnit, endTurn, queueBuilding, canAfford } from '../js/game.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
  };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else console.log('ok:', msg);
}

// --- HTML contract checks ---
const html = readFileSync(join(__dirname, '..', 'game.html'), 'utf8');
assert(html.includes('id="btn-begin"'), 'Begin Reign button in game.html');
assert(html.includes('id="start-screen"'), 'start screen present');
assert(html.includes('id="app"'), 'app shell present');
assert(html.includes('src="js/main.js"'), 'main.js module loaded');
assert(html.includes('id="map"'), 'map canvas present');

const mainSrc = readFileSync(join(__dirname, '..', 'js/main.js'), 'utf8');
assert(mainSrc.includes('wireStartScreen'), 'main wires start screen');
assert(mainSrc.includes('__AETHERIA_READY__'), 'ready flag set');
assert(mainSrc.includes('startGame'), 'startGame exists');
assert(!mainSrc.includes('clearSaves,\n};\n\n\n  newGame:'), 'main.js not truncated/corrupt');

// --- Gameplay logic ---
const state = newCampaign({ seed: 7 });
assert(state.world.width === 80 && state.world.height === 56, 'world size');
assert(state.units.some((u) => u.type === 'scout'), 'scout');
assert(state.units.some((u) => u.type === 'settler'), 'settler');
assert(state.rivals.length === 4, 'rivals');
assert(state.version === 2, 'save version 2');

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

// null-safe foundCity
assert(foundCity(state, null) === false, 'foundCity rejects null unit');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
