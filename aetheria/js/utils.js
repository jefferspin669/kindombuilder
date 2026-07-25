export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const FIRST = [
  'Aldric', 'Elara', 'Mira', 'Kael', 'Soren', 'Lyra', 'Marcus', 'Tamsin',
  'Riven', 'Nora', 'Bram', 'Iskra', 'Oren', 'Vessa', 'Jori', 'Pella',
  'Cedric', 'Astrid', 'Rowan', 'Freya', 'Dorian', 'Selene',
];
const LAST = [
  'Ashford', 'Riverwatch', 'Stonehelm', 'Goldmere', 'Nightbloom', 'Ironvale',
  'Thornwick', 'Dawncrest', 'Frostbane', 'Seawick', 'Oakenshield', 'Redhollow',
];

export function personName(rand) {
  return `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
}

export function toast(msg, kind = 'info') {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
