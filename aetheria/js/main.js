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

  beep('good');
}

function continueSave() {
  const data = readSave();
  if (!data) {
    showError('No compatible save found. Click Begin Reign to start fresh.');
    return;
  }

  document.getElementById('menu-modal')?.classList.add('hidden');
  document.getElementById('btn-continue')?.classList.add('hidden');
  toast('Saves cleared.', 'good');
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
