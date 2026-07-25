export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const TERRAIN = {
  water: { color: '#2a5f7a', move: 99, name: 'Ocean' },
  coast: { color: '#3d7a8c', move: 1, name: 'Coast' },
  grass: { color: '#4a8f4e', move: 1, name: 'Grassland' },
  forest: { color: '#2f6b3a', move: 2, name: 'Forest' },
  hill: { color: '#7a8f4a', move: 2, name: 'Highlands' },
  mountain: { color: '#8a8a8a', move: 3, name: 'Mountain' },
  desert: { color: '#c9a86c', move: 2, name: 'Desert' },
  snow: { color: '#dfe8ef', move: 2, name: 'Snow' },
  swamp: { color: '#4a6b4f', move: 2, name: 'Swamp' },
  volcano: { color: '#8b3a2a', move: 3, name: 'Volcano' },
  jungle: { color: '#1f5c34', move: 2, name: 'Jungle' },
  ruins: { color: '#6b5a4a', move: 1, name: 'Ancient Ruins' },
};

export const RESOURCES = ['food', 'wood', 'stone', 'gold', 'iron', 'coal', 'wheat', 'flour', 'bread', 'weapons', 'mana', 'lore'];

export const BUILDINGS = {
  town_hall: { name: 'Town Hall', cost: { wood: 20, stone: 10 }, turns: 1, once: true },
  house: { name: 'House', cost: { wood: 10 }, turns: 1, housing: 8 },
  tenement: { name: 'Tenement', cost: { wood: 20, stone: 10 }, turns: 2, housing: 40 },
  farm: { name: 'Farm', cost: { wood: 8 }, turns: 1, food: 4, wheat: 2 },
  lumber_mill: { name: 'Lumber Mill', cost: { wood: 12, stone: 4 }, turns: 1, wood: 3 },
  quarry: { name: 'Quarry', cost: { wood: 10 }, turns: 1, stone: 3 },
  mine: { name: 'Mine', cost: { wood: 12, stone: 8 }, turns: 2, iron: 2 },
  coal_pit: { name: 'Coal Pit', cost: { wood: 10, stone: 6 }, turns: 2, coal: 2 },
  mill: { name: 'Mill', cost: { wood: 14, stone: 6 }, turns: 2, converts: { wheat: 2, flour: 2 } },
  bakery: { name: 'Bakery', cost: { wood: 12, stone: 8 }, turns: 2, converts: { flour: 2, bread: 2, food: 3 } },
  blacksmith: { name: 'Blacksmith', cost: { wood: 10, stone: 14, iron: 2 }, turns: 2, converts: { iron: 1, coal: 1, weapons: 1 } },
  barracks: { name: 'Barracks', cost: { wood: 15, stone: 15 }, turns: 2 },
  marketplace: { name: 'Marketplace', cost: { wood: 12, gold: 10 }, turns: 2, gold: 3 },
  school: { name: 'School', cost: { wood: 14, stone: 10 }, turns: 2, education: 8, science: 2 },
  academy: { name: 'Academy', cost: { wood: 20, stone: 20, gold: 20 }, turns: 3, education: 15, science: 6 },
  clinic: { name: 'Clinic', cost: { wood: 12, stone: 10 }, turns: 2, healthcare: 10 },
  temple: { name: 'Temple', cost: { wood: 14, stone: 16 }, turns: 2, faith: 10 },
  watch_post: { name: 'Watch Post', cost: { wood: 10, stone: 8 }, turns: 1, crimeDown: 8 },
  granary: { name: 'Granary', cost: { wood: 16, stone: 8 }, turns: 2, foodStore: 20 },
  walls: { name: 'City Walls', cost: { stone: 30, wood: 10 }, turns: 3, fort: 10 },
  fort: { name: 'Fort', cost: { stone: 40, wood: 15, iron: 5 }, turns: 4, fort: 20, supply: true },
  dockyard: { name: 'Dockyard', cost: { wood: 25, stone: 10 }, turns: 3, coast: true },
  balloon_works: { name: 'Balloon Works', cost: { wood: 20, iron: 8, gold: 25 }, turns: 4 },
  mercenary_camp: { name: 'Mercenary Camp', cost: { gold: 30, wood: 10 }, turns: 2 },
  bank: { name: 'Bank', cost: { stone: 25, gold: 40 }, turns: 3 },
  guild_hall: { name: 'Guild Hall', cost: { wood: 20, stone: 20, gold: 25 }, turns: 3 },
  warehouse: { name: 'Warehouse', cost: { wood: 18, stone: 12 }, turns: 2 },
  cartographer: { name: 'Cartographer\'s Hall', cost: { wood: 16, gold: 20 }, turns: 2 },
  spaceport: { name: 'Spaceport', cost: { iron: 40, stone: 40, gold: 80 }, turns: 6, age: 'Space' },
  magic_school: { name: 'Magic School', cost: { stone: 20, gold: 30 }, turns: 3, fantasy: true, mana: 4 },
};

