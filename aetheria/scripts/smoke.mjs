/**
 * Headless smoke for rebuilt Aetheria HTML prototype.
 */
import { newCampaign, foundCity, moveUnit, endTurn, queueBuilding, canAfford } from '../js/game.js';
import {
  ensureAdminAccount, signIn, clearCampaignData, listAccounts, VAULT_KEY,
} from '../js/auth.js';

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

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else console.log('ok:', msg);
}

const state = newCampaign({ seed: 7 });
assert(state.world.width === 80 && state.world.height === 56, 'bigger world 80x56');
assert(state.units.some((u) => u.type === 'scout'), 'scout');
assert(state.units.some((u) => u.type === 'settler'), 'settler');
assert(state.rivals.length === 4, 'four rivals');
assert(state.world.sites.length >= 8, 'exploration sites');

const settler = state.units.find((u) => u.type === 'settler');
assert(foundCity(state, settler), 'found city');
assert(state.cities.length === 1, 'one city');
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
assert(state.season, 'seasons advance');

const boot = await ensureAdminAccount();
assert(boot.username === 'admin', 'admin exists');
localStorage.setItem('aetheria_save', '{}');
const removed = clearCampaignData();
assert(removed.includes('aetheria_save'), 'clears campaign');
assert(!!localStorage.getItem(VAULT_KEY), 'vault survives');
assert(listAccounts().some((a) => a.role === 'admin'), 'admin listed');
assert((await signIn('admin', 'admin')).ok, 'admin login');
assert(canAfford({ gold: 10 }, { gold: 5 }), 'canAfford');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
