/**
 * Headless smoke test for core Aetheria systems (no browser).
 */
import { newGame, foundCity, canAfford } from '../js/state.js';
import { endTurn, moveUnit, queueBuilding } from '../js/systems.js';
import { buildTechTree, WONDERS, SPACE_BODIES } from '../js/data.js';
import {
  ensureAdminAccount,
  signIn,
  clearCampaignData,
  listAccounts,
  VAULT_KEY,
} from '../js/auth.js';

// Minimal localStorage polyfill for Node smoke
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
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}
// crypto.subtle exists in Node 22

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('ok:', msg);
  }
}

const state = newGame({ seed: 42 });
assert(state.world.width === 64 && state.world.height === 44, 'world size');
assert(state.units.some((u) => u.type === 'scout'), 'has scout');
assert(state.units.some((u) => u.type === 'settler'), 'has settler');
assert(state.chronicle.length > 4, 'prior chronicle seeded');
assert(state.techs.length >= 2000, `tech tree size (${state.techs.length})`);
assert(buildTechTree().length === state.techs.length, 'tech builder stable');
assert(state.rivals.length === 3, 'three rivals');
assert(state.legends.some((l) => l.id === 'marcus'), 'Marcus legend');
assert(state.wonders.length === WONDERS.length, 'wonders loaded');
assert(state.spaceBodies.length === SPACE_BODIES.length, 'space bodies');

const settler = state.units.find((u) => u.type === 'settler');
const founded = foundCity(state, settler);
assert(founded, 'found city');
assert(state.cities.length === 1, 'one city');
assert(state.citizens.length >= 12, 'citizens generated');

const city = state.cities[0];
assert(queueBuilding(state, city, 'farm'), 'queue farm');
assert(queueBuilding(state, city, 'barracks'), 'queue barracks');

for (let i = 0; i < 6; i++) endTurn(state);
assert(city.buildings.includes('farm'), 'farm completed');
assert(state.season, 'season advances');
assert(state.livingScore.value >= 0, 'living score computed');

const scout = state.units.find((u) => u.type === 'scout');
if (scout) {
  const before = scout.moves;
  let moved = false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (moveUnit(state, scout, scout.x + dx, scout.y + dy)) {
      moved = true;
      break;
    }
  }
  assert(moved || scout.moves < before, 'scout can move/spend moves');
}

state.player.fantasy = true;
endTurn(state);
assert(state.player.fantasy === true, 'fantasy toggle state');
assert(canAfford({ gold: 10 }, { gold: 5 }), 'canAfford');

const boot = await ensureAdminAccount();
assert(boot.username === 'admin', 'admin account exists');
localStorage.setItem('aetheria_save', '{"keep":false}');
const removed = clearCampaignData();
assert(removed.includes('aetheria_save'), 'campaign clear removes save');
assert(localStorage.getItem(VAULT_KEY), 'admin vault survives campaign clear');
const again = await ensureAdminAccount();
assert(again.created === false, 'admin not recreated as new wipe');
assert(listAccounts().some((a) => a.role === 'admin'), 'admin listed after clear');
const login = await signIn('admin', 'admin', { remember: false });
assert(login.ok, 'admin can sign in');

if (failed) {
  console.error(`\n${failed} smoke checks failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
