import { SEASONS, BUILDINGS, UNITS, TECHS, WONDERS, EVENTS } from './data.js';
import { createWorld, reveal, findLand, tileAt, buildRoad } from './world.js';
import { mulberry32, pick, clamp, dist, uid, toast } from './utils.js';

export function newCampaign(opts = {}) {
  const seed = opts.seed ?? (Date.now() % 1e9);
  const rand = mulberry32(seed);
  const width = opts.width || 80;
  const height = opts.height || 56;
  const world = createWorld(rand, width, height);
  const spawn = findLand(world, rand);
  reveal(world, spawn.x, spawn.y, 5);

  const player = {
    name: opts.kingdomName || 'Kingdom of Aralon',
    color: '#c9783a',
    res: { food: 50, wood: 40, stone: 25, gold: 60, iron: 4, lore: 0 },
    science: 0,
    researched: [],
    researchQueue: null,
    happiness: 65,
    unrest: 5,
    prestige: 0,
    taxes: 15,
  };

  const units = [
    makeUnit('scout', spawn.x, spawn.y, rand),
    makeUnit('settler', spawn.x, spawn.y, rand),
    makeUnit('warrior', spawn.x, Math.max(0, spawn.y - 1), rand),
  ];

  const rivals = makeRivals(world, rand, spawn);
  const raiders = makeRaiders(world, rand, spawn, 7);

  const state = {
    seed, rand, version: 2,
    turn: 1, year: 1, seasonIndex: 0, season: SEASONS[0],
    world, player, units, cities: [],
    rivals, raiders,
    wonders: WONDERS.map((w) => ({ ...w, owner: null, progress: 0 })),
    chronicle: [
      { year: 1, text: 'A new chronicle opens in Aetheria.', cat: 'era' },
    ],
    log: [],
    selectedUnitId: units[0].id,
    selectedCityId: null,
    camera: { x: spawn.x, y: spawn.y, zoom: 2 },
    selectedTile: { x: spawn.x, y: spawn.y },
    event: null,
    missions: [],
    tutorialStep: 0,
    stats: { citiesFounded: 0, raidersSlain: 0, sitesDelved: 0, wondersBuilt: 0 },
    victory: null,
    notifications: [],
  };

  pushLog(state, 'Your reign begins. Explore, found a city, and shape history.', 'system');
  return state;
}

function makeUnit(type, x, y, rand) {
  const def = UNITS[type];
  return {
    id: uid('u'),
    type,
    name: def.name,
    x, y,
    moves: def.moves,
    maxMoves: def.moves,
    vision: def.vision,
    atk: def.atk,
    hp: def.hp,
    maxHp: def.hp,
    xp: 0,
    level: 1,
  };
}

function makeRivals(world, rand, spawn) {
  const defs = [
    { name: 'Ashen Dominion', ruler: 'Queen Vexra', color: '#b84444' },
    { name: 'Tideborn Compact', ruler: 'King Orlan', color: '#2f86a8' },
    { name: 'Sunreach Sultanate', ruler: 'Sultana Zahra', color: '#c9a24a' },
    { name: 'Frostheim Jarldom', ruler: 'Jarl Sigrid', color: '#7aa0c2' },
  ];
  return defs.map((d, i) => {
    const capital = findLand(world, rand, spawn, 18 + i * 2);
    return {
      id: `rival_${i}`,
      ...d,
      capital,
      opinion: -5 + Math.floor(rand() * 20),
      atWar: false,
      alliance: false,
      trade: false,
      power: 30 + Math.floor(rand() * 40),
      memory: [],
      personality: {
        honor: 30 + Math.floor(rand() * 50),
        greed: 20 + Math.floor(rand() * 60),
        aggression: 20 + Math.floor(rand() * 60),
      },
    };
  });
}

function makeRaiders(world, rand, spawn, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const p = findLand(world, rand, spawn, 10);
    list.push({
      id: uid('raid'),
      name: 'Ashen Raiders',
      x: p.x, y: p.y,
      hp: 14, atk: 3, alive: true,
    });
  }
  return list;
}

export function pushLog(state, msg, cat = 'general') {
  state.log.unshift({ turn: state.turn, year: state.year, msg, cat });
  if (state.log.length > 120) state.log.length = 120;
}

