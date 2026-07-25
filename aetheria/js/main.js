import { newGame, foundCity } from './state.js';
import { moveUnit, endTurn } from './systems.js';
import { renderMap } from './render.js';
import { bindUI, refreshAll } from './ui.js';
import { mulberry32, log, chronicle, uid } from './utils.js';
import {
  ensureAdminAccount,
  getSession,
  signIn,
  signOut as authSignOut,
  changePassword,
  clearCampaignData,
  exportVault,
  importVault,
  DEFAULT_ADMIN,
} from './auth.js';

const canvas = document.getElementById('map');
const stateRef = { current: null };
let uiBound = false;

function redraw() {
  if (!stateRef.current) return;
  renderMap(canvas, stateRef.current);
}

function start(opts = {}) {
  const massive = opts.massive || stateRef.current?.multi?.wantMassive;
  stateRef.current = newGame({
    seed: opts.seed,
    width: massive ? 96 : 64,
    height: massive ? 66 : 44,
    massive,
    kingdomName: opts.kingdomName,
  });
  if (opts.legacy) applyLegacy(stateRef.current, opts.legacy);
  refreshAll(app);
  updateAccountChip();
}

function applyLegacy(state, era) {
  state.calendarYear = era.year + 500;
  state.legacy.eras = era.allEras || [era];
  for (const mem of era.landmarks || []) {
    const t = state.world.tiles[mem.y * state.world.width + mem.x];
    if (t) {
      t.type = 'ruins';
      t.fog = false;
    }
    state.world.sites.push({
      id: uid('legacy'),
      kind: mem.fate === 'a powerful ally in memory' ? 'secret_civilization' : 'lost_city',
      x: mem.x,
      y: mem.y,
      discovered: true,
      delved: false,
      progress: 0,
      risk: 0.2,
      loot: { gold: 30, lore: 25 },
      legacy: true,
    });
  }
  chronicle(state, `A new age dawns +500 years after ${era.name}. The map remembers.`, 'legacy');
  log(state, 'Legacy campaign begun — ruins and legends mark the old world.', 'legacy');
}

function save() {
  const s = stateRef.current;
  // Campaign save only — vault is untouched
  localStorage.setItem('aetheria_save', JSON.stringify(sanitize(s)));
  log(s, 'Game saved.', 'system');
  refreshAll(app);
}

function load() {
  const raw = localStorage.getItem('aetheria_save');
  if (!raw) {
    alert('No save found.');
    return;
  }
  const data = JSON.parse(raw);
  data.rand = mulberry32(data.seed + data.turn);
  data.world.roads = new Set(data.world.roads || []);
  data.world.bridges = new Set(data.world.bridges || []);
  data.world.rivers = new Set(data.world.rivers || []);
  stateRef.current = data;
  log(data, 'Game loaded.', 'system');
  refreshAll(app);
}

