export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const TERRAIN = {
  water: { color: '#1f4f6a', move: 99, name: 'Ocean' },
  coast: { color: '#3a7a8e', move: 1, name: 'Coast' },
  grass: { color: '#4c9450', move: 1, name: 'Grassland' },
  forest: { color: '#2d6a38', move: 2, name: 'Forest' },
  hill: { color: '#7d9148', move: 2, name: 'Highlands' },
  mountain: { color: '#8e8e8e', move: 3, name: 'Mountain' },
  desert: { color: '#d0ad6e', move: 2, name: 'Desert' },
  snow: { color: '#e4eef5', move: 2, name: 'Snow' },
  swamp: { color: '#4a6d52', move: 2, name: 'Swamp' },
  volcano: { color: '#8f3d2c', move: 3, name: 'Volcano' },
  jungle: { color: '#1c5a32', move: 2, name: 'Jungle' },
  ruins: { color: '#6e5b4a', move: 1, name: 'Ancient Ruins' },
};

export const BUILDINGS = {
  town_hall: { name: 'Town Hall', cost: { wood: 0 }, turns: 0, once: true, desc: 'Seat of rule' },
  house: { name: 'House', cost: { wood: 12 }, turns: 1, housing: 10, desc: '+10 housing' },
  tenement: { name: 'Tenement', cost: { wood: 24, stone: 12 }, turns: 2, housing: 35, desc: '+35 housing' },
  farm: { name: 'Farm', cost: { wood: 10 }, turns: 1, food: 5, desc: '+5 food / turn' },
  lumber_mill: { name: 'Lumber Mill', cost: { wood: 14, stone: 6 }, turns: 1, wood: 4, desc: '+4 wood / turn' },
  quarry: { name: 'Quarry', cost: { wood: 12 }, turns: 1, stone: 3, desc: '+3 stone / turn' },
  mine: { name: 'Mine', cost: { wood: 14, stone: 10 }, turns: 2, iron: 2, gold: 1, desc: '+2 iron, +1 gold' },
  barracks: { name: 'Barracks', cost: { wood: 18, stone: 18 }, turns: 2, desc: 'Train warriors' },
  marketplace: { name: 'Marketplace', cost: { wood: 16, gold: 12 }, turns: 2, gold: 4, desc: '+4 gold / turn' },
  school: { name: 'School', cost: { wood: 16, stone: 12 }, turns: 2, science: 3, desc: '+3 science' },
  walls: { name: 'City Walls', cost: { stone: 35, wood: 12 }, turns: 3, defense: 8, desc: 'Fortify city' },
  temple: { name: 'Temple', cost: { wood: 14, stone: 18 }, turns: 2, happiness: 6, desc: '+happiness' },
  dockyard: { name: 'Dockyard', cost: { wood: 28, stone: 12 }, turns: 3, coast: true, desc: 'Build ships' },
  wonder_yard: { name: 'Wonder Yard', cost: { stone: 40, gold: 40 }, turns: 3, desc: 'Begin wonders' },
};

export const UNITS = {
  scout: { name: 'Scout', cost: { food: 6, gold: 4 }, moves: 4, vision: 4, atk: 1, hp: 10, role: 'explore', glyph: 'S' },
  worker: { name: 'Worker', cost: { food: 10 }, moves: 2, vision: 2, atk: 0, hp: 8, role: 'work', glyph: 'W' },
  settler: { name: 'Settler', cost: { food: 28, wood: 12, gold: 12 }, moves: 2, vision: 2, atk: 0, hp: 12, role: 'settle', glyph: 'Z' },
  warrior: { name: 'Warrior', cost: { food: 12, iron: 2, gold: 6 }, moves: 2, vision: 2, atk: 5, hp: 20, role: 'war', glyph: 'A' },
  archer: { name: 'Archer', cost: { food: 10, wood: 8, gold: 6 }, moves: 2, vision: 3, atk: 4, hp: 14, role: 'war', glyph: 'R' },
  galley: { name: 'Galley', cost: { wood: 30, gold: 10 }, moves: 3, vision: 3, atk: 4, hp: 22, role: 'naval', glyph: 'G', naval: true },
};

