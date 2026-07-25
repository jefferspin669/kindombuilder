/** Tiny WebAudio beeps — no asset files needed. */

let ctx;
let enabled = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function setAudioEnabled(on) {
  enabled = !!on;
  localStorage.setItem('aetheria_audio', enabled ? '1' : '0');
}

export function isAudioEnabled() {
  const v = localStorage.getItem('aetheria_audio');
  if (v === null) return true;
  return v === '1';
}

enabled = isAudioEnabled();

export function beep(kind = 'ui') {
  if (!enabled) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    const map = {
      ui: [440, 0.05, 'square'],
      good: [660, 0.08, 'sine'],
      bad: [180, 0.12, 'sawtooth'],
      turn: [520, 0.06, 'triangle'],
      build: [380, 0.07, 'square'],
    };
    const [freq, dur, type] = map[kind] || map.ui;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.start(now);
    o.stop(now + dur);
  } catch {
    // ignore
  }
}
