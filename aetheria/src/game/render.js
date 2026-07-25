import { TERRAIN } from './data.js';
import { tileAt } from './world.js';

const SEASON_TINT = {
  Spring: 'rgba(120, 200, 120, 0.08)',
  Summer: 'rgba(255, 220, 100, 0.08)',
  Autumn: 'rgba(210, 140, 60, 0.12)',
  Winter: 'rgba(200, 220, 255, 0.18)',
};

const CIV_COLORS = {
  verdant: '#4a8f4e',
  northern: '#8aa0b8',
  desert: '#c9a86c',
  island: '#2f9e8f',
  mountain: '#8a8a8a',
};

export function renderMap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { world } = state;
  const tw = canvas.width / world.width;
  const th = canvas.height / world.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Day/night
  const night = state.look.dayNight > 0.55;

  for (const t of world.tiles) {
    let color = TERRAIN[t.type]?.color || '#333';
    if (t.fog) {
      ctx.fillStyle = '#0a100c';
      ctx.fillRect(t.x * tw, t.y * th, tw + 0.5, th + 0.5);
      continue;
    }
    if (t.ash > 0) color = shade(color, -20 * t.ash);
    if (state.season === 'Winter' && ['grass', 'forest', 'hill'].includes(t.type)) {
      color = blend(color, '#dfe8ef', 0.35);
    }
    ctx.fillStyle = color;
    ctx.fillRect(t.x * tw, t.y * th, tw + 0.5, th + 0.5);

    if (t.river) {
      ctx.fillStyle = state.season === 'Winter' ? '#cfe3f2' : '#3d8aaa';
      ctx.fillRect(t.x * tw + tw * 0.35, t.y * th, tw * 0.3, th + 0.5);
    }
    if (t.road) {
      ctx.fillStyle = '#6b5a40';
      ctx.fillRect(t.x * tw + tw * 0.4, t.y * th + th * 0.4, tw * 0.2, th * 0.2);
    }
    if (t.bridge) {
      ctx.fillStyle = '#a08050';
      ctx.fillRect(t.x * tw + tw * 0.2, t.y * th + th * 0.4, tw * 0.6, th * 0.2);
    }
    // swaying forest hint
    if (t.type === 'forest' && state.look.seasonVisual) {
      ctx.fillStyle = 'rgba(20,80,30,0.25)';
      ctx.fillRect(t.x * tw + (state.turn % 3), t.y * th, tw * 0.3, th * 0.3);
    }
  }

  // Waves on coast
  for (const t of world.tiles) {
    if (t.fog || t.type !== 'coast') continue;
    ctx.fillStyle = `rgba(180,220,240,${0.15 + (state.turn % 3) * 0.05})`;
    ctx.fillRect(t.x * tw, t.y * th + th * 0.6, tw, th * 0.25);
  }

  // Deposits
  for (const d of world.deposits) {
    const t = tileAt(world.tiles, world.width, d.x, d.y);
    if (!t || t.fog || d.amount <= 0) continue;
    ctx.fillStyle = depositColor(d.type);
    ctx.beginPath();
    ctx.arc(d.x * tw + tw / 2, d.y * th + th / 2, Math.max(2, tw * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }

  // Sites
  for (const s of world.sites) {
    const t = tileAt(world.tiles, world.width, s.x, s.y);
    if (!t || t.fog) continue;
    if (!s.discovered) {
      // rumor only when near fog edge — skip mark
      continue;
    }
    ctx.fillStyle = s.delved ? '#777' : '#e2c15a';
    ctx.fillRect(s.x * tw + tw * 0.25, s.y * th + th * 0.25, tw * 0.5, th * 0.5);
    ctx.fillStyle = '#111';
    ctx.font = `${Math.max(8, tw * 0.45)}px sans-serif`;
    ctx.fillText(s.kind[0].toUpperCase(), s.x * tw + tw * 0.35, s.y * th + th * 0.65);
  }

  // Wildlife
  for (const w of world.wildlife) {
    const t = tileAt(world.tiles, world.width, w.x, w.y);
    if (!t || t.fog) continue;
    ctx.fillStyle = ({ wolves: '#999', deer: '#a67c52', bears: '#6b4a2a', birds: '#7eb0c9', fish: '#3d7a8c' })[w.species] || '#fff';
    ctx.fillRect(w.x * tw + tw * 0.3, w.y * th + th * 0.3, tw * 0.25, th * 0.25);
  }

  // Tracks
  for (const tr of state.tracks) {
    if (tr.life-- <= 0) continue;
    ctx.fillStyle = `rgba(80,60,40,${tr.life / 8})`;
    ctx.fillRect(tr.x * tw + tw * 0.45, tr.y * th + th * 0.45, tw * 0.1, th * 0.1);
  }
  state.tracks = state.tracks.filter((t) => t.life > 0);

  // Cities
  for (const city of state.cities) {
    drawCity(ctx, city, tw, th, state);
  }

  // Rival capitals if visible
  for (const r of state.rivals) {
    const t = tileAt(world.tiles, world.width, r.capital.x, r.capital.y);
    if (!t || t.fog) continue;
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(r.capital.x * tw + tw / 2, r.capital.y * th + th * 0.15);
    ctx.lineTo(r.capital.x * tw + tw * 0.85, r.capital.y * th + th / 2);
    ctx.lineTo(r.capital.x * tw + tw / 2, r.capital.y * th + th * 0.85);
    ctx.lineTo(r.capital.x * tw + tw * 0.15, r.capital.y * th + th / 2);
    ctx.closePath();
    ctx.fill();
  }

  // Raiders
  for (const r of state.raiders.filter((x) => x.alive)) {
    const t = tileAt(world.tiles, world.width, r.x, r.y);
    if (!t || t.fog) continue;
    ctx.fillStyle = '#d06a5c';
    ctx.fillRect(r.x * tw + tw * 0.2, r.y * th + th * 0.2, tw * 0.6, th * 0.6);
  }

  // Units
  for (const u of state.units) {
    const t = tileAt(world.tiles, world.width, u.x, u.y);
    if (!t) continue;
    const selected = u.id === state.selectedUnitId;
    ctx.fillStyle = selected ? '#fff' : '#f2e6c9';
    ctx.beginPath();
    ctx.arc(u.x * tw + tw / 2, u.y * th + th / 2, Math.max(3, tw * 0.28), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c3a2a';
    ctx.font = `bold ${Math.max(8, tw * 0.4)}px sans-serif`;
    ctx.fillText(unitGlyph(u.type), u.x * tw + tw * 0.32, u.y * th + th * 0.68);
  }

  // Myth bosses
  if (state.player.fantasy) {
    for (const b of state.myth.bosses.filter((x) => x.hp > 0)) {
      const t = tileAt(world.tiles, world.width, b.x, b.y);
      if (!t || t.fog) continue;
      ctx.fillStyle = '#9b3dff';
      ctx.fillRect(b.x * tw, b.y * th, tw, th);
    }
  }

  // Trade routes glow at continent zoom
  if (state.zoom === 'continent') {
    for (const route of state.economy.routes.filter((r) => r.active)) {
      if (!route.from || !route.to) continue;
      ctx.strokeStyle = 'rgba(226, 193, 90, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(route.from.x * tw + tw / 2, route.from.y * th + th / 2);
      ctx.lineTo(route.to.x * tw + tw / 2, route.to.y * th + th / 2);
      ctx.stroke();
    }
  }

  // Birds
  if (state.look.birds && state.zoom !== 'street') {
    ctx.fillStyle = 'rgba(30,30,30,0.45)';
    for (let i = 0; i < 5; i++) {
      const bx = ((state.turn * 13 + i * 90) % canvas.width);
      const by = 20 + (i * 37) % 80;
      ctx.fillRect(bx, by, 3, 2);
    }
  }

  // Season overlay
  ctx.fillStyle = SEASON_TINT[state.season] || 'transparent';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Night torchlight on cities
  if (night) {
    ctx.fillStyle = 'rgba(5,10,15,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const city of state.cities) {
      const g = ctx.createRadialGradient(
        city.x * tw + tw / 2, city.y * th + th / 2, 0,
        city.x * tw + tw / 2, city.y * th + th / 2, tw * 3,
      );
      g.addColorStop(0, 'rgba(255,180,80,0.35)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(city.x * tw + tw / 2, city.y * th + th / 2, tw * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Street zoom citizens
  if (state.zoom === 'street' && state.selectedCityId) {
    const city = state.cities.find((c) => c.id === state.selectedCityId);
    if (city) {
      const folks = state.citizens.filter((c) => c.cityId === city.id).slice(0, 20);
      folks.forEach((c, i) => {
        const px = city.x * tw + ((i * 17 + state.turn * 3) % (tw * 4)) - tw;
        const py = city.y * th + ((i * 11) % (th * 3)) - th;
        ctx.fillStyle = '#f5e6c8';
        ctx.fillRect(px, py, 2, 3);
      });
    }
  }
}

function drawCity(ctx, city, tw, th, state) {
  const look = CIV_COLORS[state.player.civLook] || '#c9783a';
  const stageSize = { village: 0.5, town: 0.65, city: 0.8, capital: 1 }[city.stage] || 0.5;
  const cx = city.x * tw;
  const cy = city.y * th;
  ctx.fillStyle = look;
  ctx.fillRect(cx + tw * (0.5 - stageSize / 2), cy + th * (0.5 - stageSize / 2), tw * stageSize, th * stageSize);
  // chimney smoke
  ctx.fillStyle = 'rgba(180,180,180,0.4)';
  ctx.fillRect(cx + tw * 0.6, cy + th * 0.1 - (state.turn % 4), 2, 4);
  if (city.buildings.includes('walls')) {
    ctx.strokeStyle = '#555';
    ctx.strokeRect(cx + tw * 0.1, cy + th * 0.1, tw * 0.8, th * 0.8);
  }
  if (city.stage === 'capital') {
    ctx.fillStyle = '#f2e6c9';
    ctx.fillRect(cx + tw * 0.4, cy + th * 0.15, tw * 0.2, th * 0.35);
  }
}

function unitGlyph(type) {
  return ({ scout: 'S', worker: 'W', settler: 'Z', warrior: 'A', explorer: 'E', galley: 'G', balloon: 'B', mercenary: 'M' })[type] || '?';
}

function depositColor(type) {
  return ({ food: '#a3d977', wood: '#6b4a2a', stone: '#aaa', gold: '#e2c15a', iron: '#889', coal: '#333' })[type] || '#fff';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clampCol((n >> 16) + amt);
  const g = clampCol(((n >> 8) & 0xff) + amt);
  const b = clampCol((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function blend(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16) * (1 - t) + (pb >> 16) * t);
  const g = Math.round(((pa >> 8) & 0xff) * (1 - t) + ((pb >> 8) & 0xff) * t);
  const bl = Math.round((pa & 0xff) * (1 - t) + (pb & 0xff) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function clampCol(n) {
  return Math.max(0, Math.min(255, n));
}
