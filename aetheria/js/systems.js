import {
  SEASONS, BUILDINGS, UNITS, LAWS, FORMATIONS, GREAT_KINDS, MISSION_TYPES, AGES,
} from './data.js';
import { evolveWorld, revealFog, tileAt, autoRoads } from './world.js';
import {
  log, chronicle, pick, clamp, uid, personName, dist,
} from './utils.js';
import {
  canAfford, pay, makeUnit, generateCitizens, updateCityStage, maybeSpawnEvent,
} from './state.js';

export function endTurn(state) {
  // Season advance every turn for snappy play
  state.seasonIndex = (state.seasonIndex + 1) % 4;
  state.season = SEASONS[state.seasonIndex];
  if (state.seasonIndex === 0) {
    state.year += 1;
    state.calendarYear += 1;
  }
  state.turn += 1;

  refreshUnitMoves(state);
  runEconomy(state);
  runCities(state);
  runCitizens(state);
  runPolitics(state);
  runDiplomacyAI(state);
  runWarfareUpkeep(state);
  runTech(state);
  runWondersAI(state);
  runExplorationTick(state);
  runWorldEvolve(state);
  runWildlife(state);
  runCrime(state);
  runFaith(state);
  runMissions(state);
  runGreatPeople(state);
  runBonds(state);
  runMyth(state);
  runSpaceAI(state);
  runMods(state);
  runLegends(state);
  updateLivingScore(state);
  checkVictories(state);
  maybeSpawnEvent(state);
  maybeSpawnMission(state);

  if (state.season === 'Spring') log(state, 'Spring — plant crops near cities.', 'season');
  if (state.season === 'Summer') log(state, 'Summer — travel is swift; food is plentiful.', 'season');
  if (state.season === 'Autumn') log(state, 'Autumn — harvest and store for winter.', 'season');
  if (state.season === 'Winter') log(state, 'Winter — rivers freeze; food grows scarce.', 'season');
}

function refreshUnitMoves(state) {
  const bonus = state.season === 'Summer' ? 1 : state.season === 'Winter' ? -1 : 0;
  for (const u of state.units) {
    u.moves = Math.max(1, u.maxMoves + bonus);
    // supply check
    const nearCity = state.cities.some((c) => dist(c, u) <= 5) ||
      state.cities.some((c) => c.buildings.includes('fort') && dist(c, u) <= 8);
    u.supply = nearCity;
    if (!u.supply) {
      u.morale = Math.max(10, u.morale - 8);
      u.atk = Math.max(1, Math.floor((UNITS[u.type]?.atk || u.atk) * 0.75));
    } else {
      u.morale = Math.min(100, u.morale + 3);
      u.atk = UNITS[u.type]?.atk || u.atk;
    }
  }
}

function runEconomy(state) {
  const e = state.economy;
  const cycles = ['expansion', 'peak', 'recession', 'recovery'];
  if (state.rand() < 0.15) {
    e.cycle = cycles[(cycles.indexOf(e.cycle) + 1) % cycles.length];
    log(state, `Market cycle shifts to ${e.cycle}.`, 'economy');
  }
  e.inflation = clamp(e.inflation + (e.cycle === 'peak' ? 0.01 : e.cycle === 'recession' ? -0.005 : 0.002), 0, 0.25);
  for (const k of Object.keys(e.prices)) {
    const supply = state.player.resources[k] || 0;
    e.prices[k] = clamp(Math.round((2 + (50 - supply) * 0.05) * (1 + e.inflation)), 1, 30);
  }
  if (e.bank.deposits > 0) {
    const interest = Math.floor(e.bank.deposits * 0.03);
    state.player.resources.gold += interest;
  }
  if (e.bank.loan > 0) {
    const due = Math.ceil(e.bank.loan * 0.05);
    if (state.player.resources.gold >= due) {
      state.player.resources.gold -= due;
      e.bank.loan = Math.max(0, e.bank.loan - Math.floor(due * 0.4));
    } else {
      state.player.unrest += 5;
      log(state, 'Loan payment missed — unrest rises.', 'economy');
    }
  }
  let profit = 0;
  for (const route of e.routes.filter((r) => r.active)) {
    const risk = state.activeEvent?.id === 'pirates' ? 0.35 : 0.1;
    if (state.rand() < risk) {
      log(state, `Pirates strike the ${route.name} route!`, 'economy');
      continue;
    }
    const gain = 8 + Math.floor(state.rand() * 12);
    profit += gain;
    state.player.resources.gold += gain;
    // import fill
    if (route.good) state.player.resources[route.good] = (state.player.resources[route.good] || 0) + 2;
  }
  for (const co of e.companies) {
    const g = 5 + Math.floor(state.rand() * 8);
    profit += g;
    state.player.resources.gold += g;
  }
  e.tradeProfit += profit;
  if (e.blackMarket.open) {
    state.player.resources.gold += 6;
    e.blackMarket.heat += 5;
    if (e.blackMarket.heat > 70 && state.rand() < 0.3) {
      log(state, 'Black market raid! Heat resets, gold seized.', 'crime');
      state.player.resources.gold = Math.max(0, state.player.resources.gold - 20);
      e.blackMarket.heat = 20;
    }
  }
  // taxes
  const pop = state.citizens.length;
  const taxGold = Math.floor(pop * (state.player.taxes / 100) * 0.4);
  state.player.resources.gold += taxGold;
  state.player.happiness = clamp(state.player.happiness - Math.floor(state.player.taxes / 10) + 2, 0, 100);
}