export function chronicle(state, text, cat = 'general') {
  state.chronicle.push({ year: state.year, turn: state.turn, text, cat });
  pushLog(state, text, cat);
}

export function canAfford(res, cost = {}) {
  return Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v);
}

export function pay(res, cost = {}) {
  for (const [k, v] of Object.entries(cost)) res[k] = (res[k] || 0) - v;
}

export function foundCity(state, unit) {
  if (!unit || unit.type !== 'settler') {
    toast('Select a Settler first.', 'warn');
    return false;
  }
  const t = tileAt(state.world.tiles, state.world.width, unit.x, unit.y);
  if (!t || t.type === 'water') {
    toast('Cannot found a city on water.', 'warn');
    return false;
  }
  if (state.cities.some((c) => dist(c, unit) < 4)) {
    toast('Too close to another city.', 'warn');
    return false;
  }
  const names = ['Aralon', 'Riverhaven', 'Stonewick', 'Goldmont', 'Dawnmere', 'Oakford', 'Redhollow'];
  const city = {
    id: uid('city'),
    name: state.cities.length === 0 ? names[0] : pick(state.rand, names.slice(1)),
    x: unit.x, y: unit.y,
    pop: 15,
    housing: 20,
    happiness: 70,
    buildings: ['town_hall', 'house'],
    queue: [],
    defense: 0,
    stage: 'village',
  };
  state.cities.push(city);
  state.selectedCityId = city.id;
  state.units = state.units.filter((u) => u.id !== unit.id);
  state.stats.citiesFounded += 1;
  reveal(state.world, city.x, city.y, 5);
  for (const other of state.cities) {
    if (other.id !== city.id) buildRoad(state.world, city, other);
  }
  chronicle(state, `${city.name} founded.`, 'founding');
  if (state.cities.length === 1) chronicle(state, `${state.player.name} rises.`, 'founding');
  toast(`${city.name} founded!`, 'good');
  if (state.tutorialStep < 2) state.tutorialStep = 2;
  return true;
}

export function moveUnit(state, unit, x, y) {
  if (!unit || unit.moves <= 0) return false;
  if (x < 0 || y < 0 || x >= state.world.width || y >= state.world.height) return false;
  if (Math.abs(x - unit.x) + Math.abs(y - unit.y) !== 1) return false;
  const t = tileAt(state.world.tiles, state.world.width, x, y);
  if (!t) return false;
  const naval = UNITS[unit.type]?.naval;
  if (naval) {
    if (!(t.type === 'water' || t.type === 'coast')) return false;
  } else if (t.type === 'water') {
    return false;
  }
  unit.x = x;
  unit.y = y;
  unit.moves -= t.road ? 1 : 1;
  if (t.type === 'forest' || t.type === 'hill' || t.type === 'mountain') {
    // already spent 1; rough terrain can end move sometimes
    if (!t.road && t.type === 'mountain') unit.moves = Math.max(0, unit.moves - 1);
  }
  let vision = unit.vision;
  if (state.player.researched.includes('cartography') && unit.type === 'scout') vision += 1;
  reveal(state.world, x, y, vision);
  state.camera.x = x;
  state.camera.y = y;
  state.selectedTile = { x, y };

  // discover sites
  for (const site of state.world.sites) {
    if (!site.discovered && dist(site, unit) <= 1) {
      site.discovered = true;
      chronicle(state, `Discovered ${site.kind.replace(/_/g, ' ')}.`, 'explore');
      toast(`Discovered ${site.kind.replace(/_/g, ' ')}!`, 'good');
    }
  }

  // combat
  if (unit.atk > 0) {
    const foe = state.raiders.find((r) => r.alive && r.x === x && r.y === y);
    if (foe) fightRaider(state, unit, foe);
    for (const rival of state.rivals) {
      if (rival.atWar && rival.capital.x === x && rival.capital.y === y) {
        rival.siege = (rival.siege || 0) + 1;
        pushLog(state, `Sieging ${rival.name} (${rival.siege}/4)...`, 'war');
        if (rival.siege >= 4) {
          rival.collapsed = true;
          rival.atWar = false;
          state.player.prestige += 25;
          state.player.res.gold += 40;
          chronicle(state, `${rival.name} falls after siege.`, 'war');
          toast(`${rival.name} conquered!`, 'good');
        }
      }
    }
  }

  if (state.tutorialStep < 1) state.tutorialStep = 1;
  return true;
}

