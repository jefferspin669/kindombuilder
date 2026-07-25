/**
 * Persistent account vault.
 * Stored separately from campaign saves so New Game / clear save never deletes it.
 */

const VAULT_KEY = 'aetheria_vault';
const SESSION_KEY = 'aetheria_session';

const DEFAULT_ADMIN = {
  username: 'admin',
  // Default password for first-run prototype: admin
  // Users should change it after first sign-in.
  password: 'admin',
};

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return { accounts: [], createdAt: null, version: 1 };
    return JSON.parse(raw);
  } catch {
    return { accounts: [], createdAt: null, version: 1 };
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
  const session = {
    username: account.username,
    role: account.role,
    signedInAt: Date.now(),
  };
  const payload = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, payload);
  if (remember) localStorage.setItem(SESSION_KEY, payload);
  else localStorage.removeItem(SESSION_KEY);
}

export function signOut({ forgetRemembered = false } = {}) {
  sessionStorage.removeItem(SESSION_KEY);
  if (forgetRemembered) localStorage.removeItem(SESSION_KEY);
}

export function listAccounts() {
  return loadVault().accounts.map(({ username, role, createdAt, lastSignIn }) => ({
    username, role, createdAt, lastSignIn,
  }));
}

export async function ensureAdminAccount() {
  const vault = loadVault();
  const existing = vault.accounts.find((a) => a.role === 'admin' || a.username === DEFAULT_ADMIN.username);
  if (existing) return { created: false, username: existing.username };

  const passwordHash = await sha256(DEFAULT_ADMIN.password);
  const admin = {
    id: 'acct_admin',
    username: DEFAULT_ADMIN.username,
    passwordHash,
    role: 'admin',
    createdAt: Date.now(),
    lastSignIn: null,
    protected: true, // cannot be wiped by game reset
  };
  vault.accounts.push(admin);
  vault.createdAt = vault.createdAt || Date.now();
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

  const hash = await sha256(String(password || ''));
  if (hash !== account.passwordHash) return { ok: false, error: 'Wrong password.' };

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

  const currentHash = await sha256(String(currentPassword || ''));
  if (currentHash !== account.passwordHash) return { ok: false, error: 'Current password is wrong.' };
  if (!newPassword || String(newPassword).length < 4) {
    return { ok: false, error: 'New password must be at least 4 characters.' };
  }

  account.passwordHash = await sha256(String(newPassword));
  saveVault(vault);
  return { ok: true };
}

export async function createAccount(username, password, { role = 'player' } = {}) {
  await ensureAdminAccount();
  const name = String(username || '').trim();
  if (name.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if (!password || String(password).length < 4) {
    return { ok: false, error: 'Password must be at least 4 characters.' };
  }

  const vault = loadVault();
  if (vault.accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'That username already exists.' };
  }

  const account = {
    id: `acct_${Date.now().toString(36)}`,
    username: name,
    passwordHash: await sha256(String(password)),
    role,
    createdAt: Date.now(),
    lastSignIn: null,
    protected: role === 'admin',
  };
  vault.accounts.push(account);
  saveVault(vault);
  return { ok: true, account: { username: account.username, role: account.role } };
}

/** Wipe campaign data only — never touches the account vault. */
export function clearCampaignData() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('aetheria_') && k !== VAULT_KEY && k !== SESSION_KEY) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys;
}

/** Export vault backup (accounts only). */
export function exportVault() {
  return JSON.stringify(loadVault(), null, 2);
}

/** Import vault backup; merges protected admin if missing. */
export async function importVault(json) {
  const incoming = typeof json === 'string' ? JSON.parse(json) : json;
  if (!incoming || !Array.isArray(incoming.accounts)) {
    throw new Error('Invalid vault file.');
  }
  saveVault({
    accounts: incoming.accounts,
    createdAt: incoming.createdAt || Date.now(),
    version: 1,
  });
  await ensureAdminAccount();
  return listAccounts();
}

export function isAdmin(session = getSession()) {
  return session?.role === 'admin';
}

export { VAULT_KEY, SESSION_KEY, DEFAULT_ADMIN };