function runCities(state) {
  const foodMult = state.season === 'Summer' ? 1.55 : state.season === 'Winter' ? 0.4 : 1;
  for (const city of state.cities) {
    let food = 2;
    let wood = 0;
    let stone = 0;
    let gold = 0;
    let iron = 0;
    let coal = 0;
    let science = 0;
    for (const b of city.buildings) {
      const def = BUILDINGS[b] || state.mods.packs.flatMap((p) => p.buildings).find((x) => x.id === b);
      if (!def) continue;
      if (def.food) food += def.food;
      if (def.wood) wood += def.wood;
      if (def.stone) stone += def.stone;
      if (def.gold) gold += def.gold;
      if (def.iron) iron += def.iron;
      if (def.coal) coal += def.coal;
      if (def.science) science += def.science;
      if (def.wheat) state.player.resources.wheat += def.wheat;
      if (def.education) city.education = clamp(city.education + 1, 0, 100);
      if (def.healthcare) city.healthcare = clamp(city.healthcare + 1, 0, 100);
      if (def.faith) city.faith = clamp(city.faith + 1, 0, 100);
      if (def.crimeDown) city.crime = clamp(city.crime - 1, 0, 100);
      if (def.housing) {/* already counted */}
      if (def.converts) {
        const c = def.converts;
        if (c.wheat && state.player.resources.wheat >= c.wheat) {
          state.player.resources.wheat -= c.wheat;
          state.player.resources.flour += c.flour || 0;
        }
        if (c.flour && state.player.resources.flour >= c.flour) {
          state.player.resources.flour -= c.flour;
          state.player.resources.bread = (state.player.resources.bread || 0) + (c.bread || 0);
          food += c.food || 0;
        }
        if (c.iron && state.player.resources.iron >= (c.iron || 0) && state.player.resources.coal >= (c.coal || 0)) {
          state.player.resources.iron -= c.iron || 0;
          state.player.resources.coal -= c.coal || 0;
          state.player.resources.weapons += c.weapons || 0;
        }
      }
      if (def.mana && state.player.fantasy) state.player.resources.mana += def.mana;
    }
    // bread as food
    if ((state.player.resources.bread || 0) > 0) {
      const eat = Math.min(3, state.player.resources.bread);
      state.player.resources.bread -= eat;
      food += eat;
    }
    food = Math.floor(food * foodMult);
    if (state.season === 'Spring' && city.planted) food += 2;
    if (state.season === 'Autumn' && city.harvestReady) {
      food += 8;
      city.foodStore += 10;
      city.harvestReady = false;
      log(state, `${city.name} harvests the fields.`, 'season');
    }
    if (state.season === 'Winter' && city.foodStore > 0) {
      city.foodStore -= 2;
      food += 2;
    }
    state.player.resources.food += food;
    state.player.resources.wood += wood;
    state.player.resources.stone += stone;
    state.player.resources.gold += gold;
    state.player.resources.iron += iron;
    state.player.resources.coal += coal;
    state.player.science += science + Math.floor(city.education / 20);

    // housing
    city.housing = 8;
    for (const b of city.buildings) {
      const def = BUILDINGS[b];
      if (def?.housing) city.housing += def.housing;
    }

    // growth
    const growthChance = (city.happiness + city.healthcare + (100 - city.crime)) / 400;
    if (city.population < city.housing && state.rand() < growthChance) {
      city.population += 1;
      generateCitizens(state, city, 1);
    } else if (city.happiness < 25 && state.rand() < 0.2 && city.population > 5) {
      city.population -= 1;
      const idx = state.citizens.findIndex((c) => c.cityId === city.id);
      if (idx >= 0) state.citizens.splice(idx, 1);
    }

    city.happiness = clamp(
      40 + city.healthcare * 0.2 + city.faith * 0.15 - city.crime * 0.3 - state.player.taxes * 0.5
      + (state.player.laws.includes('amnesty') ? 4 : 0),
      0, 100,
    );
    updateCityStage(city);

    // build queue
    if (city.queue.length) {
      const job = city.queue[0];
      job.left -= 1;
      if (job.left <= 0) {
        if (job.kind === 'building') {
          city.buildings.push(job.id);
          log(state, `${city.name} completed ${BUILDINGS[job.id]?.name || job.id}.`, 'build');
          if (job.id === 'balloon_works') chronicle(state, 'The First Airship is built.', 'discovery');
        } else if (job.kind === 'unit') {
          const u = makeUnit(job.id, city.x, city.y, 'player', state.rand);
          state.units.push(u);
          log(state, `${city.name} trained ${u.name}.`, 'train');
        } else if (job.kind === 'wonder') {
          const w = state.wonders.find((x) => x.id === job.id);
          if (w && !w.owner) {
            w.owner = 'player';
            w.progress = w.turns;
            log(state, `Wonder completed: ${w.name}!`, 'wonder');
            chronicle(state, `${w.name} completed by ${state.player.name}.`, 'wonder');
          }
        }
        city.queue.shift();
      }
    }
  }
  state.player.happiness = state.cities.length
    ? Math.round(state.cities.reduce((s, c) => s + c.happiness, 0) / state.cities.length)
    : state.player.happiness;
}

