import { TERRAIN, UNITS } from './data.js';
import { tileAt } from './world.js';

const SEASON_TINT = {
  Spring: 'rgba(120,200,120,0.08)',
  Summer: 'rgba(255,220,100,0.08)',
  Autumn: 'rgba(210,140,60,0.12)',
  Winter: 'rgba(200,220,255,0.16)',
};

export function renderMap(canvas, state) {
  if (!canvas || !state) return;
  const ctx = canvas.getContext('2d');
  const { world, camera } = state;
  const tile = Math.max(16, Math.floor(38 * (camera.zoom || 2)));
  const viewW = Math.ceil(canvas.width / tile) + 2;
  const viewH = Math.ceil(canvas.height / tile) + 2;
  const originX = clamp(Math.floor(camera.x - viewW / 2), 0, Math.max(0, world.width - viewW));
  const originY = clamp(Math.floor(camera.y - viewH / 2), 0, Math.max(0, world.height - viewH));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a1210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // subtle base grain so empty/fog areas aren't a flat void
  drawTerrainGrain(ctx, canvas.width, canvas.height);

  for (let y = originY; y < Math.min(world.height, originY + viewH); y++) {
    for (let x = originX; x < Math.min(world.width, originX + viewW); x++) {
      const t = tileAt(world.tiles, world.width, x, y);
      if (!t) continue;
      const px = (x - originX) * tile;
      const py = (y - originY) * tile;
      if (t.fog) {
        paintFogTile(ctx, px, py, tile, t.explored, x, y);
        continue;
      }
      paintTerrain(ctx, t, px, py, tile, x, y, state);

      if (t.river) {
        ctx.fillStyle = state.season === 'Winter' ? '#cfe3f2' : '#4aa3c4';
        ctx.fillRect(px + tile * 0.38, py, tile * 0.24, tile + 0.5);
      }
      if (t.road) {
        ctx.fillStyle = '#8a7350';
        ctx.fillRect(px + tile * 0.32, py + tile * 0.32, tile * 0.36, tile * 0.36);
      }
    }
  }

  // soft grid over visible land for readability
  drawVisibleGrid(ctx, world, originX, originY, viewW, viewH, tile);

  // deposits
  for (const d of world.deposits) {
    if (d.amount <= 0) continue;
    if (d.x < originX || d.y < originY || d.x >= originX + viewW || d.y >= originY + viewH) continue;
    const t = tileAt(world.tiles, world.width, d.x, d.y);
    if (!t || t.fog) continue;
    const px = (d.x - originX) * tile + tile / 2;
    const py = (d.y - originY) * tile + tile / 2;
    const r = Math.max(3, tile * 0.2);
    ctx.fillStyle = '#0b120e';
    ctx.beginPath();
    ctx.arc(px, py + 1, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = depositColor(d.type);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // sites
  for (const s of world.sites) {
    if (!s.discovered) continue;
    if (s.x < originX || s.y < originY || s.x >= originX + viewW || s.y >= originY + viewH) continue;
    const t = tileAt(world.tiles, world.width, s.x, s.y);
    if (!t || t.fog) continue;
    const px = (s.x - originX) * tile;
    const py = (s.y - originY) * tile;
    ctx.fillStyle = s.delved ? '#6a6a6a' : '#e2c15a';
    ctx.strokeStyle = s.delved ? '#444' : '#fff1b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + tile * 0.5, py + tile * 0.18);
    ctx.lineTo(px + tile * 0.82, py + tile * 0.82);
    ctx.lineTo(px + tile * 0.18, py + tile * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // cities
  for (const city of state.cities) {
    if (city.x < originX || city.y < originY || city.x >= originX + viewW || city.y >= originY + viewH) continue;
    const px = (city.x - originX) * tile;
    const py = (city.y - originY) * tile;
    const scale = { village: 0.55, town: 0.7, city: 0.85, capital: 1 }[city.stage] || 0.55;
    const size = tile * scale;
    const ox = px + (tile - size) / 2;
    const oy = py + (tile - size) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox + 2, oy + 2, size, size);
    ctx.fillStyle = state.player.color;
    ctx.fillRect(ox, oy, size, size);
    ctx.strokeStyle = '#f2e6c9';
    ctx.lineWidth = Math.max(1.5, tile * 0.06);
    ctx.strokeRect(ox + 0.5, oy + 0.5, size - 1, size - 1);
    if (city.buildings.includes('walls')) {
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 2, oy - 2, size + 4, size + 4);
    }
    ctx.fillStyle = 'rgba(220,220,220,0.5)';
    ctx.fillRect(ox + size * 0.7, oy - (state.turn % 4), Math.max(2, tile * 0.08), Math.max(4, tile * 0.18));
  }

  // rivals
  for (const r of state.rivals) {
    if (r.collapsed) continue;
    const t = tileAt(world.tiles, world.width, r.capital.x, r.capital.y);
    if (!t || t.fog) continue;
    if (r.capital.x < originX || r.capital.y < originY) continue;
    if (r.capital.x >= originX + viewW || r.capital.y >= originY + viewH) continue;
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
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
    ctx.strokeStyle = '#ffd0c8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + tile * 0.2, py + tile * 0.2, tile * 0.6, tile * 0.6);
  }

  // units
  for (const u of state.units) {
    if (u.x < originX || u.y < originY || u.x >= originX + viewW || u.y >= originY + viewH) continue;
    const px = (u.x - originX) * tile + tile / 2;
    const py = (u.y - originY) * tile + tile / 2;
    const selected = u.id === state.selectedUnitId;
    const radius = Math.max(5, tile * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(px + 1, py + 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = selected ? '#ffffff' : '#f2e6c9';
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#c9a05a';
      ctx.lineWidth = Math.max(2.5, tile * 0.1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(122,168,196,0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        (u.x - originX) * tile + 1.5,
        (u.y - originY) * tile + 1.5,
        tile - 3,
        tile - 3,
      );
    } else {
      ctx.strokeStyle = 'rgba(30,50,40,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#1c3a2a';
    ctx.font = `bold ${Math.max(11, tile * 0.42)}px Figtree, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(UNITS[u.type]?.glyph || '?', px, py + 1);
  }

  // selected tile outline (when no unit ring already draws it)
  if (state.selectedTile) {
    const { x, y } = state.selectedTile;
    if (x >= originX && y >= originY && x < originX + viewW && y < originY + viewH) {
      const px = (x - originX) * tile;
      const py = (y - originY) * tile;
      ctx.strokeStyle = 'rgba(122,168,196,0.95)';
      ctx.lineWidth = Math.max(2, tile * 0.08);
      ctx.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3);
      ctx.strokeStyle = 'rgba(201,160,90,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, tile - 7, tile - 7);
    }
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

function paintFogTile(ctx, px, py, tile, explored, x, y) {
  if (explored) {
    ctx.fillStyle = '#1c2a22';
    ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
    ctx.fillStyle = ((x + y) % 2 === 0) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
    ctx.strokeStyle = 'rgba(140,160,145,0.08)';
    ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
    return;
  }
  ctx.fillStyle = '#101612';
  ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.beginPath();
  ctx.moveTo(px + 2, py + tile - 2);
  ctx.lineTo(px + tile - 2, py + 2);
  ctx.stroke();
}

function paintTerrain(ctx, t, px, py, tile, x, y, state) {
  const def = TERRAIN[t.type] || { color: '#333' };
  ctx.fillStyle = def.color;
  ctx.fillRect(px, py, tile + 0.5, tile + 0.5);

  // checker / noise variation
  const shade = ((x * 17 + y * 31) % 5) * 0.015;
  ctx.fillStyle = `rgba(0,0,0,${0.04 + shade})`;
  ctx.fillRect(px, py, tile + 0.5, tile + 0.5);

  if (t.type === 'grass') {
    ctx.fillStyle = 'rgba(180,230,140,0.18)';
    for (let i = 0; i < 3; i++) {
      const gx = px + ((x * 3 + i * 7) % Math.max(2, tile - 4)) + 2;
      const gy = py + ((y * 5 + i * 11) % Math.max(2, tile - 4)) + 2;
      ctx.fillRect(gx, gy, Math.max(1, tile * 0.08), Math.max(2, tile * 0.16));
    }
  }
  if (t.type === 'forest' || t.type === 'jungle') {
    ctx.fillStyle = t.type === 'jungle' ? 'rgba(10,50,25,0.4)' : 'rgba(15,70,30,0.4)';
    ctx.beginPath();
    ctx.moveTo(px + tile * 0.5, py + tile * 0.15);
    ctx.lineTo(px + tile * 0.78, py + tile * 0.62);
    ctx.lineTo(px + tile * 0.22, py + tile * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,90,40,0.35)';
    ctx.fillRect(px + tile * 0.45, py + tile * 0.55, tile * 0.12, tile * 0.25);
  }
  if (t.type === 'mountain' || t.type === 'hill' || t.type === 'volcano') {
    ctx.fillStyle = t.type === 'volcano' ? 'rgba(90,30,20,0.45)' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(px + tile * 0.5, py + tile * 0.12);
    ctx.lineTo(px + tile * 0.88, py + tile * 0.82);
    ctx.lineTo(px + tile * 0.12, py + tile * 0.82);
    ctx.closePath();
    ctx.fill();
    if (t.type === 'mountain') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(px + tile * 0.5, py + tile * 0.12);
      ctx.lineTo(px + tile * 0.62, py + tile * 0.35);
      ctx.lineTo(px + tile * 0.38, py + tile * 0.35);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (t.type === 'water') {
    ctx.fillStyle = `rgba(120,200,230,${0.08 + ((x + y + state.turn) % 3) * 0.03})`;
    ctx.fillRect(px, py + tile * 0.35, tile, tile * 0.12);
    ctx.fillRect(px, py + tile * 0.62, tile, tile * 0.08);
  }
  if (t.type === 'coast') {
    ctx.fillStyle = `rgba(180,220,240,${0.14 + (state.turn % 3) * 0.04})`;
    ctx.fillRect(px, py + tile * 0.62, tile, tile * 0.22);
  }
  if (t.type === 'desert') {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(px + 2, py + tile * 0.55, tile - 4, 1.5);
  }
  if (t.type === 'swamp') {
    ctx.fillStyle = 'rgba(40,80,50,0.3)';
    ctx.fillRect(px + tile * 0.2, py + tile * 0.55, tile * 0.25, tile * 0.15);
    ctx.fillRect(px + tile * 0.55, py + tile * 0.35, tile * 0.2, tile * 0.12);
  }
}

function drawTerrainGrain(ctx, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % w;
    const y = (i * 53) % h;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawVisibleGrid(ctx, world, originX, originY, viewW, viewH, tile) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = originY; y < Math.min(world.height, originY + viewH); y++) {
    for (let x = originX; x < Math.min(world.width, originX + viewW); x++) {
      const t = tileAt(world.tiles, world.width, x, y);
      if (!t || t.fog) continue;
      const px = (x - originX) * tile;
      const py = (y - originY) * tile;
      ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
    }
  }
  ctx.restore();
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
      ctx.fillStyle = '#1a2820';
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
    ctx.strokeStyle = '#c9a05a';
    ctx.lineWidth = 1.5;
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
  return ({ food: '#a3d977', wood: '#8b5a2b', stone: '#c8c8c8', gold: '#e2c15a', iron: '#9aa3b0' })[type] || '#fff';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
