import {
  SEASONS, BUILDINGS, UNITS, CITY_ARCHETYPES, GOVERNORS, RELIGIONS,
  GOVERNMENTS, WONDERS, SPACE_BODIES, CRIME_NETWORKS, CULTURE_TRAITS,
  GREAT_KINDS, buildTechTree, WORLD_EVENTS,
} from './data.js';
import { createWorld, findSpawn, revealFog, autoRoads } from './world.js';
import {
  mulberry32, pick, uid, personName, houseName, log, chronicle, clamp,
} from './utils.js';

export function newGame(opts = {}) {
  const seed = opts.seed ?? (Date.now() % 1e9);
  const rand = mulberry32(seed);
  const width = opts.width || (opts.massive ? 96 : 64);
  const height = opts.height || (opts.massive ? 66 : 44);
  const world = createWorld(rand, { width, height });
  const spawn = findSpawn(world, rand);
  revealFog(world, spawn.x, spawn.y, 3);

  const player = {
    id: 'player',
    name: opts.kingdomName || 'Kingdom of Aralon',
    color: '#c9783a',
    civLook: pick(rand, ['verdant', 'northern', 'desert', 'island', 'mountain']),
    resources: {
      food: 40, wood: 30, stone: 20, gold: 50, iron: 0, coal: 0,
      wheat: 0, flour: 0, bread: 0, weapons: 2, mana: 0, lore: 0,
    },
    taxes: 15,
    laws: [],
    religion: RELIGIONS[0].id,
    government: 'absolute',
    happiness: 60,
    crime: 15,
    education: 20,
    healthcare: 20,
    faith: 30,
    unrest: 5,
    corruption: 10,
    science: 0,
    researched: [],
    researchQueue: [],
    prestige: 10,
    culture: Object.fromEntries(CULTURE_TRAITS.map((t) => [t, 20 + Math.floor(rand() * 30)])),
    syncretism: 0,
    fantasy: false,
    mana: 0,
  };

  const units = [
    makeUnit('scout', spawn.x, spawn.y, 'player', rand),
    makeUnit('settler', spawn.x, spawn.y, 'player', rand),
    makeUnit('warrior', spawn.x, Math.max(0, spawn.y - 1), 'player', rand),
  ];

  const rivals = createRivals(world, rand, spawn);
  const techs = buildTechTree();

  // Seed chronicle with centuries of prior history
  const priorYears = [
    [18, 'The Kingdom of Eldoria is founded.', 'founding'],
    [72, 'The Great Plague spreads.', 'disaster'],
    [125, 'Queen Elara signs the Treaty of Rivers.', 'diplomacy'],
    [310, 'The First Airship is built.', 'discovery'],
    [400, 'Steam Engine invented in a forgotten age.', 'tech'],
  ];

  const state = {
    seed,
    rand,
    turn: 1,
    year: 1,
    calendarYear: 500 + Math.floor(rand() * 200),
    seasonIndex: 0,
    season: SEASONS[0],
    world,
    player,
    cities: [],
    units,
    rivals,
    nobles: createNobles(rand),
    parliament: [],
    citizens: [],
    legends: [],
    bonds: [],
    factions: [
      { id: 'crown', name: 'Crown', power: 40 },
      { id: 'trade', name: 'Trade', power: 25 },
      { id: 'steel', name: 'Steel', power: 20 },
      { id: 'reform', name: 'Reform', power: 10 },
      { id: 'shadow', name: 'Shadow', power: 5 },
    ],
    economy: {
      cycle: 'expansion',
      inflation: 0.02,
      prices: { food: 2, wood: 2, stone: 3, iron: 5 },
      bank: { deposits: 0, loan: 0 },
      companies: [],
      routes: [],
      guild: { dues: 5, reputation: 20, monopoly: false },
      blackMarket: { heat: 10, open: false },
      tradeProfit: 0,
    },
    wonders: WONDERS.map((w) => ({ ...w, owner: null, progress: 0, building: false })),
    techs,
    events: [],
    activeEvent: null,
    missions: [],
    crime: Object.fromEntries(CRIME_NETWORKS.map((n) => [n, { heat: 10 + Math.floor(rand() * 20), stance: 'fight' }])),
    faiths: RELIGIONS.map((r) => ({ ...r, spread: 10 + Math.floor(rand() * 20), reform: 0 })),
    greatPeople: [],
    myth: { dragons: [], wizards: [], relics: [], heroes: [], bosses: [] },
    space: { portLevel: 0, colonies: [], rockets: 0 },
    multi: { mode: 'solo', seats: [{ id: 'player', name: 'You' }], activeSeat: 0, worldName: 'Aetheria Prime' },
    mods: { enabled: ['jade_coast'], packs: [jadeCoastPack()] },
    legacy: { eras: [], livingWorlds: [] },
    victories: initVictories(),
    livingScore: { value: 40, streak: 0, history: [], pillars: {} },
    selectedUnitId: units[0].id,
    selectedCityId: null,
    selectedTab: 'realm',
    selectedRightTab: 'city',
    zoom: 'realm',
    look: { dayNight: 0.3, birds: true, seasonVisual: true },
    log: [],
    chronicle: [],
    tracks: [],
    raiders: createRaiders(world, rand, spawn),
    heir: null,
    election: null,
    gameOver: null,
    buildingsCatalog: BUILDINGS,
    unitsCatalog: UNITS,
    governors: GOVERNMENTS,
    governorList: GOVERNORS,
    archetypes: CITY_ARCHETYPES,
    spaceBodies: SPACE_BODIES,
  };

  for (const [y, text, cat] of priorYears) {
    state.chronicle.push({ year: y, turn: 0, text, category: cat, prior: true });
  }
  chronicle(state, 'The blank chronicle is opened for a new age.', 'founding');
  log(state, 'Your scout and settler stand ready. Explore, then found your first city.', 'system');

  // Place rival capitals fog-hidden
  for (const r of rivals) {
    revealFog(world, r.capital.x, r.capital.y, 1);
    // re-fog rival area for player - actually keep hidden
    const t = world.tiles[r.capital.y * world.width + r.capital.x];
    if (t) t.fog = true;
  }

  // Seed a Marcus-style rival legend
  state.legends.push(createMarcus(rand));

  maybeSpawnEvent(state, true);
  return state;
}