export const TECHS = [
  { id: 'agriculture', name: 'Agriculture', cost: 20, unlocks: ['farm'], desc: 'Better farms' },
  { id: 'forestry', name: 'Forestry', cost: 25, unlocks: ['lumber_mill'], desc: 'Lumber mills' },
  { id: 'masonry', name: 'Masonry', cost: 30, unlocks: ['quarry', 'walls'], desc: 'Stone works & walls' },
  { id: 'mining', name: 'Mining', cost: 35, requires: ['masonry'], unlocks: ['mine'], desc: 'Extract iron & gold' },
  { id: 'writing', name: 'Writing', cost: 40, unlocks: ['school'], desc: 'Schools & records' },
  { id: 'bronze_working', name: 'Bronze Working', cost: 45, requires: ['mining'], unlocks: ['warrior'], desc: 'Stronger infantry' },
  { id: 'archery', name: 'Archery', cost: 40, requires: ['forestry'], unlocks: ['archer'], desc: 'Ranged troops' },
  { id: 'sailing', name: 'Sailing', cost: 50, requires: ['forestry'], unlocks: ['dockyard', 'galley'], desc: 'Ships & docks' },
  { id: 'currency', name: 'Currency', cost: 55, requires: ['writing'], unlocks: ['marketplace'], desc: 'Markets thrive' },
  { id: 'theology', name: 'Theology', cost: 50, requires: ['writing'], unlocks: ['temple'], desc: 'Temples' },
  { id: 'engineering', name: 'Engineering', cost: 70, requires: ['masonry', 'writing'], unlocks: ['wonder_yard'], desc: 'Great projects' },
  { id: 'iron_working', name: 'Iron Working', cost: 80, requires: ['bronze_working'], desc: '+1 warrior attack' },
  { id: 'cartography', name: 'Cartography', cost: 60, requires: ['writing'], desc: 'Scouts +1 vision' },
  { id: 'guilds', name: 'Guilds', cost: 90, requires: ['currency'], desc: '+2 gold from markets' },
  { id: 'philosophy', name: 'Philosophy', cost: 100, requires: ['writing', 'theology'], desc: '+happiness nationwide' },
];

export const WONDERS = [
  { id: 'pyramid', name: 'Great Pyramid', cost: { stone: 60, gold: 30 }, turns: 8, bonus: 'prestige' },
  { id: 'gardens', name: 'Hanging Gardens', cost: { wood: 40, food: 40, gold: 25 }, turns: 7, bonus: 'food' },
  { id: 'library', name: 'Infinite Library', cost: { stone: 45, gold: 40 }, turns: 8, bonus: 'science' },
  { id: 'colossus', name: 'Colossus', cost: { stone: 40, iron: 20, gold: 35 }, turns: 7, bonus: 'gold' },
];

export const EVENTS = [
  { id: 'bountiful', name: 'Bountiful Harvest', good: true, text: 'The fields overflow.', effect: { food: 25 } },
  { id: 'caravan', name: 'Merchant Caravan', good: true, text: 'Traders bring coin.', effect: { gold: 20 } },
  { id: 'ruins_map', name: 'Ruins Map', good: true, text: 'An old map reveals a site.', effect: { lore: 10, revealSite: true } },
  { id: 'raiders', name: 'Raider Sighting', good: false, text: 'Hostile bands grow bold.', effect: { spawnRaiders: 2 } },
  { id: 'storm', name: 'Great Storm', good: false, text: 'Storms batter the land.', effect: { wood: -10, food: -8 } },
  { id: 'plague', name: 'Creeping Plague', good: false, text: 'Illness spreads in towns.', effect: { happiness: -12, pop: -2 } },
  { id: 'festival', name: 'Royal Festival', good: true, text: 'The people cheer.', effect: { happiness: 15, gold: -10 } },
  { id: 'meteor', name: 'Sky Stone', good: true, text: 'A glowing stone falls.', effect: { iron: 8, lore: 8 } },
];

export const CONTINENTS = [
  { id: 'verdoria', name: 'Verdoria', color: '#3f8f4a', blurb: 'Rich farmland and forests — ideal for beginners.', resources: ['Wheat', 'Wood', 'Horses', 'Clay'] },
  { id: 'ashkar', name: 'Ashkar', color: '#c45a3a', blurb: 'Volcanic and dangerous, but rich in metals and gems.', resources: ['Iron', 'Coal', 'Gold', 'Gems'] },
  { id: 'frostheim', name: 'Frostheim', color: '#5b8fb8', blurb: 'Frozen frontiers. Harsh winters, rare crystals.', resources: ['Fur', 'Ice Crystal', 'Silver', 'Fish'] },
  { id: 'sunreach', name: 'Sunreach', color: '#d4a24c', blurb: 'Desert empires, pyramids, and buried relics.', resources: ['Salt', 'Incense', 'Oil', 'Relics'] },
  { id: 'emerald', name: 'Emerald Isles', color: '#2f9e8f', blurb: 'Island chains built for naval power.', resources: ['Pearls', 'Fish', 'Coral', 'Fruit'] },
  { id: 'shadow', name: 'Shadow Wilds', color: '#4a4658', blurb: 'Corrupted wilds. Late-game exploration.', resources: ['Moonstone', 'Mythril', 'Relics'] },
];

export const TUTORIAL = [
  { id: 'move', title: 'Explore', body: 'Select your Scout (S). Click a nearby tile or use arrow keys / WASD to move and clear fog.' },
  { id: 'settle', title: 'Found a City', body: 'Select the Settler (Z) on open land and press F — or use Found City in the actions bar.' },
  { id: 'build', title: 'Build & Train', body: 'Open the City panel. Queue Farms, Mills, and Barracks. Train Workers and Warriors.' },
  { id: 'gather', title: 'Gather', body: 'Move a Worker onto a colored deposit and press G to gather resources.' },
  { id: 'turn', title: 'End Turn', body: 'When your moves are spent, hit End Turn. Seasons change, cities produce, rivals act.' },
];