function runCitizens(state) {
  for (const c of state.citizens) {
    c.age += state.seasonIndex === 0 ? 1 : 0;
    c.health = clamp(c.health + (state.rand() - 0.45) * 6, 10, 100);
    c.wealth = clamp(c.wealth + Math.floor((state.rand() - 0.4) * 4), 0, 200);
    c.mood = clamp((c.health + c.wealth) / 2 + (state.rand() - 0.5) * 10, 0, 100);
    c.routine = pick(state.rand, ['works fields', 'tends market', 'studies', 'patrols', 'prays', 'rests', 'visits friends']);
    if (state.rand() < 0.05 && state.citizens.length > 2) {
      const other = pick(state.rand, state.citizens.filter((x) => x.id !== c.id));
      if (state.rand() < 0.6) {
        if (!c.friends.includes(other.id)) c.friends.push(other.id);
      } else if (!c.rivals.includes(other.id)) c.rivals.push(other.id);
    }
  }
}

function runPolitics(state) {
  // corruption skims gold
  const skim = Math.floor(state.player.resources.gold * (state.player.corruption / 500));
  if (skim > 0) {
    state.player.resources.gold -= skim;
  }
  for (const n of state.nobles) {
    n.loyalty = clamp(n.loyalty + (state.rand() - 0.48) * 6 - state.player.corruption * 0.05, 0, 100);
    if (n.ambition > 70 && n.loyalty < 30 && state.rand() < 0.08) {
      log(state, `${n.house} plots in court!`, 'politics');
      state.player.unrest += 8;
      chronicle(state, `${n.head} of ${n.house} stirs court intrigue.`, 'politics');
    }
  }
  state.player.corruption = clamp(state.player.corruption + (state.rand() - 0.5) * 3, 0, 100);
  state.player.unrest = clamp(state.player.unrest + (100 - state.player.happiness) * 0.02 - 1, 0, 100);

  // crises
  if (state.player.unrest > 70 && state.rand() < 0.12) {
    log(state, 'Rebellion flares in the countryside!', 'crisis');
    chronicle(state, 'Rebellion threatens the realm.', 'crisis');
    state.player.resources.gold = Math.max(0, state.player.resources.gold - 15);
    state.player.unrest -= 10;
  }
  if (state.nobles.some((n) => n.loyalty < 20 && n.power > 25) && state.rand() < 0.06) {
    log(state, 'Coup attempt in the capital!', 'crisis');
    chronicle(state, 'A coup attempt shakes the court.', 'crisis');
    state.player.unrest += 15;
  }
  if (state.rand() < 0.03) {
    const victim = pick(state.rand, state.nobles);
    log(state, `Assassination attempt on ${victim.head}!`, 'crisis');
    victim.loyalty -= 10;
  }
  if (!state.heir && state.player.government === 'absolute' && state.rand() < 0.04) {
    log(state, 'Succession crisis looms — name an heir.', 'crisis');
  }

  // elections
  if (state.election) {
    state.election.turnsLeft -= 1;
    if (state.election.turnsLeft <= 0) {
      const winner = state.election.candidates.sort((a, b) => b.funds - a.funds)[0];
      log(state, `Election result: ${winner.name} prevails.`, 'politics');
      chronicle(state, `${winner.name} wins the election.`, 'politics');
      state.election = null;
    }
  }
}

function runDiplomacyAI(state) {
  for (const r of state.rivals) {
    const m = r.mind;
    // personality-weighted opinion drift
    if (r.atWar) {
      r.opinion -= 2;
      if (m.patience > 60 && m.honor > 50 && state.rand() < 0.08) {
        log(state, `${r.ruler} considers peace — patience tempers pride.`, 'diplo');
      }
    } else {
      r.opinion += (m.honor - m.aggression) * 0.01;
    }
    // memory effects
    for (const mem of r.memory.slice(-5)) {
      if (mem.kind === 'insult' && m.unforgiving) r.opinion -= 1;
      if (mem.kind === 'gift') r.opinion += m.greed > 50 ? 0.5 : 0.2;
      if (mem.kind === 'broken' && m.honor > 40) r.opinion -= 2;
    }
    r.opinion = clamp(r.opinion, -100, 100);

    // AI actions
    if (!r.atWar && r.opinion < -40 && m.aggression > 55 && state.rand() < 0.1) {
      r.atWar = true;
      r.memory.push({ kind: 'war', text: 'Declared war', turn: state.turn });
      log(state, `${r.kingdom} declares war!`, 'war');
      chronicle(state, `War begins with ${r.kingdom}.`, 'war');
      if (!state.chronicle.some((c) => c.text.includes('First Great War'))) {
        chronicle(state, 'First Great War begins.', 'war');
      }
    }
  }
}