function fightRaider(state, unit, foe) {
  const dmg = Math.max(1, unit.atk + Math.floor(state.rand() * 3));
  foe.hp -= dmg;
  unit.hp -= Math.max(1, foe.atk - 1);
  unit.xp += 4;
  pushLog(state, `${unit.name} strikes raiders (−${dmg}).`, 'war');
  if (foe.hp <= 0) {
    foe.alive = false;
    state.stats.raidersSlain += 1;
    unit.xp += 8;
    state.player.res.gold += 8;
    chronicle(state, 'Raider band destroyed.', 'war');
    toast('Raiders defeated!', 'good');
  }
  if (unit.hp <= 0) {
    pushLog(state, `${unit.name} has fallen.`, 'war');
    state.units = state.units.filter((u) => u.id !== unit.id);
    state.selectedUnitId = state.units[0]?.id || null;
  } else if (unit.xp >= unit.level * 20) {
    unit.level += 1;
    unit.atk += 1;
    unit.maxHp += 3;
    unit.hp = unit.maxHp;
    toast(`${unit.name} reached level ${unit.level}!`, 'good');
  }
}

export function gather(state, unit) {
  if (!unit || unit.type !== 'worker') {
    toast('Only Workers can gather.', 'warn');
    return false;
  }
  const dep = state.world.deposits.find((d) => d.x === unit.x && d.y === unit.y && d.amount > 0);
  if (!dep) {
    toast('No deposit here.', 'warn');
    return false;
  }
  const take = Math.min(6, dep.amount);
  dep.amount -= take;
  state.player.res[dep.type] = (state.player.res[dep.type] || 0) + take;
  unit.moves = 0;
  toast(`Gathered ${take} ${dep.type}.`, 'good');
  if (state.tutorialStep < 4) state.tutorialStep = 4;
  return true;
}

export function delve(state, unit, site) {
  if (!unit || !site || site.delved) return false;
  if (dist(unit, site) > 1) {
    toast('Move adjacent to delve.', 'warn');
    return false;
  }
  site.progress += 1;
  unit.moves = 0;
  if (state.rand() < 0.25) {
    unit.hp -= 2;
    pushLog(state, 'Delve hazard — unit wounded.', 'explore');
  }
  if (site.progress >= 3) {
    site.delved = true;
    state.player.res.gold += site.loot.gold;
    state.player.res.lore += site.loot.lore;
    state.stats.sitesDelved += 1;
    chronicle(state, `Delved ${site.kind.replace(/_/g, ' ')}.`, 'explore');
    toast('Expedition complete!', 'good');
  } else {
    toast(`Delving… ${site.progress}/3`, 'info');
  }
  return true;
}

export function queueBuilding(state, city, id) {
  const def = BUILDINGS[id];
  if (!def || !city) return false;
  if (def.once && city.buildings.includes(id)) return false;
  if (def.coast) {
    const t = tileAt(state.world.tiles, state.world.width, city.x, city.y);
    const nearCoast = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const n = tileAt(state.world.tiles, state.world.width, city.x + dx, city.y + dy);
      return n && (n.type === 'coast' || n.type === 'water');
    });
    if (!nearCoast) {
      toast('Dockyard needs a coastal city.', 'warn');
      return false;
    }
  }
  // tech gate for some buildings
  const gated = TECHS.find((t) => t.unlocks?.includes(id));
  if (gated && !state.player.researched.includes(gated.id) && id !== 'house' && id !== 'town_hall' && id !== 'barracks' && id !== 'farm' && id !== 'lumber_mill' && id !== 'quarry') {
    // allow basics; others need tech
    if (!['house', 'farm', 'lumber_mill', 'quarry', 'barracks', 'tenement'].includes(id)) {
      if (!state.player.researched.includes(gated.id)) {
        toast(`Requires ${gated.name}.`, 'warn');
        return false;
      }
    }
  }
  if (!canAfford(state.player.res, def.cost)) {
    toast('Not enough resources.', 'warn');
    return false;
  }
  pay(state.player.res, def.cost);
  city.queue.push({ kind: 'building', id, left: def.turns, name: def.name });
  toast(`Queued ${def.name}`, 'info');
  if (state.tutorialStep < 3) state.tutorialStep = 3;
  return true;
}

