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

const app = {
  stateRef,
  canvas,
  newGame: () => startGame(),
  save: () => saveGame('autosave'),
  load: () => loadGame('autosave'),
  saveSlot: (n) => saveGame(n),
  loadSlot: (n) => loadGame(n),
  clearSaves,
};

function fitCanvas() {
  const wrap = document.querySelector('.map-stage');
  if (!wrap || !canvas) return;
  const w = Math.min(1100, Math.max(320, wrap.clientWidth - 8));
  const h = Math.min(720, Math.max(360, window.innerHeight - 220));
  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
}

function showError(msg) {
  const err = document.getElementById('start-error');
  if (!err) {
    console.error(msg);
    alert(msg);
    return;
  }
  err.hidden = false;
  err.classList.remove('hidden');
  err.textContent = String(msg);
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
    if (!data || data.version !== SAVE_VERSION || !data.world || !data.player?.res) return null;
    return data;
  } catch {
    return null;
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

function startGame(opts = {}) {
  try {
    fitCanvas();
    stateRef.current = newCampaign({
      seed: opts.seed,
      width: 80,
      height: 56,
      kingdomName: opts.kingdomName || 'Kingdom of Aralon',
    });
    enterGame();
    refreshAll(app);
    toast('Reign begins — move Scout, then Found City (F).', 'good');
    beep('good');
    return true;
  } catch (e) {
    console.error(e);
    showError('Failed to start: ' + (e && e.message ? e.message : e));
    return false;
  }
}

function continueSave() {
  const data = readSave();
  if (!data) {
    showError('No save found. Click Begin Reign.');
    return false;
  }
  stateRef.current = revive(data);
  fitCanvas();
  enterGame();
  refreshAll(app);
  toast('Save loaded.', 'good');
  beep('good');
  return true;
}

function saveGame(slot = 'autosave') {
  if (!stateRef.current) return;
  const key = slot === 'autosave' ? SAVE_KEY : `aetheria_slot_${slot}`;
  localStorage.setItem(key, JSON.stringify(serialize(stateRef.current)));
  toast(`Saved (${slot})`, 'good');
  beep('good');
}

function loadGame(slot = 'autosave') {
  const key = slot === 'autosave' ? SAVE_KEY : `aetheria_slot_${slot}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    toast('No save in that slot.', 'warn');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      toast('Old save format — start a new campaign.', 'warn');
      return;
    }
    stateRef.current = revive(data);
    if (!gameStarted) enterGame();
    fitCanvas();
    refreshAll(app);
    toast(`Loaded (${slot})`, 'good');
  } catch (e) {
    console.error(e);
    toast('Save corrupt.', 'bad');
  }
}

function clearSaves() {
  if (!confirm('Clear all local saves?')) return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k === SAVE_KEY || k.startsWith('aetheria_slot_'))) localStorage.removeItem(k);
  }
  document.getElementById('menu-modal')?.classList.add('hidden');
  document.getElementById('btn-continue')?.classList.add('hidden');
  toast('Saves cleared.', 'good');
}

function wireStartScreen() {
  const begin = document.getElementById('btn-begin');
  const cont = document.getElementById('btn-continue');

  if (!begin) {
    // No start screen — boot immediately
    startGame();
    return;
  }

  if (readSave() && cont) {
    cont.classList.remove('hidden');
    setStatus('Save found — Continue, or Begin Reign for a new game.');
  } else {
    setStatus('Click Begin Reign to play.');
  }

  begin.addEventListener('click', () => {
    try {
      setStatus('Starting…');
      startGame();
    } catch (e) {
      console.error(e);
      showError('Failed to start: ' + (e && e.message ? e.message : e));
    }
  });

  cont?.addEventListener('click', () => {
    try {
      setStatus('Loading…');
      continueSave();
    } catch (e) {
      console.error(e);
      showError('Failed to load save. Click Begin Reign instead.');
    }
  });

  const params = new URLSearchParams(location.search);
  if (location.hash === '#begin' || params.has('start') || params.get('autostart') === '1') {
    begin.click();
  }
}

window.__AETHERIA_READY__ = true;

try {
  wireStartScreen();
  const audioToggle = document.getElementById('menu-audio');
  if (audioToggle) {
    audioToggle.checked = isAudioEnabled();
    audioToggle.onchange = () => setAudioEnabled(audioToggle.checked);
  }
} catch (e) {
  console.error(e);
  showError('Boot error: ' + (e && e.message ? e.message : e));
}

window.__AETHERIA__ = {
  getState: () => stateRef.current,
  started: () => gameStarted,
  newGame: startGame,
  startGame,
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