function makeUnit(type, x, y, owner, rand) {
  const def = UNITS[type];
  return {
    id: uid('unit'),
    type,
    name: def.name,
    x, y, owner,
    moves: def.moves,
    maxMoves: def.moves,
    vision: def.vision,
    atk: def.atk,
    hp: def.hp,
    maxHp: def.hp,
    xp: 0,
    rank: 'green',
    morale: 80,
    formation: 'line',
    supply: true,
    veteran: 0,
    tracks: [],
  };
}

function createRivals(world, rand, spawn) {
  const names = [
    { kingdom: 'Ashen Dominion', ruler: 'Queen Vexra', color: '#a33a3a' },
    { kingdom: 'Tideborn Compact', ruler: 'King Orlan', color: '#2f7f9e' },
    { kingdom: 'Sunreach Sultanate', ruler: 'Sultana Zahra', color: '#c9a24a' },
  ];
  return names.map((n, i) => {
    let capital = findSpawn(world, rand);
    let tries = 0;
    while (Math.abs(capital.x - spawn.x) + Math.abs(capital.y - spawn.y) < 18 && tries++ < 50) {
      capital = findSpawn(world, rand);
    }
    return {
      id: `rival_${i}`,
      ...n,
      capital,
      opinion: 0,
      atWar: false,
      alliance: false,
      trade: false,
      embargo: false,
      access: false,
      marriage: false,
      hostage: false,
      memory: [],
      mind: {
        ambitions: pick(rand, [['expand borders'], ['amass gold'], ['seek knowledge'], ['crush rivals']]),
        fears: pick(rand, [['betrayal'], ['famine'], ['your armies'], ['loss of face']]),
        pride: 40 + Math.floor(rand() * 50),
        greed: 30 + Math.floor(rand() * 50),
        honor: 30 + Math.floor(rand() * 50),
        intelligence: 40 + Math.floor(rand() * 50),
        patience: 20 + Math.floor(rand() * 60),
        aggression: 20 + Math.floor(rand() * 60),
        unforgiving: rand() > 0.6,
      },
      wondersBuilt: 0,
      spaceRace: [],
    };
  });
}