export function queueUnit(state, city, id) {
  const def = UNITS[id];
  if (!def || !city) return false;
  if (['warrior', 'archer'].includes(id) && !city.buildings.includes('barracks')) {
    toast('Need Barracks.', 'warn');
    return false;
  }
  if (id === 'galley' && !city.buildings.includes('dockyard')) {
    toast('Need Dockyard.', 'warn');
    return false;
  }
  if (id === 'warrior' && state.player.researched.includes('bronze_working') === false && state.year > 1) {
    // allow early warrior from starting — training more benefits from tech but not required for prototype
  }
  if (!canAfford(state.player.res, def.cost)) {
    toast('Not enough resources.', 'warn');
    return false;
  }
  pay(state.player.res, def.cost);
  city.queue.push({ kind: 'unit', id, left: 2, name: def.name });
  toast(`Training ${def.name}`, 'info');
  return true;
}

export function startWonder(state, city, wonderId) {
  const w = state.wonders.find((x) => x.id === wonderId);
  if (!w || w.owner || !city) return false;
  if (!city.buildings.includes('wonder_yard') && !state.player.researched.includes('engineering')) {
    toast('Need Engineering + Wonder Yard.', 'warn');
    return false;
  }
  if (!canAfford(state.player.res, w.cost)) {
    toast('Not enough resources.', 'warn');
    return false;
  }
  pay(state.player.res, w.cost);
  city.queue.push({ kind: 'wonder', id: w.id, left: w.turns, name: w.name });
  toast(`Begun ${w.name}`, 'info');
  return true;
}

export function queueResearch(state, techId) {
  const tech = TECHS.find((t) => t.id === techId);
  if (!tech) return false;
  if (state.player.researched.includes(techId)) return false;
  if (tech.requires && !tech.requires.every((r) => state.player.researched.includes(r))) {
    toast('Missing prerequisites.', 'warn');
    return false;
  }
  state.player.researchQueue = techId;
  toast(`Researching ${tech.name}`, 'info');
  return true;
}

export function diploAction(state, rivalId, action) {
  const r = state.rivals.find((x) => x.id === rivalId);
  if (!r || r.collapsed) return;
  const p = r.personality;
  if (action === 'gift') {
    if (state.player.res.gold < 20) return toast('Need 20 gold.', 'warn');
    state.player.res.gold -= 20;
    r.opinion += 8 + (p.greed > 50 ? 6 : 0);
    r.memory.push('Accepted a gift');
    toast(`Gift sent to ${r.name}`, 'good');
  } else if (action === 'trade') {
    r.trade = true;
    r.opinion += 5;
    state.player.res.gold += 10;
    r.memory.push('Opened trade');
    chronicle(state, `Trade with ${r.name}.`, 'diplo');
  } else if (action === 'ally') {
    if (r.opinion < 15) return toast('Opinion too low.', 'warn');
    r.alliance = true;
    r.opinion += 12;
    r.memory.push('Formed alliance');
    chronicle(state, `Alliance with ${r.name}.`, 'diplo');
    toast(`Allied with ${r.name}`, 'good');
  } else if (action === 'threat') {
    r.opinion -= 12;
    r.memory.push('Was threatened');
    if (p.aggression > 55 && r.opinion < -20) {
      r.atWar = true;
      chronicle(state, `${r.name} declares war!`, 'war');
      toast(`${r.name} declares war!`, 'bad');
    } else toast('They will remember this.', 'warn');
  } else if (action === 'war') {
    r.atWar = true;
    r.alliance = false;
    r.memory.push('War declared');
    chronicle(state, `War with ${r.name} begins.`, 'war');
    toast(`War with ${r.name}!`, 'bad');
  } else if (action === 'peace') {
    if (!r.atWar) return;
    r.atWar = false;
    r.siege = 0;
    r.opinion += 10;
    r.memory.push('Peace signed');
    chronicle(state, `Peace with ${r.name}.`, 'diplo');
    toast('Peace signed.', 'good');
  }
  r.opinion = clamp(r.opinion, -100, 100);
}

