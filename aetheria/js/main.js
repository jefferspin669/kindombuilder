import { newGame, foundCity } from './state.js';
import { moveUnit, endTurn } from './systems.js';
import { renderMap } from './render.js';
import { bindUI, refreshAll } from './ui.js';
import { mulberry32, log, chronicle, uid } from './utils.js';

const canvas = document.getElementById('map');
const stateRef = { current: null };

function redraw() {
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

const app = {
  stateRef,
  canvas,
  redraw,
  newGame: () => start({ massive: stateRef.current?.multi?.wantMassive }),
  save,
  load,
  exportSave,
  sealAge,
  moveSelected(x, y) {
    const u = stateRef.current.units.find((unit) => unit.id === stateRef.current.selectedUnitId);
    if (u) moveUnit(stateRef.current, u, x, y);
  },
};

bindUI(app);
window.addEventListener('aetheria-refresh', () => refreshAll(app));
window.addEventListener('aetheria-seal', () => sealAge());
window.addEventListener('aetheria-continue', (e) => continueEra(e.detail));

start();

window.__AETHERIA__ = {
  getState: () => stateRef.current,
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
};