function runWarfareUpkeep(state) {
  for (const u of state.units.filter((x) => x.class === 'war' || UNITS[x.type]?.class === 'war')) {
    if (u.xp > 20) u.rank = 'seasoned';
    if (u.xp > 50) u.rank = 'veteran';
    if (u.xp > 100) u.rank = 'legendary';
  }
  // raiders wander
  for (const r of state.raiders.filter((x) => x.alive)) {
    r.x = clamp(r.x + pick(state.rand, [-1, 0, 1]), 0, state.world.width - 1);
    r.y = clamp(r.y + pick(state.rand, [-1, 0, 1]), 0, state.world.height - 1);
  }
}

function runTech(state) {
  if (!state.player.researchQueue.length) return;
  const id = state.player.researchQueue[0];
  const tech = state.techs.find((t) => t.id === id);
  if (!tech) return;
  state.player.science += 1;
  const need = tech.cost;
  if (state.player.science >= need) {
    state.player.science -= need;
    state.player.researched.push(id);
    state.player.researchQueue.shift();
    log(state, `Researched ${tech.name}.`, 'tech');
    if (tech.keystone) chronicle(state, `${tech.name} discovered.`, 'tech');
    if (tech.name === 'Steam' || tech.id.includes('Steam')) chronicle(state, 'Steam Engine invented.', 'tech');
    if (tech.name === 'Starflight') chronicle(state, 'Humanity reaches for the stars.', 'tech');
    if (tech.name === 'Interstellar Ascension') chronicle(state, 'Humanity reaches space.', 'tech');
    // age flavor
    const ageIdx = AGES.indexOf(tech.age);
    if (ageIdx >= 0 && state.rand() < 0.2) chronicle(state, `The age of ${tech.age} deepens.`, 'tech');
  }
}

function runWondersAI(state) {
  for (const w of state.wonders.filter((x) => !x.owner)) {
    if (state.rand() < 0.03) {
      const rival = pick(state.rand, state.rivals);
      w.progress += 1;
      if (w.progress >= w.turns) {
        w.owner = rival.id;
        rival.wondersBuilt += 1;
        log(state, `${rival.kingdom} completed ${w.name}!`, 'wonder');
        chronicle(state, `${w.name} claimed by ${rival.kingdom}.`, 'wonder');
      }
    }
  }
}

function runExplorationTick(state) {
  // Mid-game new sites
  if (state.year > 8 && state.rand() < 0.06) {
    const kinds = ['lost_city', 'ancient_library', 'secret_valley', 'underwater_ruins'];
    const kind = pick(state.rand, kinds);
    const x = Math.floor(state.rand() * state.world.width);
    const y = Math.floor(state.rand() * state.world.height);
    const t = tileAt(state.world.tiles, state.world.width, x, y);
    if (t && t.type !== 'water') {
      state.world.sites.push({
        id: uid('site'), kind, x, y, discovered: false, delved: false, progress: 0,
        risk: 0.3, loot: { gold: 20, lore: 15 }, late: true,
      });
      log(state, 'Rumors speak of a newly uncovered site...', 'explore');
    }
  }
}

function runWorldEvolve(state) {
  const changes = evolveWorld(state);
  for (const c of changes.slice(0, 2)) {
    log(state, c, 'world');
    if (c.includes('Volcano') || c.includes('Climate') || c.includes('river')) {
      chronicle(state, c, 'world');
    }
  }
}

function runWildlife(state) {
  for (const pack of state.world.wildlife) {
    if (pack.species === 'wolves') {
      for (const city of state.cities) {
        if (dist(pack, city) <= 3 && state.rand() < 0.25) {
          state.player.resources.food = Math.max(0, state.player.resources.food - 3);
          city.happiness -= 2;
          log(state, `Wolves hunt livestock near ${city.name}.`, 'wildlife');
        }
      }
    }
    if (pack.species === 'bears' && state.rand() < 0.1) {
      const u = state.units.find((x) => dist(x, pack) <= 1);
      if (u) {
        u.hp -= 2;
        log(state, `Bears maul ${u.name}!`, 'wildlife');
      }
    }
    if (pack.species === 'birds' && state.seasonIndex === 0) {
      log(state, 'Birds signal the turning of the season.', 'wildlife');
    }
    if (pack.species === 'fish') {
      pack.size = clamp(pack.size + pick(state.rand, [-1, 0, 1]), 1, 20);
    }
  }
}

function runCrime(state) {
  for (const [net, data] of Object.entries(state.crime)) {
    if (data.stance === 'fight') {
      data.heat = clamp(data.heat - 3, 0, 100);
      state.player.resources.gold = Math.max(0, state.player.resources.gold - 1);
    } else if (data.stance === 'negotiate') {
      data.heat = clamp(data.heat - 1, 0, 100);
      state.player.resources.gold = Math.max(0, state.player.resources.gold - 3);
    } else if (data.stance === 'benefit') {
      data.heat = clamp(data.heat + 4, 0, 100);
      state.player.resources.gold += 4;
      state.player.corruption += 1;
      for (const c of state.cities) c.crime = clamp(c.crime + 1, 0, 100);
    }
    if (data.heat > 80 && state.rand() < 0.15) {
      log(state, `${net.replace('_', ' ')} crisis erupts!`, 'crime');
      state.player.unrest += 6;
    }
  }
}