export function estimateYields(state) {
  const foodMult = state.season === 'Summer' ? 1.4 : state.season === 'Winter' ? 0.55 : 1;
  const out = { food: 0, wood: 0, stone: 0, gold: 0, iron: 0, lore: 0, science: 0 };
  for (const city of state.cities) {
    let food = 3;
    let wood = 1;
    let stone = 0;
    let gold = Math.floor(city.pop * (state.player.taxes / 100) * 0.35);
    let iron = 0;
    let science = 1;
    for (const b of city.buildings) {
      const def = BUILDINGS[b];
      if (!def) continue;
      if (def.food) food += def.food;
      if (def.wood) wood += def.wood;
      if (def.stone) stone += def.stone;
      if (def.gold) gold += def.gold + (state.player.researched.includes('guilds') && b === 'marketplace' ? 2 : 0);
      if (def.iron) iron += def.iron;
      if (def.science) science += def.science;
    }
    out.food += Math.floor(food * foodMult);
    out.wood += wood;
    out.stone += stone;
    out.gold += gold;
    out.iron += iron;
    out.science += science + Math.floor(city.pop / 20);
  }
  for (const r of state.rivals) {
    if (!r.collapsed && r.trade) out.gold += 2;
  }
  return out;
}

export function endTurn(state) {
  state.seasonIndex = (state.seasonIndex + 1) % 4;
  state.season = SEASONS[state.seasonIndex];
  if (state.seasonIndex === 0) state.year += 1;
  state.turn += 1;

  // refresh moves
  for (const u of state.units) {
    const bonus = state.season === 'Summer' ? 1 : state.season === 'Winter' ? -1 : 0;
    u.moves = Math.max(1, u.maxMoves + bonus);
    if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1);
  }

  // city production
  const yields = estimateYields(state);
  state.player.res.food += yields.food;
  state.player.res.wood += yields.wood;
  state.player.res.stone += yields.stone;
  state.player.res.gold += yields.gold;
  state.player.res.iron += yields.iron;
  state.player.science += yields.science;

  for (const city of state.cities) {
    let housing = 10;
    city.defense = 0;
    for (const b of city.buildings) {
      const def = BUILDINGS[b];
      if (!def) continue;
      if (def.housing) housing += def.housing;
      if (def.defense) city.defense += def.defense;
      if (def.happiness) city.happiness = clamp(city.happiness + 1, 0, 100);
    }

    city.housing = housing;
    city.happiness = clamp(city.happiness - Math.floor(state.player.taxes / 12) + 2, 0, 100);
    if (city.pop < city.housing && city.happiness > 40 && state.rand() < 0.45) city.pop += 1;
    if (city.happiness < 25 && city.pop > 8 && state.rand() < 0.25) city.pop -= 1;

    if (city.pop >= 80) city.stage = 'capital';
    else if (city.pop >= 45) city.stage = 'city';
    else if (city.pop >= 25) city.stage = 'town';
    else city.stage = 'village';

    // queue
    if (city.queue.length) {
      const job = city.queue[0];
      job.left -= 1;
      if (job.left <= 0) {
        if (job.kind === 'building') {
          city.buildings.push(job.id);
          pushLog(state, `${city.name} finished ${job.name}.`, 'build');
          toast(`${job.name} complete`, 'good');
        } else if (job.kind === 'unit') {
          const u = makeUnit(job.id, city.x, city.y, state.rand);
          if (job.id === 'warrior' && state.player.researched.includes('iron_working')) u.atk += 1;
          state.units.push(u);
          pushLog(state, `${city.name} trained ${job.name}.`, 'train');
        } else if (job.kind === 'wonder') {
          const w = state.wonders.find((x) => x.id === job.id);
          if (w && !w.owner) {
            w.owner = 'player';
            state.stats.wondersBuilt += 1;
            state.player.prestige += 30;
            applyWonderBonus(state, w);
            chronicle(state, `${w.name} completed!`, 'wonder');
            toast(`${w.name} complete!`, 'good');
          }
        }
        city.queue.shift();
      }
    }
  }

  if (state.cities.length) {
    state.player.happiness = Math.round(state.cities.reduce((s, c) => s + c.happiness, 0) / state.cities.length);
  }

  // research
  if (state.player.researchQueue) {
    const tech = TECHS.find((t) => t.id === state.player.researchQueue);
    if (tech && state.player.science >= tech.cost) {
      state.player.science -= tech.cost;
      state.player.researched.push(tech.id);
      state.player.researchQueue = null;
      chronicle(state, `Discovered ${tech.name}.`, 'tech');
      toast(`Researched ${tech.name}!`, 'good');
      if (tech.id === 'philosophy') state.player.happiness = clamp(state.player.happiness + 10, 0, 100);
    }
  }

  // rivals AI
  for (const r of state.rivals.filter((x) => !x.collapsed)) {
    r.power += Math.floor(state.rand() * 3);
    if (r.trade) state.player.res.gold += 2;
    if (r.atWar) r.opinion -= 2;
    else r.opinion += (r.personality.honor - r.personality.aggression) * 0.02;
    r.opinion = clamp(r.opinion, -100, 100);
    if (!r.atWar && r.opinion < -45 && r.personality.aggression > 50 && state.rand() < 0.12) {
      r.atWar = true;
      chronicle(state, `${r.name} declares war!`, 'war');
      toast(`${r.name} declares war!`, 'bad');
    }
    // AI wonders race
    if (state.rand() < 0.04) {
      const open = state.wonders.filter((w) => !w.owner);
      if (open.length) {
        const w = pick(state.rand, open);
        w.progress = (w.progress || 0) + 1;
        if (w.progress >= w.turns) {
          w.owner = r.id;
          chronicle(state, `${r.name} completed ${w.name}!`, 'wonder');
        }
      }
    }
  }

  // raiders wander / raid
  for (const raid of state.raiders.filter((r) => r.alive)) {
    raid.x = clamp(raid.x + pick(state.rand, [-1, 0, 1]), 0, state.world.width - 1);
    raid.y = clamp(raid.y + pick(state.rand, [-1, 0, 1]), 0, state.world.height - 1);
    const city = state.cities.find((c) => dist(c, raid) === 0);
    if (city && state.rand() < 0.35) {
      const loss = Math.max(2, 8 - city.defense);
      state.player.res.food = Math.max(0, state.player.res.food - loss);
      city.happiness -= 4;
      pushLog(state, `Raiders strike ${city.name}!`, 'war');
    }
  }

  // world events
  if (!state.event && state.rand() < 0.16) {
    const ev = pick(state.rand, EVENTS);
    state.event = { ...ev };
    toast(`Event: ${ev.name}`, ev.good ? 'good' : 'warn');
  }

  // missions
  if (state.missions.filter((m) => m.status === 'active').length < 2 && state.rand() < 0.2 && state.cities.length) {
    const types = [
      { name: 'Clear nearby raiders', goal: 'raiders', need: 2 },
      { name: 'Found another city', goal: 'cities', need: state.stats.citiesFounded + 1 },
      { name: 'Delve a ruin site', goal: 'delve', need: 1 },
      { name: 'Reach 100 gold', goal: 'gold', need: 100 },
    ];
    const m = pick(state.rand, types);
    state.missions.push({
      id: uid('mis'),
      ...m,
      status: 'active',
      turns: 12,
      reward: 25 + Math.floor(state.rand() * 20),
    });
    toast(`Mission: ${m.name}`, 'info');
  }
  for (const m of state.missions.filter((x) => x.status === 'active')) {
    m.turns -= 1;
    let done = false;
    if (m.goal === 'raiders' && state.stats.raidersSlain >= m.need) done = true;
    if (m.goal === 'cities' && state.stats.citiesFounded >= m.need) done = true;
    if (m.goal === 'delve' && state.stats.sitesDelved >= m.need) done = true;
    if (m.goal === 'gold' && state.player.res.gold >= m.need) done = true;
    if (done) {
      m.status = 'done';
      state.player.res.gold += m.reward;
      state.player.prestige += 5;
      toast(`Mission complete: ${m.name}`, 'good');
    } else if (m.turns <= 0) {
      m.status = 'failed';
      state.player.happiness = clamp(state.player.happiness - 4, 0, 100);
    }
  }

  checkVictory(state);
  if (state.tutorialStep < 5 && state.turn >= 2) state.tutorialStep = Math.max(state.tutorialStep, 4);
  pushLog(state, `${state.season} of Year ${state.year}.`, 'season');
}