export const UNITS = {
  scout: { name: 'Scout', cost: { food: 5, gold: 5 }, moves: 3, vision: 3, atk: 1, hp: 8, class: 'explore' },
  worker: { name: 'Worker', cost: { food: 8 }, moves: 2, vision: 2, atk: 0, hp: 6, class: 'work' },
  settler: { name: 'Settler', cost: { food: 20, wood: 10, gold: 10 }, moves: 2, vision: 2, atk: 0, hp: 10, class: 'settle' },
  warrior: { name: 'Warrior', cost: { food: 10, weapons: 1 }, moves: 2, vision: 2, atk: 4, hp: 16, class: 'war' },
  explorer: { name: 'Explorer', cost: { food: 10, gold: 15 }, moves: 3, vision: 4, atk: 2, hp: 12, class: 'explore' },
  galley: { name: 'Galley', cost: { wood: 25, weapons: 1 }, moves: 3, vision: 3, atk: 5, hp: 20, naval: true, class: 'war' },
  balloon: { name: 'War Balloon', cost: { wood: 20, iron: 5, gold: 30 }, moves: 4, vision: 4, atk: 3, hp: 14, air: true, class: 'war' },
  mercenary: { name: 'Mercenary', cost: { gold: 40 }, moves: 2, vision: 2, atk: 5, hp: 18, class: 'war' },
};

export const CITY_ARCHETYPES = [
  'Agrarian', 'Mercantile', 'Devout', 'Fortified', 'Learned', 'Frontier',
];

export const GOVERNORS = [
  { id: 'mira', name: 'Mira the Fair', bonus: { happiness: 8 } },
  { id: 'bram', name: 'Bram Ironhand', bonus: { production: 1.1 } },
  { id: 'lyra', name: 'Lyra Quill', bonus: { education: 10 } },
  { id: 'kael', name: 'Kael Watch', bonus: { crimeDown: 10 } },
  { id: 'oren', name: 'Oren Ledger', bonus: { gold: 2 } },
  { id: 'vessa', name: 'Vessa Flame', bonus: { faith: 10 } },
];

export const LAWS = [
  { id: 'levy', name: 'War Levy', effect: { military: 1, happiness: -4 } },
  { id: 'charter', name: 'Merchant Charter', effect: { gold: 2, crime: 2 } },
  { id: 'tithe', name: 'Sacred Tithe', effect: { faith: 8, gold: -1 } },
  { id: 'schools', name: 'Compulsory Schools', effect: { education: 8, gold: -2 } },
  { id: 'amnesty', name: 'Royal Amnesty', effect: { crime: -6, unrest: -4 } },
  { id: 'curfew', name: 'Night Curfew', effect: { crime: -8, happiness: -3 } },
];

export const RELIGIONS = [
  { id: 'verdant', name: 'Verdant Circle', mood: 'nature' },
  { id: 'solar', name: 'Solar Covenant', mood: 'order' },
  { id: 'tide', name: 'Tideborn Faith', mood: 'trade' },
  { id: 'ash', name: 'Ashflame Creed', mood: 'war' },
  { id: 'star', name: 'Starlit Path', mood: 'lore' },
];