function runFaith(state) {
  const adopted = state.faiths.find((f) => f.id === state.player.religion);
  if (adopted) {
    adopted.spread += 1;
    for (const c of state.cities) {
      c.happiness = clamp(c.happiness + 1, 0, 100);
      c.faith = clamp(c.faith + 1, 0, 100);
    }
  }
  for (const f of state.faiths) {
    if (f.id !== state.player.religion && state.rand() < 0.08) {
      f.spread += 1;
      if (Math.abs(f.spread - (adopted?.spread || 0)) < 5) {
        state.player.unrest += 2;
        log(state, `Doctrinal tension with ${f.name}.`, 'faith');
      }
    }
    if (f.reform > 50 && state.rand() < 0.1) {
      log(state, `Reform movement within ${f.name}.`, 'faith');
    }
  }
  // shared creed diplomacy
  for (const r of state.rivals) {
    if (state.rand() < 0.05) r.opinion += 1;
  }
}

function runMissions(state) {
  for (const m of state.missions.filter((x) => x.status === 'active')) {
    m.turnsLeft -= 1;
    if (m.turnsLeft <= 0) {
      m.status = 'failed';
      state.player.unrest += 3;
      log(state, `Mission failed: ${m.name}`, 'mission');
      chronicle(state, `Mission failed — ${m.name}.`, 'mission');
    }
  }
}

function maybeSpawnMission(state) {
  if (state.missions.filter((m) => m.status === 'active').length >= 2) return;
  if (state.rand() > 0.18) return;
  const type = pick(state.rand, MISSION_TYPES);
  const names = {
    noble_land: 'A noble demands land',
    flood_relief: 'City requests flood aid',
    trade_venture: 'Merchants pitch a trade venture',
    dragon_pass: 'A dragon blocks a mountain pass',
    military_aid: 'Neighbor asks for military help',
    raider_clear: 'Clear Ashen Raiders',
    disease_relief: 'Contain an outbreak',
    gold_claim: 'Secure a gold claim',
  };
  if (type === 'dragon_pass' && !state.player.fantasy) return;
  const mission = {
    id: uid('mis'),
    type,
    name: names[type],
    status: 'offered',
    turnsLeft: 8,
    reward: { gold: 15 + Math.floor(state.rand() * 25), loyalty: 5 },
  };
  state.missions.push(mission);
  state.pendingMission = mission;
  log(state, `New mission: ${mission.name}`, 'mission');
}

function runGreatPeople(state) {
  if (state.cities.length && state.rand() < 0.1) {
    const kind = pick(state.rand, GREAT_KINDS);
    const city = pick(state.rand, state.cities);
    const gp = {
      id: uid('gp'),
      name: personName(state.rand),
      kind: kind.id,
      kindName: kind.name,
      cityId: city.id,
      support: 0,
      loyalty: 60,
      impact: kind.buff,
    };
    state.greatPeople.push(gp);
    log(state, `Great ${kind.name} emerges in ${city.name}: ${gp.name}.`, 'great');
    chronicle(state, `${gp.name} the ${kind.name} rises in ${city.name}.`, 'great');
  }
  for (const gp of state.greatPeople) {
    if (gp.support > 0) {
      if (gp.impact === 'science') state.player.science += 3;
      if (gp.impact === 'happiness') state.player.happiness = clamp(state.player.happiness + 2, 0, 100);
      if (gp.impact === 'education') for (const c of state.cities) c.education = clamp(c.education + 2, 0, 100);
      if (gp.impact === 'gold') state.player.resources.gold += 4;
      if (gp.impact === 'morale') for (const u of state.units) u.morale = clamp(u.morale + 2, 0, 100);
      if (gp.impact === 'lore') state.player.resources.lore += 2;
      gp.support -= 1;
    } else {
      gp.loyalty -= 2;
      if (gp.loyalty <= 0) {
        log(state, `${gp.name} leaves the realm, unsupported.`, 'great');
        gp.gone = true;
      }
    }
  }
  state.greatPeople = state.greatPeople.filter((g) => !g.gone);
}

function runBonds(state) {
  // simplified cast relationships
  if (state.bonds.length < 8 && state.nobles.length) {
    const a = pick(state.rand, state.nobles);
    const b = pick(state.rand, state.nobles);
    if (a.id !== b.id && !state.bonds.some((x) => x.a === a.id && x.b === b.id)) {
      const kind = pick(state.rand, ['friend', 'rival', 'love', 'faction']);
      state.bonds.push({ a: a.id, b: b.id, kind, strength: 20 + Math.floor(state.rand() * 40) });
    }
  }
  for (const bond of state.bonds) {
    if (bond.kind === 'betray' || (bond.kind === 'rival' && state.rand() < 0.05)) {
      state.player.unrest += 1;
    }
    if (bond.kind === 'friend' && state.rand() < 0.05) {
      const n = state.nobles.find((x) => x.id === bond.a);
      if (n) n.loyalty += 2;
    }
    if (bond.kind === 'love' && state.rand() < 0.03) {
      chronicle(state, 'A courtship blooms among the nobility.', 'bonds');
    }
    if (state.rand() < 0.04) bond.kind = 'betray';
  }
}

