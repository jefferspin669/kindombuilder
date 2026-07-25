import { WONDER_SITES, WILDLIFE } from './data.js';
import { pick, uid } from './utils.js';

export function createWorld(rand, opts = {}) {
  const w = opts.width || 64;
  const h = opts.height || 44;
  const tiles = [];
  const deposits = [];
  const sites = [];
  const wildlife = [];
  const rivers = new Set();
  const roads = new Set();
  const bridges = new Set();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      const elev = Math.sin(nx * 6 + rand() * 2) * Math.cos(ny * 5) + (rand() - 0.5) * 0.6;
      const moisture = Math.sin(nx * 4 + 2) + Math.cos(ny * 7) + (rand() - 0.5);
      let type = 'grass';
      if (elev < -0.55) type = 'water';
      else if (elev < -0.35) type = 'coast';
      else if (elev > 0.75) type = rand() > 0.7 ? 'volcano' : 'mountain';
      else if (elev > 0.45) type = 'hill';
      else if (moisture > 0.8 && elev > -0.2) type = rand() > 0.5 ? 'jungle' : 'forest';
      else if (moisture > 0.35) type = 'forest';
      else if (moisture < -0.7) type = elev > 0.2 ? 'snow' : 'desert';
      else if (moisture < -0.2 && elev < 0.1) type = 'swamp';
      if (rand() < 0.012 && type !== 'water') type = 'ruins';

      tiles.push({
        x, y, type,
        fog: true,
        river: false,
        road: false,
        bridge: false,
        ash: 0,
        sprawl: 0,
        seasonTint: 0,
      });
    }
  }

  // Rivers
  for (let i = 0; i < 6; i++) {
    let x = Math.floor(rand() * w);
    let y = Math.floor(rand() * h * 0.3);
    for (let step = 0; step < 80; step++) {
      const t = tileAt(tiles, w, x, y);
      if (!t || t.type === 'water') break;
      t.river = true;
      rivers.add(`${x},${y}`);
      y += 1;
      x += pick(rand, [-1, 0, 0, 1]);
      x = Math.max(0, Math.min(w - 1, x));
    }
  }

  // Resource deposits
  const depositTypes = ['food', 'wood', 'stone', 'gold', 'iron', 'coal'];
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const t = tileAt(tiles, w, x, y);
    if (!t || t.type === 'water') continue;
    deposits.push({ id: uid('dep'), x, y, type: pick(rand, depositTypes), amount: 20 + Math.floor(rand() * 40) });
  }

  // Wonder / exploration sites
  for (const kind of WONDER_SITES) {
    for (let n = 0; n < 2; n++) {
      let placed = false;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const x = Math.floor(rand() * w);
        const y = Math.floor(rand() * h);
        const t = tileAt(tiles, w, x, y);
        if (!t || t.type === 'water') continue;
        if (sites.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 6)) continue;
        sites.push({
          id: uid('site'),
          kind,
          x, y,
          discovered: false,
          delved: false,
          progress: 0,
          risk: 0.2 + rand() * 0.4,
          loot: { gold: 10 + Math.floor(rand() * 40), lore: 5 + Math.floor(rand() * 20) },
        });
        placed = true;
      }
    }
  }

  // Wildlife packs
  for (const species of WILDLIFE) {
    for (let i = 0; i < 4; i++) {
      wildlife.push({
        id: uid('wild'),
        species: species.id,
        x: Math.floor(rand() * w),
        y: Math.floor(rand() * h),
        size: 3 + Math.floor(rand() * 8),
      });
    }
  }

  return {
    width: w,
    height: h,
    tiles,
    deposits,
    sites,
    wildlife,
    rivers,
    roads,
    bridges,
    climate: 'temperate',
    herds: [],
    volcanoes: tiles.filter((t) => t.type === 'volcano').map((t) => ({ x: t.x, y: t.y, heat: 0.3 + rand() * 0.5 })),
  };
}

export function tileAt(tiles, w, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= Math.floor(tiles.length / w)) return null;
  return tiles[y * w + x];
}

export function revealFog(world, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const t = tileAt(world.tiles, world.width, x + dx, y + dy);
      if (t) t.fog = false;
    }
  }
}