function exportSave() {
  const data = sanitize(stateRef.current);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aetheria-year-${data.year}.json`;
  a.click();
}

function sanitize(state) {
  const copy = JSON.parse(JSON.stringify({
    ...state,
    rand: undefined,
    world: {
      ...state.world,
      roads: [...(state.world.roads || [])],
      bridges: [...(state.world.bridges || [])],
      rivers: [...(state.world.rivers || [])],
    },
  }));
  delete copy.rand;
  return copy;
}

function sealAge() {
  const s = stateRef.current;
  const fate = pickFate(s);
  const era = {
    id: uid('era'),
    name: s.player.name,
    year: s.calendarYear,
    fate,
    landmarks: s.cities.map((c) => ({ x: c.x, y: c.y, name: c.name, fate })),
    wonders: s.wonders.filter((w) => w.owner === 'player').map((w) => w.id),
  };
  s.legacy.eras.push(era);
  s.legacy.livingWorlds.push({ name: s.multi.worldName, year: s.calendarYear });
  chronicle(s, `Age sealed — ${s.player.name} becomes ${fate}.`, 'legacy');
  log(s, `Age sealed (${fate}). Continue from Legacy tab.`, 'legacy');
  s.gameOver = null;
  refreshAll(app);
}

function pickFate(s) {
  if (s.rivals.some((r) => r.alliance && r.opinion > 40)) return 'a powerful ally in memory';
  if (s.cities.length >= 3 && s.player.prestige > 40) return 'a legendary civilization';
  if (s.player.unrest > 50 || s.cities.length === 0) return 'a fallen kingdom';
  return 'ancient ruins';
}

function continueEra(era) {
  era.allEras = [...(stateRef.current.legacy.eras || [])];
  start({ seed: stateRef.current.seed + 17, legacy: era });
}

function updateAccountChip() {
  const chip = document.getElementById('account-chip');
  const session = getSession();
  if (!chip || !session) return;
  chip.textContent = `${session.username}${session.role === 'admin' ? ' · admin' : ''}`;
}

function showGame() {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (!uiBound) {
    bindUI(app);
    uiBound = true;
  }
  if (!stateRef.current) start();
  else refreshAll(app);
  updateAccountChip();
}

function showAuth(hint = '') {
  document.getElementById('auth-gate').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  const hintEl = document.getElementById('auth-hint');
  if (hintEl) hintEl.textContent = hint;
}

async function bootAuth() {
  const bootstrap = await ensureAdminAccount();
  const userInput = document.getElementById('auth-username');
  if (userInput && !userInput.value) userInput.value = DEFAULT_ADMIN.username;

  if (bootstrap.created) {
    showAuth(`First run: admin account created. Username "${DEFAULT_ADMIN.username}", password "${DEFAULT_ADMIN.password}". Change it after signing in.`);
  } else {
    showAuth('Admin account is remembered in this browser’s protected vault.');
  }

  const session = getSession();
  if (session) {
    showGame();
    return;
  }

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const remember = document.getElementById('auth-remember').checked;
    const err = document.getElementById('auth-error');
    const result = await signIn(username, password, { remember });
    if (!result.ok) {
      err.hidden = false;
      err.textContent = result.error;
      return;
    }
    err.hidden = true;
    showGame();
  });

  document.getElementById('btn-export-vault').onclick = () => {
    const blob = new Blob([exportVault()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aetheria-account-vault.json';
    a.click();
  };

  document.getElementById('import-vault').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importVault(text);
      showAuth('Vault imported. Sign in with your admin account.');
      alert('Account vault imported. Admin account preserved.');
    } catch (err) {
      alert(err.message || 'Import failed.');
    }
  };
}

const app = {
  stateRef,
  canvas,
  redraw,
  newGame: () => start({ massive: stateRef.current?.multi?.wantMassive }),
  save,
  load,
  exportSave,
  sealAge,
  signOut() {
    authSignOut({ forgetRemembered: true });
    document.getElementById('menu-modal')?.classList.add('hidden');
    showAuth('Signed out. Your admin account is still saved.');
  },
  clearCampaign() {
    if (!confirm('Clear campaign saves? Your admin account will NOT be deleted.')) return;
    const removed = clearCampaignData();
    start();
    alert(`Cleared: ${removed.join(', ') || 'nothing'}. Admin vault kept.`);
    document.getElementById('menu-modal')?.classList.add('hidden');
  },
  async changePassword(currentPassword, newPassword) {
    const session = getSession();
    if (!session) return { ok: false, error: 'Not signed in.' };
    return changePassword(session.username, currentPassword, newPassword);
  },
  getSession,
  moveSelected(x, y) {
    const u = stateRef.current.units.find((unit) => unit.id === stateRef.current.selectedUnitId);
    if (u) moveUnit(stateRef.current, u, x, y);
  },
};

window.addEventListener('aetheria-refresh', () => {
  if (stateRef.current) refreshAll(app);
});
window.addEventListener('aetheria-seal', () => sealAge());
window.addEventListener('aetheria-continue', (e) => continueEra(e.detail));

bootAuth();

window.__AETHERIA__ = {
  getState: () => stateRef.current,
  getSession,
  endTurn: () => {
    endTurn(stateRef.current);
    refreshAll(app);
  },
  newGame: start,
  foundFirstCity: () => {
    const settler = stateRef.current.units.find((u) => u.type === 'settler');
    if (settler) {
      foundCity(stateRef.current, settler);
      refreshAll(app);
    }
  },
  moveUnit,
  refresh: () => refreshAll(app),
  ensureAdminAccount,
  signIn,
  clearCampaignData,
};