function runMyth(state) {
  if (!state.player.fantasy) {
    state.myth = { dragons: [], wizards: [], relics: [], heroes: [], bosses: [] };
    return;
  }
  if (state.myth.bosses.length < 3 && state.rand() < 0.08) {
    const bosses = ['Dragon of Ashkar', 'Phoenix of Sunreach', 'Leviathan of the Isles'];
    const name = bosses[state.myth.bosses.length] || 'Ancient Titan';
    state.myth.bosses.push({ id: uid('boss'), name, hp: 40, maxHp: 40, x: Math.floor(state.rand() * state.world.width), y: Math.floor(state.rand() * state.world.height) });
    log(state, `Myth awakens: ${name}!`, 'myth');
    if (name.includes('Dragon') && !state.chronicle.some((c) => c.text.includes('Dragon'))) {
      // prepare for first dragon defeat chronicle later
    }
  }
  if (state.myth.dragons.length < 2 && state.rand() < 0.1) {
    state.myth.dragons.push({ id: uid('drake'), name: 'Wild Drake', x: Math.floor(state.rand() * 40), y: Math.floor(state.rand() * 30) });
  }
  state.player.resources.mana += 1;
}

function runSpaceAI(state) {
  for (const r of state.rivals) {
    if (state.player.researched.includes('Starflight') || state.year > 20) {
      if (state.rand() < 0.05) {
        const body = pick(state.rand, state.spaceBodies);
        if (!state.space.colonies.includes(body.id) && !r.spaceRace.includes(body.id)) {
          // racing
          if (state.rand() < 0.3) {
            r.spaceRace.push(body.id);
            log(state, `${r.kingdom} plants a flag on ${body.name}!`, 'space');
          }
        }
      }
    }
  }
}

function runMods(state) {
  const pack = state.mods.packs.find((p) => state.mods.enabled.includes(p.id));
  if (!pack) return;
  for (const q of pack.quests || []) {
    if (q.progress < q.goal && state.rand() < 0.2) {
      q.progress += 1;
      if (q.progress >= q.goal) {
        log(state, `Mod quest complete: ${q.name}`, 'mod');
        state.player.resources.gold += 30;
        state.player.resources.lore += 10;
      }
    }
  }
}

function runLegends(state) {
  // Marcus return plot
  const marcus = state.legends.find((l) => l.id === 'marcus');
  if (marcus && marcus.status === 'escaped' && state.year >= 5 && state.rand() < 0.08) {
    marcus.status = 'returned';
    marcus.title = 'The Scarred Avenger';
    marcus.memories.push({ year: state.calendarYear, text: 'Returned commanding a rival host.', weight: 30 });
    const rival = state.rivals[0];
    rival.opinion -= 25;
    rival.memory.push({ kind: 'insult', text: 'Marcus swore revenge', turn: state.turn });
    log(state, 'Marcus returns — scarred, better armed, hungry for revenge!', 'legend');
    chronicle(state, 'Marcus returns seeking revenge.', 'legend');
  }

  // Peasant hero promotion from veteran units
  const hero = state.units.find((u) => u.rank === 'legendary' && !u.legendId);
  if (hero) {
    const legend = {
      id: uid('leg'),
      name: personName(state.rand),
      title: 'the Brave',
      role: 'general',
      status: 'active',
      unitId: hero.id,
      memories: [{ year: state.calendarYear, text: 'Rose from the ranks through impossible battles.', weight: 20 }],
      story: 'A peasant soldier whose legend the people tell.',
      loyalty: 80,
    };
    hero.legendId = legend.id;
    hero.name = legend.name;
    state.legends.push(legend);
    log(state, `${legend.name} ${legend.title} is celebrated by the people.`, 'legend');
    chronicle(state, `${legend.name} defended the realm against impossible odds.`, 'legend');
  }
}

function updateLivingScore(state) {
  const happiness = state.player.happiness;
  const wildlife = clamp(state.world.wildlife.length * 8 + state.world.wildlife.reduce((s, w) => s + w.size, 0), 0, 100);
  const trade = clamp(state.economy.routes.filter((r) => r.active).length * 20 + state.economy.companies.length * 15, 0, 100);
  const kingdoms = clamp(10 + (1 + state.rivals.filter((r) => !r.collapsed).length) * 18, 0, 100);
  const culture = clamp(state.player.syncretism + state.player.prestige, 0, 100);
  const landmarks = clamp(state.wonders.filter((w) => w.owner).length * 12 + state.world.sites.filter((s) => s.delved).length * 5, 0, 100);
  const prosperity = clamp(state.player.resources.gold / 3 + state.cities.reduce((s, c) => s + c.population, 0) / 2, 0, 100);
  const pillars = { happiness, wildlife, trade, kingdoms, culture, landmarks, prosperity };
  const value = Math.round(Object.values(pillars).reduce((a, b) => a + b, 0) / 7);
  state.livingScore.pillars = pillars;
  state.livingScore.value = value;
  state.livingScore.history.push(value);
  if (state.livingScore.history.length > 40) state.livingScore.history.shift();
  if (value >= 75) {
    state.livingScore.streak += 1;
    if (state.livingScore.streak >= 5 && !state.livingScore.thriving) {
      state.livingScore.thriving = true;
      chronicle(state, 'The world thrives — a living age of prosperity.', 'living');
      log(state, 'Achievement: Thriving World (Living Score 75+ for 5 seasons).', 'living');
    }
  } else state.livingScore.streak = 0;
}

