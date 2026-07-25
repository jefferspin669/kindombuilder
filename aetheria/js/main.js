import {
  newCampaign, serialize, revive, foundCity, moveUnit, endTurn,
} from './game.js';
import { bindUI, refreshAll } from './ui.js';
import {
  ensureAdminAccount, getSession, signIn, signOut as authSignOut,
  changePassword, clearCampaignData, exportVault, importVault, DEFAULT_ADMIN,
} from './auth.js';
import { setAudioEnabled, isAudioEnabled, beep } from './audio.js';
import { toast } from './utils.js';

const canvas = document.getElementById('map');
const stateRef = { current: null };
let uiBound = false;

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
  updateChip();
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

function updateChip() {
  const chip = document.getElementById('account-chip');
  const s = getSession();
  if (chip && s) chip.textContent = `${s.username}${s.role === 'admin' ? ' · admin' : ''}`;
}

function showGame() {
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  fitCanvas();
  if (!uiBound) {
    bindUI(app);
    uiBound = true;
    window.addEventListener('resize', () => {
      fitCanvas();
      if (stateRef.current) refreshAll(app);
    });
  }
  if (!stateRef.current) {
    const existing = localStorage.getItem('aetheria_save');
    if (existing) {
      try {
        stateRef.current = revive(JSON.parse(existing));
      } catch {
        start();
      }
    } else start();
  }
  refreshAll(app);
  updateChip();
}

function showAuth(hint = '') {
  document.getElementById('auth-gate').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-hint').textContent = hint;
}

async function bootAuth() {
  let bootstrap;
  try {
    bootstrap = await ensureAdminAccount();
  } catch (err) {
    console.error(err);
    showAuth('Account vault error — try Export/Import or clear site data for this origin only if needed.');
    bootstrap = { created: false };
  }

  const userInput = document.getElementById('auth-username');
  if (userInput && !userInput.value) userInput.value = DEFAULT_ADMIN.username;

  // audio toggle on gate
  const audioToggle = document.getElementById('auth-audio');
  if (audioToggle) {
    audioToggle.checked = isAudioEnabled();
    audioToggle.onchange = () => setAudioEnabled(audioToggle.checked);
  }

  if (bootstrap.created) {
    showAuth(`First run: admin created → username "${DEFAULT_ADMIN.username}" / password "${DEFAULT_ADMIN.password}". Change it after login. This account is never wiped by New Campaign.`);
  } else {
    showAuth('Admin account is stored in a protected browser vault.');
  }

  if (getSession()) {
    showGame();
  }

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('auth-error');
    try {
      const result = await signIn(
        document.getElementById('auth-username').value,
        document.getElementById('auth-password').value,
        { remember: document.getElementById('auth-remember').checked },
      );
      if (!result.ok) {
        err.hidden = false;
        err.textContent = result.error;
        beep('bad');
        return;
      }
      err.hidden = true;
      beep('good');
      showGame();
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message || 'Sign-in failed.';
    }
  };

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
      await importVault(await file.text());
      showAuth('Vault imported. Sign in with your admin account.');
      toast('Vault imported', 'good');
    } catch (err) {
      toast(err.message || 'Import failed', 'bad');
    }
  };

  document.getElementById('btn-guest')?.addEventListener('click', async () => {
    // convenience: sign in as admin with default if still default, else prompt
    const result = await signIn('admin', 'admin', { remember: true });
    if (result.ok) showGame();
    else {
      document.getElementById('auth-error').hidden = false;
      document.getElementById('auth-error').textContent = 'Guest quick-start only works with default admin password.';
    }
  });
}

const app = {
  stateRef,
  canvas,
  newGame: () => start(),
  save: () => save('autosave'),
  load: () => load('autosave'),
  saveSlot: (n) => save(n),
  loadSlot: (n) => load(n),
  signOut() {
    authSignOut({ forgetRemembered: true });
    document.getElementById('menu-modal')?.classList.add('hidden');
    showAuth('Signed out. Admin account still saved in the vault.');
  },
  clearCampaign() {
    if (!confirm('Clear all campaign saves? Admin account will NOT be deleted.')) return;
    clearCampaignData();
    start();
    document.getElementById('menu-modal')?.classList.add('hidden');
    toast('Campaign data cleared. Admin kept.', 'good');
  },
  changePassword,
  getSession,
};

bootAuth();

window.__AETHERIA__ = {
  getState: () => stateRef.current,
  getSession,
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
  ensureAdminAccount,
  signIn,
  clearCampaignData,
};
