import {
  newCampaign, serialize, revive, foundCity, moveUnit, endTurn,
} from './game.js';
import { bindUI, refreshAll } from './ui.js';
import { setAudioEnabled, isAudioEnabled, beep } from './audio.js';
import { toast } from './utils.js';

const SAVE_KEY = 'aetheria_save';
const SAVE_VERSION = 2;

const canvas = document.getElementById('map');
const stateRef = { current: null };
let uiBound = false;
let gameStarted = false;

function fitCanvas() {
  const wrap = document.querySelector('.map-stage');
  if (!wrap || !canvas) return;
  const w = Math.min(1100, wrap.clientWidth - 8);
  const h = Math.min(720, Math.max(420, window.innerHeight - 220));
  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
}

function showError(msg) {
  const err = document.getElementById('start-error');
  if (!err) {
    alert(msg);
    return;
  }
  err.classList.remove('hidden');
  err.textContent = msg;
}

function setStatus(msg) {
  const el = document.getElementById('start-status');
  if (el) el.textContent = msg;
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION || !data.world || !data.player?.res) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function start(opts = {}) {
  fitCanvas();
  stateRef.current = newCampaign({
    seed: opts.seed,
    width: 80,
    height: 56,
    kingdomName: opts.kingdomName,
  });
  enterGame();
  refreshAll(app);
  toast('Reign begins — move your Scout, then found a city (F).', 'good');
  beep('good');
}

function continueSave() {
  const data = readSave();
  if (!data) {
    showError('No compatible save found. Click Begin Reign to start fresh.');
    return;
  }
  try {
    stateRef.current = revive(data);
    fitCanvas();
    enterGame();
    refreshAll(app);
    toast('Save loaded.', 'good');
    beep('good');
  } catch (e) {
    console.error(e);
    showError('Save could not be loaded. Click Begin Reign for a new game.');
  }
}

function enterGame() {
  gameStarted = true;
  document.getElementById('start-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  fitCanvas();
  if (!uiBound) {
    bindUI(app);
    uiBound = true;
    window.addEventListener('resize', () => {
      fitCanvas();
      if (stateRef.current) refreshAll(app);
    });
  }
}

function save(slot = 'autosave') {
  if (!stateRef.current) return;
  const key = slot === 'autosave' ? SAVE_KEY : `aetheria_slot_${slot}`;
  localStorage.setItem(key, JSON.stringify(serialize(stateRef.current)));
  toast(`Saved (${slot})`, 'good');
  beep('good');
}

function load(slot = 'autosave') {
  const key = slot === 'autosave' ? SAVE_KEY : `aetheria_slot_${slot}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    toast('No save in that slot.', 'warn');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      toast('That save is from an older build.', 'warn');
      return;
    }
    stateRef.current = revive(data);
    fitCanvas();
    refreshAll(app);
    toast(`Loaded (${slot})`, 'good');
  } catch {
    toast('Save corrupt.', 'bad');
  }
}

function clearSaves() {
  if (!confirm('Clear all local campaign saves?')) return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k === SAVE_KEY || k.startsWith('aetheria_slot_'))) {
      localStorage.removeItem(k);
    }
  }
  document.getElementById('menu-modal')?.classList.add('hidden');
  document.getElementById('btn-continue')?.classList.add('hidden');
  toast('Saves cleared.', 'good');
}

function wireStartScreen() {
  const begin = document.getElementById('btn-begin');
  const cont = document.getElementById('btn-continue');
  const save = readSave();

  if (save && cont) {
    cont.classList.remove('hidden');
    setStatus('Save found — Continue, or Begin Reign for a new campaign.');
  } else {
    setStatus('Click Begin Reign to start the game.');
  }

  begin?.addEventListener('click', () => {
    try {
      setStatus('Starting…');
      start();
    } catch (e) {
      console.error(e);
      showError('Failed to start: ' + (e.message || e));
    }
  });

  cont?.addEventListener('click', () => {
    try {
      setStatus('Loading…');
      continueSave();
    } catch (e) {
      console.error(e);
      showError('Failed to continue: ' + (e.message || e));
    }
  });

  // Landing "Begin Reign" can link to game.html#begin — auto-click start
  if (location.hash === '#begin' || new URLSearchParams(location.search).has('start')) {
    begin?.click();
  }
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

// Mark scripts loaded for fallback message
window.__AETHERIA_READY__ = true;
wireStartScreen();

const audioToggle = document.getElementById('menu-audio');
if (audioToggle) {
  audioToggle.checked = isAudioEnabled();
  audioToggle.onchange = () => setAudioEnabled(audioToggle.checked);
}

window.__AETHERIA__ = {
  getState: () => stateRef.current,
  started: () => gameStarted,
  newGame: start,
  endTurn: () => {
    if (!stateRef.current) return;
    endTurn(stateRef.current);
    refreshAll(app);
  },
  foundFirstCity: () => {
    const settler = stateRef.current?.units.find((u) => u.type === 'settler');
    if (settler) {
      foundCity(stateRef.current, settler);
      refreshAll(app);
    }
  },
  moveUnit,
};