function checkVictories(state) {
  const v = state.victories;
  // Military
  const raidersDown = state.raiders.filter((r) => !r.alive).length;
  const forts = state.cities.filter((c) => c.buildings.includes('walls') || c.buildings.includes('fort')).length;
  const vets = state.units.filter((u) => u.rank === 'veteran' || u.rank === 'legendary').length;
  v.military.progress = Math.min(4, (raidersDown >= 3 ? 1 : 0) + (state.cities.length >= 2 ? 1 : 0) + (vets >= 1 ? 1 : 0) + (forts >= 1 ? 1 : 0));

  // Science
  const star = state.player.researched.includes('Starflight') || state.player.researched.some((id) => id.includes('Starflight'));
  const ascend = state.player.researched.includes('Interstellar_Ascension') || state.player.researched.some((id) => id.includes('Interstellar'));
  v.science.progress = (star ? 1 : 0) + (ascend || state.space.colonies.length >= 3 ? 1 : 0);

  // Economy
  v.economy.progress = Math.min(4,
    (state.economy.companies.length >= 2 ? 1 : 0) +
    (state.economy.routes.filter((r) => r.active).length >= 3 ? 1 : 0) +
    (state.economy.tradeProfit >= 200 ? 1 : 0) +
    (state.player.resources.gold >= 80 ? 1 : 0));

  // Culture
  v.culture.progress = Math.min(3,
    (state.player.prestige >= 40 ? 1 : 0) +
    (state.player.syncretism >= 30 ? 1 : 0) +
    (state.player.happiness >= 70 ? 1 : 0));

  // Diplomacy
  const friends = state.rivals.filter((r) => r.alliance || r.marriage);
  v.diplomacy.progress = Math.min(3,
    (friends.length >= state.rivals.length ? 1 : 0) +
    (state.rivals.every((r) => !r.atWar) ? 1 : 0) +
    (state.chronicle.filter((c) => c.category === 'diplomacy').length >= 3 ? 1 : 0));

  // Exploration
  const delvedKinds = new Set(state.world.sites.filter((s) => s.delved).map((s) => s.kind));
  v.exploration.progress = Math.min(2,
    (delvedKinds.size >= 8 ? 1 : 0) +
    (state.player.resources.lore >= 60 ? 1 : 0));

  // Environment
  const livestockSafe = state.player.happiness > 50;
  const fishOk = state.world.wildlife.filter((w) => w.species === 'fish').every((w) => w.size >= 3);
  v.environment.progress = Math.min(3,
    (livestockSafe ? 1 : 0) +
    (fishOk ? 1 : 0) +
    (state.world.wildlife.length >= 10 ? 1 : 0));

  // Legend
  v.legend.progress = Math.min(3,
    (state.wonders.filter((w) => w.owner === 'player').length >= 2 ? 1 : 0) +
    (state.legends.filter((l) => l.status === 'active').length >= 1 ? 1 : 0) +
    (state.myth.bosses.filter((b) => b.hp <= 0).length >= 1 || state.greatPeople.length >= 3 ? 1 : 0));

  for (const [key, path] of Object.entries(v)) {
    if (!path.done && path.progress >= path.goal) {
      path.done = true;
      state.gameOver = { path: key, title: `${key[0].toUpperCase()}${key.slice(1)} Victory` };
      chronicle(state, `Victory achieved through ${key}.`, 'victory');
      log(state, `VICTORY — ${key} path complete!`, 'victory');
    }
  }
}

export function queueBuilding(state, city, buildingId) {
  const def = BUILDINGS[buildingId];
  if (!def) return false;
  if (def.fantasy && !state.player.fantasy) {
    log(state, 'Enable Fantasy mode to build this.', 'warn');
    return false;
  }
  if (def.once && city.buildings.includes(buildingId)) return false;
  if (!canAfford(state.player.resources, def.cost)) {
    log(state, 'Not enough resources.', 'warn');
    return false;
  }
  pay(state.player.resources, def.cost);
  city.queue.push({ kind: 'building', id: buildingId, left: def.turns });
  log(state, `Queued ${def.name} in ${city.name}.`, 'build');
  return true;
}

export function queueUnit(state, city, unitId) {
  const def = UNITS[unitId];
  if (!def) return false;
  if (!city.buildings.includes('barracks') && ['warrior', 'mercenary'].includes(unitId)) {
    log(state, 'Need Barracks.', 'warn');
    return false;
  }
  if (unitId === 'galley' && !city.buildings.includes('dockyard')) {
    log(state, 'Need Dockyard.', 'warn');
    return false;
  }
  if (unitId === 'balloon' && !city.buildings.includes('balloon_works')) {
    log(state, 'Need Balloon Works.', 'warn');
    return false;
  }
  if (def.cost.weapons && (state.player.resources.weapons || 0) < def.cost.weapons) {
    log(state, 'Need weapons from a Blacksmith.', 'warn');
    return false;
  }
  if (!canAfford(state.player.resources, def.cost)) {
    log(state, 'Not enough resources.', 'warn');
    return false;
  }
  pay(state.player.resources, def.cost);
  city.queue.push({ kind: 'unit', id: unitId, left: 2 });
  log(state, `Training ${def.name} in ${city.name}.`, 'train');
  return true;
}

