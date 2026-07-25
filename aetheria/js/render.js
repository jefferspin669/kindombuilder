import { TERRAIN, UNITS } from './data.js';
import { tileAt } from './world.js';

const SEASON_TINT = {
  Spring: 'rgba(120,200,120,0.10)',
  Summer: 'rgba(255,220,100,0.10)',
  Autumn: 'rgba(210,140,60,0.14)',
  Winter: 'rgba(200,220,255,0.20)',
};

export function renderMap(canvas, state) {
  if (!canvas || !state) return;
  const ctx = canvas.getContext('2d');
  const { world, camera } = state;
  const tile = Math.max(8, Math.floor(18 * (camera.zoom || 1)));
  const viewW = Math.ceil(canvas.width / tile) + 2;
  const viewH = Math.ceil(canvas.height / tile) + 2;
  const originX = clamp(Math.floor(camera.x - viewW / 2), 0, Math.max(0, world.width - viewW));
  const originY = clamp(Math.floor(camera.y - viewH / 2), 0, Math.max(0, world.height - viewH));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a1210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = originY; y < Math.min(world.height, originY + viewH); y++) {
    for (let x = originX; x < Math.min(world.width, originX + viewW); x++) {
      const t = tileAt(world.tiles, world.width, x, y);
      if (!t) continue;
      const px = (x - originX) * tile;
      const py = (y - originY) * tile;
      if (t.fog) {
        ctx.fillStyle = t.explored ? '#152019' : '#0b100e';
        ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
        continue;
      }
      ctx.fillStyle = TERRAIN[t.type]?.color || '#333';
      ctx.fillRect(px, py, tile + 0.5, tile + 0.5);

      if (t.river) {
        ctx.fillStyle = state.season === 'Winter' ? '#cfe3f2' : '#3f8fad';
        ctx.fillRect(px + tile * 0.4, py, tile * 0.2, tile + 0.5);
      }
      if (t.road) {
        ctx.fillStyle = '#6d5a3f';
        ctx.fillRect(px + tile * 0.35, py + tile * 0.35, tile * 0.3, tile * 0.3);
      }
      if (t.type === 'forest') {
        ctx.fillStyle = 'rgba(15,70,30,0.35)';
        ctx.fillRect(px + (state.turn % 3), py + 2, tile * 0.35, tile * 0.35);
      }
      if (t.type === 'coast') {
        ctx.fillStyle = `rgba(180,220,240,${0.12 + (state.turn % 3) * 0.05})`;
        ctx.fillRect(px, py + tile * 0.65, tile, tile * 0.2);
      }
    }
  }

  // deposits
  for (const d of world.deposits) {
    if (d.amount <= 0) continue;
    if (d.x < originX || d.y < originY || d.x >= originX + viewW || d.y >= originY + viewH) continue;
    const t = tileAt(world.tiles, world.width, d.x, d.y);
    if (!t || t.fog) continue;
    const px = (d.x - originX) * tile + tile / 2;
    const py = (d.y - originY) * tile + tile / 2;
    ctx.fillStyle = depositColor(d.type);
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, tile * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }

  // sites
  for (const s of world.sites) {
    if (!s.discovered) continue;
    if (s.x < originX || s.y < originY || s.x >= originX + viewW || s.y >= originY + viewH) continue;
    const t = tileAt(world.tiles, world.width, s.x, s.y);
    if (!t || t.fog) continue;
    const px = (s.x - originX) * tile;
    const py = (s.y - originY) * tile;
    ctx.fillStyle = s.delved ? '#777' : '#e2c15a';
    ctx.fillRect(px + tile * 0.2, py + tile * 0.2, tile * 0.6, tile * 0.6);
  }

  // cities
  for (const city of state.cities) {
    if (city.x < originX || city.y < originY || city.x >= originX + viewW || city.y >= originY + viewH) continue;
    const px = (city.x - originX) * tile;
    const py = (city.y - originY) * tile;
    const scale = { village: 0.55, town: 0.7, city: 0.85, capital: 1 }[city.stage] || 0.55;
    ctx.fillStyle = state.player.color;
    ctx.fillRect(px + tile * (0.5 - scale / 2), py + tile * (0.5 - scale / 2), tile * scale, tile * scale);
    if (city.buildings.includes('walls')) {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, tile - 4, tile - 4);
    }
    // smoke
    ctx.fillStyle = 'rgba(200,200,200,0.45)';
    ctx.fillRect(px + tile * 0.65, py + tile * 0.1 - (state.turn % 4), 2, 5);
  }

  // rivals
  for (const r of state.rivals) {
    if (r.collapsed) continue;
    const t = tileAt(world.tiles, world.width, r.capital.x, r.capital.y);
    if (!t || t.fog) continue;
    if (r.capital.x < originX || r.capital.y < originY) continue;
    const px = (r.capital.x - originX) * tile + tile / 2;
    const py = (r.capital.y - originY) * tile + tile / 2;
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(px, py - tile * 0.35);
    ctx.lineTo(px + tile * 0.35, py);
    ctx.lineTo(px, py + tile * 0.35);
    ctx.lineTo(px - tile * 0.35, py);
    ctx.closePath();
    ctx.fill();
  }

  // raiders
  for (const r of state.raiders.filter((x) => x.alive)) {
    const t = tileAt(world.tiles, world.width, r.x, r.y);
    if (!t || t.fog) continue;
    if (r.x < originX || r.y < originY || r.x >= originX + viewW || r.y >= originY + viewH) continue;
    const px = (r.x - originX) * tile;
    const py = (r.y - originY) * tile;
    ctx.fillStyle = '#d06055';
    ctx.fillRect(px + tile * 0.2, py + tile * 0.2, tile * 0.6, tile * 0.6);
  }

  // units
  for (const u of state.units) {
    if (u.x < originX || u.y < originY || u.x >= originX + viewW || u.y >= originY + viewH) continue;
    const px = (u.x - originX) * tile + tile / 2;
    const py = (u.y - originY) * tile + tile / 2;
    const selected = u.id === state.selectedUnitId;
    ctx.fillStyle = selected ? '#fff' : '#f2e6c9';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, tile * 0.28), 0, Math.PI * 2);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#c9783a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#1c3a2a';
    ctx.font = `bold ${Math.max(10, tile * 0.45)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(UNITS[u.type]?.glyph || '?', px, py + 1);
  }

  // season wash
  ctx.fillStyle = SEASON_TINT[state.season] || 'transparent';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // birds
  ctx.fillStyle = 'rgba(20,20,20,0.4)';
  for (let i = 0; i < 6; i++) {
    const bx = ((state.turn * 17 + i * 110) % canvas.width);
    const by = 16 + (i * 41) % 90;
    ctx.fillRect(bx, by, 3, 2);
  }

  state._view = { originX, originY, tile };
}

export function renderMinimap(canvas, state) {
  if (!canvas || !state) return;
  const ctx = canvas.getContext('2d');
  const { world } = state;
  const tw = canvas.width / world.width;
  const th = canvas.height / world.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const t of world.tiles) {
    if (t.fog && !t.explored) {
      ctx.fillStyle = '#0b100e';
    } else if (t.fog) {
      ctx.fillStyle = '#18241c';
    } else {
      ctx.fillStyle = TERRAIN[t.type]?.color || '#333';
    }
    ctx.fillRect(t.x * tw, t.y * th, tw + 0.5, th + 0.5);
  }
  for (const c of state.cities) {
    ctx.fillStyle = '#f2e6c9';
    ctx.fillRect(c.x * tw, c.y * th, Math.max(2, tw * 2), Math.max(2, th * 2));
  }
  // camera box
  if (state._view) {
    const { originX, originY, tile } = state._view;
    const main = document.getElementById('map');
    const vw = (main.width / tile);
    const vh = (main.height / tile);
    ctx.strokeStyle = '#c9783a';
    ctx.strokeRect(originX * tw, originY * th, vw * tw, vh * th);
  }
}

export function screenToTile(canvas, state, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;
  const v = state._view;
  if (!v) return null;
  return {
    x: v.originX + Math.floor(mx / v.tile),
    y: v.originY + Math.floor(my / v.tile),
  };
}

function depositColor(type) {
  return ({ food: '#a3d977', wood: '#6b4a2a', stone: '#bbb', gold: '#e2c15a', iron: '#8a93a0' })[type] || '#fff';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
