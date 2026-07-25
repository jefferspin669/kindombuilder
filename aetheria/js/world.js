import { pick, uid } from './utils.js';

export function createWorld(rand, width = 80, height = 56) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      const elev = Math.sin(nx * 7 + rand()) * Math.cos(ny * 6 + rand() * 2) + (rand() - 0.5) * 0.7;
      const moist = Math.sin(nx * 5 + 1.2) + Math.cos(ny * 8) + (rand() - 0.5);
      let type = 'grass';
      if (elev < -0.58) type = 'water';
      else if (elev < -0.38) type = 'coast';
      else if (elev > 0.78) type = rand() > 0.75 ? 'volcano' : 'mountain';
      else if (elev > 0.48) type = 'hill';
      else if (moist > 0.85) type = rand() > 0.5 ? 'jungle' : 'forest';
      else if (moist > 0.3) type = 'forest';
      else if (moist < -0.75) type = elev > 0.15 ? 'snow' : 'desert';
      else if (moist < -0.25 && elev < 0.15) type = 'swamp';
      if (rand() < 0.01 && type !== 'water') type = 'ruins';
      tiles.push({
        x, y, type,
        fog: true,
        explored: false,
        river: false,
        road: false,
      });
    }
  }

  // rivers
  for (let i = 0; i < 8; i++) {
    let x = Math.floor(rand() * width);
    let y = Math.floor(rand() * height * 0.25);
    for (let s = 0; s < 100; s++) {
      const t = tileAt(tiles, width, x, y);
      if (!t || t.type === 'water') break;
      t.river = true;
      y += 1;
      x += pick(rand, [-1, 0, 0, 1]);
      x = Math.max(0, Math.min(width - 1, x));
    }
  }

  const deposits = [];
  const kinds = ['food', 'wood', 'stone', 'gold', 'iron'];
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const t = tileAt(tiles, width, x, y);
    if (!t || t.type === 'water') continue;
    deposits.push({
      id: uid('dep'), x, y,
      type: pick(rand, kinds),
      amount: 25 + Math.floor(rand() * 50),
    });
  }

  const sites = [];
  const siteKinds = [
    'lost_city', 'ancient_temple', 'giant_cave', 'pirate_cove',
    'hidden_valley', 'ruined_library', 'crystal_grove', 'sunken_shrine',
  ];
  for (const kind of siteKinds) {
    for (let n = 0; n < 2; n++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = Math.floor(rand() * width);
        const y = Math.floor(rand() * height);
        const t = tileAt(tiles, width, x, y);
        if (!t || t.type === 'water') continue;
        if (sites.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 8)) continue;
        sites.push({
          id: uid('site'), kind, x, y,
          discovered: false, delved: false, progress: 0,
          loot: { gold: 15 + Math.floor(rand() * 35), lore: 8 + Math.floor(rand() * 20) },
        });
        break;
      }
    }
  }

  return { width, height, tiles, deposits, sites, name: 'Aetheria' };
}

export function tileAt(tiles, width, x, y) {
  if (x < 0 || y < 0 || x >= width) return null;
  const height = tiles.length / width;
  if (y >= height) return null;
  return tiles[y * width + x];
}

export function reveal(world, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const t = tileAt(world.tiles, world.width, x + dx, y + dy);
      if (t) {
        t.fog = false;
        t.explored = true;
      }
    }
  }
}

export function findLand(world, rand, avoid = null, minDist = 0) {
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(rand() * world.width);
    const y = Math.floor(rand() * world.height);
    const t = tileAt(world.tiles, world.width, x, y);
    if (!t || !['grass', 'forest', 'hill', 'coast'].includes(t.type)) continue;
    if (avoid && Math.abs(x - avoid.x) + Math.abs(y - avoid.y) < minDist) continue;
    return { x, y };
  }
  return { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

export function buildRoad(world, a, b) {
  let x = a.x;
  let y = a.y;
  let guard = 0;
  while ((x !== b.x || y !== b.y) && guard++ < 300) {
    const t = tileAt(world.tiles, world.width, x, y);
    if (t && t.type !== 'water') t.road = true;
    if (x !== b.x) x += x < b.x ? 1 : -1;
    else y += y < b.y ? 1 : -1;
  }
}