export const GOVERNMENTS = [
  { id: 'absolute', name: 'Absolute Monarchy', elections: false },
  { id: 'constitutional', name: 'Constitutional Monarchy', elections: true },
  { id: 'republic', name: 'Republic', elections: true },
  { id: 'oligarchy', name: 'Oligarchy', elections: false },
];

export const FORMATIONS = ['line', 'column', 'wedge', 'square', 'skirmish'];

export const WONDERS = [
  { id: 'pyramid', name: 'Great Pyramid', cost: { stone: 80, gold: 40 }, turns: 8, age: 'Stone', bonus: { prestige: 20 } },
  { id: 'gardens', name: 'Hanging Gardens', cost: { wood: 40, food: 40, gold: 30 }, turns: 7, age: 'Bronze', bonus: { happiness: 15 } },
  { id: 'world_tree', name: 'World Tree', cost: { wood: 100, lore: 20 }, turns: 10, age: 'Iron', bonus: { nature: 20 } },
  { id: 'library', name: 'Infinite Library', cost: { stone: 60, gold: 50 }, turns: 9, age: 'Middle Ages', bonus: { science: 10 } },
  { id: 'sky_fortress', name: 'Sky Fortress', cost: { iron: 50, stone: 60, gold: 60 }, turns: 10, age: 'Renaissance', bonus: { military: 15 } },
  { id: 'moon_elevator', name: 'Moon Elevator', cost: { iron: 80, gold: 100 }, turns: 12, age: 'Space', bonus: { space: 25 } },
  { id: 'planetary_shield', name: 'Planetary Shield', cost: { iron: 100, gold: 120 }, turns: 14, age: 'Interstellar', bonus: { defense: 30 } },
  { id: 'colossus', name: 'Colossus', cost: { stone: 50, iron: 20, gold: 40 }, turns: 8, age: 'Iron', bonus: { trade: 10 } },
  { id: 'oracle', name: 'Oracle Spire', cost: { stone: 40, gold: 40 }, turns: 7, age: 'Bronze', bonus: { lore: 15 } },
  { id: 'clockwork', name: 'Clockwork Heart', cost: { iron: 40, gold: 50 }, turns: 9, age: 'Industrial', bonus: { production: 15 } },
  { id: 'celestial', name: 'Celestial Archive', cost: { stone: 70, gold: 70 }, turns: 10, age: 'Near Future', bonus: { science: 15 } },
  { id: 'beacon', name: 'Eternal Beacon', cost: { gold: 90, lore: 30 }, turns: 11, age: 'Modern', bonus: { culture: 20 } },
];

export const WONDER_SITES = [
  'lost_city', 'ancient_temple', 'giant_cave', 'underground_kingdom',
  'floating_island', 'pirate_cove', 'hidden_continent', 'secret_civilization',
  'ancient_library', 'underwater_ruins', 'secret_valley',
];

export const AGES = [
  'Stone', 'Bronze', 'Iron', 'Middle Ages', 'Renaissance',
  'Industrial', 'Modern', 'Near Future', 'Space', 'Interstellar',
];

export const TECH_PILLARS = ['Craft', 'War', 'Civic', 'Trade', 'Lore', 'Explore', 'Nature', 'Arcana'];

export const KEYSTONES = {
  Writing: { age: 'Bronze', pillar: 'Lore' },
  Steam: { age: 'Industrial', pillar: 'Craft' },
  Starflight: { age: 'Space', pillar: 'Explore' },
  'Interstellar Ascension': { age: 'Interstellar', pillar: 'Lore' },
};

export const SPACE_BODIES = [
  { id: 'moon', name: 'Moon', cost: 40 },
  { id: 'mars', name: 'Mars', cost: 60 },
  { id: 'asteroids', name: 'Asteroid Belt', cost: 50 },
  { id: 'venus', name: 'Venus', cost: 70 },
  { id: 'europa', name: 'Europa', cost: 75 },
  { id: 'titan', name: 'Titan', cost: 80 },
  { id: 'proxima', name: 'Proxima b', cost: 100 },
];