function applyWonderBonus(state, w) {
  if (w.bonus === 'food') state.player.res.food += 40;
  if (w.bonus === 'gold') state.player.res.gold += 40;
  if (w.bonus === 'science') state.player.science += 40;
  if (w.bonus === 'prestige') state.player.prestige += 20;
}

export function resolveEvent(state, choice) {
  const ev = state.event;
  if (!ev) return;
  const e = ev.effect || {};
  if (choice === 'accept' || choice === 'endure') {
    for (const [k, v] of Object.entries(e)) {
      if (k === 'spawnRaiders') {
        for (let i = 0; i < v; i++) {
          const p = findLand(state.world, state.rand, state.cities[0] || { x: 10, y: 10 }, 6);
          state.raiders.push({ id: uid('raid'), name: 'Ashen Raiders', x: p.x, y: p.y, hp: 12, atk: 3, alive: true });
        }
      } else if (k === 'revealSite') {
        const s = state.world.sites.find((x) => !x.discovered);
        if (s) {
          s.discovered = true;
          reveal(state.world, s.x, s.y, 2);
        }
      } else if (k === 'happiness') state.player.happiness = clamp(state.player.happiness + v, 0, 100);
      else if (k === 'pop' && state.cities[0]) state.cities[0].pop = Math.max(5, state.cities[0].pop + v);
      else if (state.player.res[k] != null) state.player.res[k] = Math.max(0, state.player.res[k] + v);
    }
    chronicle(state, ev.name, 'event');
  } else if (choice === 'spend') {
    state.player.res.gold = Math.max(0, state.player.res.gold - 15);
    state.player.happiness = clamp(state.player.happiness + 5, 0, 100);
  }
  state.event = null;
}

