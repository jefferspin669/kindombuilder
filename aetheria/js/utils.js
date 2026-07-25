export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
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
];
const LAST = [
  'Ashford', 'Riverwatch', 'Stonehelm', 'Goldmere', 'Nightbloom', 'Ironvale',
  'Thornwick', 'Dawncrest', 'Frostbane', 'Seawick', 'Oakenshield', 'Redhollow',
];

export function personName(rand) {
  return `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
}

export function houseName(rand) {
  return `House ${pick(rand, LAST)}`;
}

export function log(state, msg, category = 'general') {
  state.log.unshift({ turn: state.turn, year: state.year, msg, category });
  if (state.log.length > 200) state.log.length = 200;
  chronicle(state, msg, category);
}

export function chronicle(state, text, category = 'general') {
  const year = state.calendarYear ?? state.year;
  state.chronicle.push({ year, turn: state.turn, text, category });
  if (state.chronicle.length > 2000) state.chronicle.splice(0, 200);
}