export function findSpawn(world, rand) {
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(rand() * world.width);
    const y = Math.floor(rand() * world.height);
    const t = tileAt(world.tiles, world.width, x, y);
    if (t && ['grass', 'forest', 'hill'].includes(t.type)) {
      return { x, y };
    }
  }
  return { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

export function autoRoads(world, cities) {
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      let x = cities[i].x;
      let y = cities[i].y;
      const tx = cities[j].x;
      const ty = cities[j].y;
      let guard = 0;
      while ((x !== tx || y !== ty) && guard++ < 200) {
        const t = tileAt(world.tiles, world.width, x, y);
        if (t && t.type !== 'water') {
          t.road = true;
          world.roads.add(`${x},${y}`);
          if (t.river) {
            t.bridge = true;
            world.bridges.add(`${x},${y}`);
          }
        }
        if (x !== tx) x += x < tx ? 1 : -1;
        else if (y !== ty) y += y < ty ? 1 : -1;
      }
    }
  }
}

export function evolveWorld(state) {
  const { world, rand } = state;
  const changes = [];

  // Forests spread
  for (let i = 0; i < 12; i++) {
    const t = world.tiles[Math.floor(rand() * world.tiles.length)];
    if (t.type === 'grass' && !t.fog && rand() < 0.35) {
      const n = neighbors(world, t.x, t.y);
      if (n.some((k) => k.type === 'forest')) {
        t.type = 'forest';
        changes.push(`Forest spreads near (${t.x},${t.y}).`);
      }
    }
  }

  // Rivers meander
  if (rand() < 0.15) {
    const riverTiles = world.tiles.filter((t) => t.river);
    if (riverTiles.length) {
      const r = pick(rand, riverTiles);
      const n = neighbors(world, r.x, r.y).filter((t) => t.type !== 'water');
      if (n.length) {
        const dest = pick(rand, n);
        dest.river = true;
        world.rivers.add(`${dest.x},${dest.y}`);
        changes.push('A river changes course.');
      }
    }
  }

  // Bridge collapse
  if (world.bridges.size && rand() < 0.08) {
    const key = pick(rand, [...world.bridges]);
    const [x, y] = key.split(',').map(Number);
    const t = tileAt(world.tiles, world.width, x, y);
    if (t) {
      t.bridge = false;
      world.bridges.delete(key);
      changes.push(`Bridge collapses at (${x},${y}).`);
    }
  }

  // Road wear
  if (world.roads.size && rand() < 0.1) {
    const key = pick(rand, [...world.roads]);
    const [x, y] = key.split(',').map(Number);
    const t = tileAt(world.tiles, world.width, x, y);
    if (t && !state.cities.some((c) => c.x === x && c.y === y)) {
      t.road = false;
      world.roads.delete(key);
      changes.push('A road wears away.');
    }
  }

  // Volcano erupt
  for (const v of world.volcanoes) {
    v.heat += (rand() - 0.4) * 0.1;
    if (v.heat > 0.95 && rand() < 0.3) {
      v.heat = 0.2;
      for (const n of neighbors(world, v.x, v.y)) {
        n.ash = Math.min(5, n.ash + 2);
        if (n.type === 'forest' || n.type === 'grass') n.type = 'desert';
      }
      changes.push(`Volcano erupts near (${v.x},${v.y})!`);
    }
  }

  // City sprawl visual
  for (const city of state.cities) {
    const t = tileAt(world.tiles, world.width, city.x, city.y);
    if (t) t.sprawl = Math.min(5, Math.floor(city.population / 40));
  }

  // Climate shift
  if (rand() < 0.05) {
    world.climate = pick(rand, ['temperate', 'warming', 'cooling', 'wet', 'dry']);
    changes.push(`Climate shifts toward ${world.climate}.`);
  }

  // Wildlife migrate
  for (const pack of world.wildlife) {
    if (pack.species === 'deer' || rand() < 0.2) {
      pack.x = Math.max(0, Math.min(world.width - 1, pack.x + pick(rand, [-1, 0, 1])));
      pack.y = Math.max(0, Math.min(world.height - 1, pack.y + pick(rand, [-1, 0, 1])));
    }
  }

  return changes;
}

function neighbors(world, x, y) {
  const out = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = tileAt(world.tiles, world.width, x + dx, y + dy);
    if (t) out.push(t);
  }
  return out;
}
