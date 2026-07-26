import {
  newCampaign, serialize, revive, foundCity, moveUnit, endTurn,
} from './game.js';
import { bindUI, refreshAll } from './ui.js';
import { setAudioEnabled, isAudioEnabled, beep } from './audio.js';
import { toast } from './utils.js';

const canvas = document.getElementById('map');
const stateRef = { current: null };

function fitCanvas() {
  const wrap = document.querySelector('.map-stage');
  if (!wrap) return;
  const w = Math.min(1100, wrap.clientWidth - 8);
  const h = Math.min(720, Math.max(420, window.innerHeight - 220));
  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
}

function start(opts = {}) {
  fitCanvas();
  stateRef.current = newCampaign({
    seed: opts.seed,
    width: 80,
    height: 56,
    kingdomName: opts.kingdomName,
  });
  refreshAll(app);
}

function save(slot = 'autosave') {
  const key = slot === 'autosave' ? 'aetheria_save' : `aetheria_slot_${slot}`;
  localStorage.setItem(key, JSON.stringify(serialize(stateRef.current)));
  toast(`Saved (${slot})`, 'good');
  beep('good');
}

function load(slot = 'autosave') {
  const key = slot === 'autosave' ? 'aetheria_save' : `aetheria_slot_${slot}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    toast('No save in that slot.', 'warn');
    return;
  }
  stateRef.current = revive(JSON.parse(raw));
  fitCanvas();
  refreshAll(app);
  toast(`Loaded (${slot})`, 'good');
}

function clearSaves() {
  if (!confirm('Clear all local campaign saves?')) return;
  const keys = [];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k === 'aetheria_save' || k.startsWith('aetheria_slot_'))) {
      localStorage.removeItem(k);
      keys.push(k);
    }
  }
  start();
  document.getElementById('menu-modal')?.classList.add('hidden');
  toast(`Cleared ${keys.length || 0} save(s).`, 'good');
}

function boot() {
  fitCanvas();
  bindUI(app);
  window.addEventListener('resize', () => {
    fitCanvas();
    if (stateRef.current) refreshAll(app);
  });

  const audioToggle = document.getElementById('menu-audio');
  if (audioToggle) {
    audioToggle.checked = isAudioEnabled();
    audioToggle.onchange = () => setAudioEnabled(audioToggle.checked);
  }

  const existing = localStorage.getItem('aetheria_save');
  if (existing) {
    try {
      stateRef.current = revive(JSON.parse(existing));
      refreshAll(app);
      toast('Loaded last save. Use Menu → New Campaign to start fresh.', 'info');
      return;
    } catch {
      // fall through
    }
  }
  start();
}

const app = {
  stateRef,
  canvas,
  newGame: () => start(),
  save: () => save('autosave'),
  load: () => load('autosave'),
  saveSlot: (n) => save(n),
  loadSlot: (n) => load(n),
  clearSaves,
};

boot();

window.__AETHERIA__ = {
  getState: () => stateRef.current,
  newGame: start,
  endTurn: () => {
    endTurn(stateRef.current);
    refreshAll(app);
  },
  foundFirstCity: () => {
    const settler = stateRef.current.units.find((u) => u.type === 'settler');
    if (settler) {
      foundCity(stateRef.current, settler);
      refreshAll(app);
    }
  },
  moveUnit,
};
