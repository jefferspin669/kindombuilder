/**
 * Persistent admin vault — never wiped by campaign saves.
 * Uses SHA-256 when available, falls back to a local hash otherwise.
 */

const VAULT_KEY = 'aetheria_vault';
const SESSION_KEY = 'aetheria_session';
export const DEFAULT_ADMIN = { username: 'admin', password: 'admin' };

async function hashPassword(text) {
  const value = String(text || '');
  if (globalThis.crypto?.subtle) {
    try {
      const data = new TextEncoder().encode(`aetheria:${value}`);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return `sha256:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    } catch {
      // fall through
    }
  }
  // Fallback for non-secure contexts
  let h = 2166136261;
  const s = `aetheria:${value}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv:${(h >>> 0).toString(16)}`;
}

function loadVault() {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY)) || { accounts: [], version: 1 };
  } catch {
    return { accounts: [], version: 1 };
  }
}

function saveVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(account, remember) {
  const session = { username: account.username, role: account.role, signedInAt: Date.now() };
  const payload = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, payload);
  if (remember) localStorage.setItem(SESSION_KEY, payload);
  else localStorage.removeItem(SESSION_KEY);
}

export function signOut({ forgetRemembered = true } = {}) {
  sessionStorage.removeItem(SESSION_KEY);
  if (forgetRemembered) localStorage.removeItem(SESSION_KEY);
}

export async function ensureAdminAccount() {
  const vault = loadVault();
  let admin = vault.accounts.find((a) => a.role === 'admin');
  if (admin) return { created: false, username: admin.username };

  admin = {
    id: 'acct_admin',
    username: DEFAULT_ADMIN.username,
    passwordHash: await hashPassword(DEFAULT_ADMIN.password),
    role: 'admin',
    createdAt: Date.now(),
    lastSignIn: null,
    protected: true,
  };
  vault.accounts.push(admin);
  vault.createdAt = Date.now();
  saveVault(vault);
  return { created: true, username: admin.username, defaultPassword: DEFAULT_ADMIN.password };
}

export async function signIn(username, password, { remember = true } = {}) {
  await ensureAdminAccount();
  const vault = loadVault();
  const account = vault.accounts.find(
    (a) => a.username.toLowerCase() === String(username || '').trim().toLowerCase(),
  );
  if (!account) return { ok: false, error: 'Unknown account.' };
  const hash = await hashPassword(password);
  // Accept either algorithm if user upgraded contexts
  if (account.passwordHash !== hash) {
    // migrate: if default admin still on old broken state, allow default once
    if (account.username === 'admin' && password === DEFAULT_ADMIN.password && !account.passwordChanged) {
      account.passwordHash = hash;
    } else {
      return { ok: false, error: 'Wrong password.' };
    }
  }
  account.lastSignIn = Date.now();
  saveVault(vault);
  setSession(account, remember);
  return { ok: true, account: { username: account.username, role: account.role } };
}

export async function changePassword(username, currentPassword, newPassword) {
  const vault = loadVault();
  const account = vault.accounts.find(
    (a) => a.username.toLowerCase() === String(username || '').trim().toLowerCase(),
  );
  if (!account) return { ok: false, error: 'Unknown account.' };
  if ((await hashPassword(currentPassword)) !== account.passwordHash) {
    return { ok: false, error: 'Current password is wrong.' };
  }
  if (!newPassword || String(newPassword).length < 4) {
    return { ok: false, error: 'Use at least 4 characters.' };
  }
  account.passwordHash = await hashPassword(newPassword);
  account.passwordChanged = true;
  saveVault(vault);
  return { ok: true };
}

export function clearCampaignData() {
  const keep = new Set([VAULT_KEY, SESSION_KEY]);
  const removed = [];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith('aetheria_') && !keep.has(k)) {
      localStorage.removeItem(k);
      removed.push(k);
    }
  }
  return removed;
}

export function exportVault() {
  return JSON.stringify(loadVault(), null, 2);
}

export async function importVault(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data?.accounts) throw new Error('Invalid vault file.');
  saveVault({ accounts: data.accounts, createdAt: data.createdAt || Date.now(), version: 1 });
  await ensureAdminAccount();
}

export function listAccounts() {
  return loadVault().accounts.map(({ username, role, createdAt, lastSignIn }) => ({
    username, role, createdAt, lastSignIn,
  }));
}

export { VAULT_KEY, SESSION_KEY };