function createNobles(rand) {
  return Array.from({ length: 5 }, () => ({
    id: uid('noble'),
    house: houseName(rand),
    head: personName(rand),
    loyalty: 40 + Math.floor(rand() * 40),
    power: 10 + Math.floor(rand() * 30),
    ambition: 20 + Math.floor(rand() * 60),
    corruption: Math.floor(rand() * 40),
    faction: pick(rand, ['crown', 'trade', 'steel', 'reform', 'shadow']),
    mind: {
      pride: Math.floor(rand() * 100),
      greed: Math.floor(rand() * 100),
      honor: Math.floor(rand() * 100),
      patience: Math.floor(rand() * 100),
    },
    memories: [],
  }));
}

function createRaiders(world, rand, spawn) {
  const list = [];
  for (let i = 0; i < 5; i++) {
    const p = findSpawn(world, rand);
    if (Math.abs(p.x - spawn.x) + Math.abs(p.y - spawn.y) < 8) continue;
    list.push({
      id: uid('raid'),
      name: 'Ashen Raiders',
      x: p.x, y: p.y,
      hp: 12, atk: 3, alive: true,
    });
  }
  return list;
}

function createMarcus(rand) {
  return {
    id: 'marcus',
    name: 'Marcus',
    title: 'The Scarred',
    role: 'general',
    status: 'escaped',
    loyalty: -40,
    personality: ['ruthless', 'ambitious', 'patient'],
    ambitions: ['revenge'],
    fears: ['humiliation'],
    strengths: ['tactics'],
    weaknesses: ['pride'],
    reputation: 30,
    relationships: {},
    memories: [
      { year: 0, text: 'Defeated in battle and escaped with a scar.', weight: 20 },
    ],
    goals: ['command another kingdom', 'avenge defeat'],
    scars: ['cheek scar'],
    family: { spouse: null, children: [] },
    story: 'Once your foe on the field. He escaped death and plots return.',
  };
}

function initVictories() {
  return {
    military: { progress: 0, goal: 4, done: false },
    science: { progress: 0, goal: 2, done: false },
    economy: { progress: 0, goal: 4, done: false },
    culture: { progress: 0, goal: 3, done: false },
    diplomacy: { progress: 0, goal: 3, done: false },
    exploration: { progress: 0, goal: 2, done: false },
    environment: { progress: 0, goal: 3, done: false },
    legend: { progress: 0, goal: 3, done: false },
  };
}

function jadeCoastPack() {
  return {
    id: 'jade_coast',
    name: 'Jade Coast Pack',
    civilizations: [{ id: 'jade', name: 'Jade Coast Realm', bonus: { trade: 5 } }],
    buildings: [{ id: 'pearl_market', name: 'Pearl Market', cost: { wood: 15, gold: 10 }, turns: 2, gold: 4 }],
    technologies: [{ id: 'pearl_diving', name: 'Pearl Diving', age: 'Stone', pillar: 'Trade', cost: 20 }],
    maps: [{ id: 'jade_isles', name: 'Jade Isles' }],
    campaigns: [{ id: 'pearl_voyage', name: 'The Pearl Voyage' }],
    units: [{ id: 'pearl_diver', name: 'Pearl Diver', cost: { food: 8 }, moves: 2, vision: 3, atk: 1, hp: 8 }],
    quests: [{ id: 'pearl_voyage', name: 'The Pearl Voyage', progress: 0, goal: 5 }],
  };
}