function checkVictory(state) {
  if (state.victory) return;
  const military = state.stats.raidersSlain >= 5 && state.cities.length >= 2;
  const wonder = state.stats.wondersBuilt >= 2;
  const diplo = state.rivals.filter((r) => !r.collapsed && (r.alliance || r.trade)).length >= 3;
  const explore = state.stats.sitesDelved >= 6 && state.player.res.lore >= 40;
  const wealth = state.player.res.gold >= 250 && state.cities.length >= 2;
  if (military) state.victory = { path: 'Military', text: 'Your armies secured the realm.' };
  else if (wonder) state.victory = { path: 'Wonder', text: 'Monuments immortalize your age.' };
  else if (diplo) state.victory = { path: 'Diplomacy', text: 'Peace and pacts bind the world.' };
  else if (explore) state.victory = { path: 'Exploration', text: 'The unknown yields to your scouts.' };
  else if (wealth) state.victory = { path: 'Wealth', text: 'Gold crowns your civilization.' };
  if (state.victory) {
    chronicle(state, `${state.victory.path} Victory!`, 'victory');
    toast(`${state.victory.path} Victory!`, 'good');
  }
}

export function serialize(state) {
  return {
    ...state,
    rand: undefined,
  };
}

export function revive(data) {
  data.rand = mulberry32((data.seed || 1) + (data.turn || 0));
  if (!data.camera) data.camera = { x: 0, y: 0, zoom: 2 };
  if (data.camera.zoom == null || data.camera.zoom < 1.6) data.camera.zoom = 2;
  if (!data.selectedTile) {
    const u = data.units?.find((unit) => unit.id === data.selectedUnitId) || data.units?.[0];
    data.selectedTile = u ? { x: u.x, y: u.y } : { x: data.camera.x, y: data.camera.y };
  }
  return data;
}

export { TECHS, BUILDINGS, UNITS, WONDERS };