export const WORLD_EVENTS = [
  { id: 'famine', name: 'Great Famine', pressure: { food: -20, happiness: -10 } },
  { id: 'civil_war', name: 'Civil War Sparks', pressure: { unrest: 20, gold: -15 } },
  { id: 'meteor', name: 'Meteor Impact', pressure: { mapScar: true } },
  { id: 'earthquake', name: 'Earthquake', pressure: { stone: -10, unrest: 8 } },
  { id: 'religion', name: 'Religious Movement', pressure: { faith: 15, unrest: 5 } },
  { id: 'gold_rush', name: 'Gold Rush', pressure: { gold: 40, crime: 10 } },
  { id: 'pirates', name: 'Pirate Age', pressure: { tradeRisk: 0.3 } },
  { id: 'migration', name: 'Massive Migration', pressure: { population: 20 } },
  { id: 'disease', name: 'New Disease', pressure: { health: -15, population: -10 } },
  { id: 'continent', name: 'Discovery of a New Continent', pressure: { lore: 25, explore: true } },
];

export const MISSION_TYPES = [
  'noble_land', 'flood_relief', 'trade_venture', 'dragon_pass', 'military_aid',
  'raider_clear', 'disease_relief', 'gold_claim',
];

export const CRIME_NETWORKS = ['bandits', 'smugglers', 'pirates', 'corrupt_officials', 'assassins'];

export const WILDLIFE = [
  { id: 'wolves', name: 'Wolves', color: '#8a8a8a', behavior: 'hunt' },
  { id: 'deer', name: 'Deer', color: '#a67c52', behavior: 'migrate' },
  { id: 'bears', name: 'Bears', color: '#6b4a2a', behavior: 'defend' },
  { id: 'birds', name: 'Birds', color: '#7eb0c9', behavior: 'signal' },
  { id: 'fish', name: 'Fish', color: '#3d7a8c', behavior: 'stocks' },
];

export const GREAT_KINDS = [
  { id: 'inventor', name: 'Inventor', buff: 'science' },
  { id: 'artist', name: 'Artist', buff: 'happiness' },
  { id: 'scientist', name: 'Scientist', buff: 'education' },
  { id: 'merchant', name: 'Merchant', buff: 'gold' },
  { id: 'general', name: 'General', buff: 'morale' },
  { id: 'explorer', name: 'Explorer', buff: 'lore' },
];

export const CULTURE_TRAITS = [
  'architecture', 'clothing', 'music', 'festivals', 'cuisine',
  'military', 'art', 'language',
];

export const ROADMAP = `Stages 1–34 Roadmap
1 Foundations · 2 Kingdom Management · 3 Living Citizens
4 Politics · 5 Diplomacy · 6 Warfare · 7 Economy
8 Exploration · 9 Technology · 10 Wonders · 11 Dynamic History
12 Living AI · 13 World Evolves · 14 Magic & Myth · 15 Space
16 Multiplayer · 17 Mod Support · 18 Legacy System
19 Legacy Lords · 20 Visual Style · 21 World Events
22 Dynamic Missions · 23 Culture · 24 Seasons
25 Character Bonds · 26 Crime · 27 Religion · 28 Wildlife
29 Exploration Depth · 30 Great People · 31 Natural Economy
32 World Chronicle · 33 Victory Paths · 34 Living World Score`;

/** Generate a large tech tree (~2020 entries condensed into representative nodes). */
export function buildTechTree() {
  const techs = [];
  let n = 0;
  for (const age of AGES) {
    for (const pillar of TECH_PILLARS) {
      for (let i = 1; i <= 25; i++) {
        n += 1;
        techs.push({
          id: `${age}_${pillar}_${i}`.replace(/\s+/g, '_'),
          name: `${age} ${pillar} ${i}`,
          age,
          pillar,
          cost: 10 + AGES.indexOf(age) * 12 + i * 2,
          requires: i > 1 ? [`${age}_${pillar}_${i - 1}`.replace(/\s+/g, '_')] : [],
        });
      }
    }
  }
  for (const [name, meta] of Object.entries(KEYSTONES)) {
    techs.push({
      id: name.replace(/\s+/g, '_'),
      name,
      age: meta.age,
      pillar: meta.pillar,
      cost: 80 + AGES.indexOf(meta.age) * 20,
      keystone: true,
      requires: [],
    });
  }
  return techs;
}