export function foundCity(state, unit) {
  if (unit.type !== 'settler') return false;
  if (state.cities.some((c) => Math.abs(c.x - unit.x) + Math.abs(c.y - unit.y) < 3)) {
    log(state, 'Too close to another city.', 'warn');
    return false;
  }
  const arch = pick(state.rand, CITY_ARCHETYPES);
  const city = {
    id: uid('city'),
    name: state.cities.length === 0 ? 'Aralon' : `${pick(state.rand, ['River', 'Stone', 'Oak', 'Gold', 'Dawn'])}${pick(state.rand, ['haven', 'ford', 'wick', 'mont', 'mere'])}`,
    x: unit.x,
    y: unit.y,
    owner: 'player',
    population: 12,
    housing: 16,
    happiness: 65,
    crime: 10,
    education: 15,
    healthcare: 15,
    faith: 25,
    buildings: ['town_hall', 'house'],
    queue: [],
    governor: null,
    archetype: arch,
    stage: 'village',
    foodStore: 10,
    planted: false,
    harvestReady: false,
  };
  state.cities.push(city);
  state.selectedCityId = city.id;
  // Remove settler
  state.units = state.units.filter((u) => u.id !== unit.id);
  generateCitizens(state, city, city.population);
  autoRoads(state.world, state.cities);
  revealFog(state.world, city.x, city.y, 4);
  log(state, `${city.name} founded (${arch}).`, 'founding');
  chronicle(state, `Kingdom city ${city.name} founded.`, 'founding');
  if (state.cities.length === 1) {
    chronicle(state, `${state.player.name} founded.`, 'founding');
  }
  updateCityStage(city);
  return true;
}

export function generateCitizens(state, city, count) {
  for (let i = 0; i < count; i++) {
    const age = 5 + Math.floor(state.rand() * 55);
    const c = {
      id: uid('cit'),
      name: personName(state.rand),
      age,
      cityId: city.id,
      family: `Family ${Math.floor(state.rand() * 40)}`,
      occupation: pick(state.rand, ['farmer', 'crafter', 'trader', 'scholar', 'guard', 'priest', 'child']),
      wealth: Math.floor(state.rand() * 40),
      personality: pick(state.rand, ['kind', 'stern', 'curious', 'greedy', 'brave', 'wary']),
      friends: [],
      rivals: [],
      health: 60 + Math.floor(state.rand() * 40),
      home: `${city.name} cottage`,
      routine: pick(state.rand, ['works fields', 'tends market', 'studies', 'patrols', 'prays', 'rests']),
      mood: 50 + Math.floor(state.rand() * 30),
    };
    state.citizens.push(c);
  }
}

export function updateCityStage(city) {
  if (city.population >= 120 || city.buildings.includes('walls') && city.population >= 60) city.stage = 'capital';
  else if (city.population >= 60) city.stage = 'city';
  else if (city.population >= 30) city.stage = 'town';
  else city.stage = 'village';
}

export function canAfford(res, cost) {
  return Object.entries(cost || {}).every(([k, v]) => (res[k] || 0) >= v);
}

export function pay(res, cost) {
  for (const [k, v] of Object.entries(cost || {})) res[k] = (res[k] || 0) - v;
}

export function maybeSpawnEvent(state, force = false) {
  if (state.activeEvent) return;
  if (!force && state.rand() > 0.12) return;
  const ev = pick(state.rand, WORLD_EVENTS);
  state.activeEvent = {
    ...ev,
    decisions: [
      { id: 'endure', label: 'Endure', effect: 'mild' },
      { id: 'spend', label: 'Spend Gold', effect: 'gold' },
      { id: 'mobilize', label: 'Mobilize', effect: 'unrest' },
    ],
  };
  log(state, `World Event: ${ev.name}`, 'event');
  chronicle(state, ev.name, 'event');
}

export { makeUnit, clamp };