export function moveUnit(state, unit, x, y) {
  if (unit.moves <= 0) return false;
  if (x < 0 || y < 0 || x >= state.world.width || y >= state.world.height) return false;
  const t = tileAt(state.world.tiles, state.world.width, x, y);
  if (!t) return false;
  const frozen = state.season === 'Winter' && (t.type === 'water' || t.river);
  if (unit.naval || unit.type === 'galley') {
    if (!(t.type === 'water' || t.type === 'coast') || (frozen && !unit.air)) return false;
  } else if (!unit.air && unit.type !== 'balloon') {
    if (t.type === 'water' && !frozen) return false;
  }
  const cost = t.road ? 1 : 1;
  unit.x = x;
  unit.y = y;
  unit.moves -= cost;
  state.tracks.push({ x, y, life: 4 });
  revealFog(state.world, x, y, unit.vision);
  // discover sites
  for (const site of state.world.sites) {
    if (!site.discovered && dist(site, unit) <= 1) {
      site.discovered = true;
      log(state, `Discovered ${site.kind.replace(/_/g, ' ')}!`, 'explore');
      chronicle(state, `Discovered ${site.kind.replace(/_/g, ' ')}.`, 'explore');
    }
  }
  // combat vs raiders
  for (const r of state.raiders.filter((x) => x.alive)) {
    if (r.x === x && r.y === y && (UNITS[unit.type]?.atk || unit.atk) > 0) {
      resolveCombat(state, unit, r);
    }
  }
  // rival capital siege
  for (const rival of state.rivals) {
    if (rival.atWar && rival.capital.x === x && rival.capital.y === y && unit.atk > 0) {
      rival.siege = (rival.siege || 0) + 1;
      log(state, `Sieging ${rival.kingdom} capital (${rival.siege}/5)...`, 'war');
      if (rival.siege >= 5) {
        rival.collapsed = true;
        rival.atWar = false;
        log(state, `${rival.kingdom} falls!`, 'war');
        chronicle(state, `${rival.kingdom} falls after siege.`, 'war');
        state.player.prestige += 20;
      }
    }
  }
  return true;
}

function resolveCombat(state, unit, raider) {
  const terrainBonus = 1;
  const formBonus = unit.formation === 'wedge' ? 1.2 : unit.formation === 'square' ? 0.9 : 1;
  const dmg = Math.max(1, Math.floor(unit.atk * formBonus * terrainBonus * (unit.morale / 100)));
  raider.hp -= dmg;
  unit.hp -= Math.max(1, raider.atk - 1);
  unit.xp += 5;
  log(state, `${unit.name} fights Ashen Raiders (−${dmg}).`, 'war');
  if (raider.hp <= 0) {
    raider.alive = false;
    unit.xp += 10;
    log(state, 'Raider band defeated!', 'war');
    chronicle(state, 'Ashen Raiders broken in the field.', 'war');
  }
  if (unit.hp <= 0) {
    log(state, `${unit.name} is slain.`, 'war');
    // Marcus-style escape chance for named legends
    state.units = state.units.filter((u) => u.id !== unit.id);
  }
}

export function delveSite(state, unit, site) {
  if (site.delved) return;
  if (dist(unit, site) > 1) {
    log(state, 'Move adjacent to delve.', 'warn');
    return;
  }
  site.progress += 1;
  unit.moves = 0;
  if (state.rand() < site.risk) {
    unit.hp -= 3;
    log(state, 'Delve hazard! Unit wounded.', 'explore');
  }
  if (site.progress >= 3) {
    site.delved = true;
    state.player.resources.gold += site.loot.gold;
    state.player.resources.lore += site.loot.lore;
    log(state, `Delved ${site.kind.replace(/_/g, ' ')} — loot gained.`, 'explore');
    chronicle(state, `Expedition delved ${site.kind.replace(/_/g, ' ')}.`, 'explore');
    if (site.kind === 'secret_civilization') {
      const r = state.rivals[0];
      r.opinion += 15;
      r.memory.push({ kind: 'gift', text: 'Secret civilization tribute shared', turn: state.turn });
    }
  } else {
    log(state, `Delving... ${site.progress}/3`, 'explore');
  }
}

export function gatherDeposit(state, unit) {
  if (unit.type !== 'worker') {
    log(state, 'Workers gather deposits.', 'warn');
    return;
  }
  const dep = state.world.deposits.find((d) => d.x === unit.x && d.y === unit.y && d.amount > 0);
  if (!dep) {
    log(state, 'No deposit here.', 'warn');
    return;
  }
  const take = Math.min(5, dep.amount);
  dep.amount -= take;
  state.player.resources[dep.type] = (state.player.resources[dep.type] || 0) + take;
  unit.moves = 0;
  log(state, `Gathered ${take} ${dep.type}.`, 'economy');
}

export { FORMATIONS, LAWS, autoRoads, revealFog };
