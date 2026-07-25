import {
  BUILDINGS, UNITS, LAWS, RELIGIONS, GOVERNMENTS, FORMATIONS, SPACE_BODIES,
  CRIME_NETWORKS, CULTURE_TRAITS, ROADMAP, WONDERS,
} from './data.js';
import {
  queueBuilding, queueUnit, delveSite, gatherDeposit, endTurn,
} from './systems.js';
import { foundCity, canAfford, pay } from './state.js';
import { log, chronicle, clamp, pick, personName, dist } from './utils.js';
import { renderMap } from './render.js';

const LEFT_TABS = [
  'realm', 'court', 'diplo', 'war', 'econ', 'explore', 'tech', 'wonders',
  'history', 'myth', 'space', 'multi', 'mods', 'legacy', 'lords',
];
const RIGHT_TABS = [
  'city', 'people', 'look', 'events', 'missions', 'culture', 'seasons',
  'bonds', 'crime', 'faith', 'wildlife', 'great', 'chains', 'victory', 'living',
];

export function bindUI(app) {
  const { stateRef, canvas, redraw } = app;

  // tabs
  const leftTabs = document.getElementById('left-tabs');
  const rightTabs = document.getElementById('right-tabs');
  LEFT_TABS.forEach((t) => leftTabs.appendChild(tabBtn(t, () => {
    stateRef.current.selectedTab = t;
    renderPanels(stateRef.current);
  })));
  RIGHT_TABS.forEach((t) => rightTabs.appendChild(tabBtn(t, () => {
    stateRef.current.selectedRightTab = t;
    renderPanels(stateRef.current);
  })));

  document.getElementById('btn-end-turn').onclick = () => {
    endTurn(stateRef.current);
    refreshAll(app);
  };

  document.getElementById('btn-menu').onclick = () => {
    document.getElementById('menu-modal').classList.remove('hidden');
  };
  document.getElementById('btn-close-menu').onclick = () => {
    document.getElementById('menu-modal').classList.add('hidden');
  };
  document.getElementById('btn-roadmap').onclick = () => {
    const el = document.getElementById('roadmap');
    el.classList.toggle('hidden');
    el.textContent = ROADMAP;
  };
  document.getElementById('btn-new').onclick = () => {
    app.newGame();
    document.getElementById('menu-modal').classList.add('hidden');
  };
  document.getElementById('btn-save').onclick = () => app.save();
  document.getElementById('btn-load').onclick = () => app.load();
  document.getElementById('btn-export').onclick = () => app.exportSave();
  document.getElementById('btn-clear-campaign')?.addEventListener('click', () => app.clearCampaign());
  document.getElementById('btn-sign-out')?.addEventListener('click', () => app.signOut());
  document.getElementById('btn-account')?.addEventListener('click', () => {
    const session = app.getSession?.();
    const summary = document.getElementById('account-summary');
    if (summary && session) {
      summary.textContent = `Signed in as ${session.username} (${session.role}). This account persists across campaigns.`;
    }
    document.getElementById('menu-modal').classList.add('hidden');
    document.getElementById('account-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-account')?.addEventListener('click', () => {
    document.getElementById('account-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-change-pw')?.addEventListener('click', async () => {
    const err = document.getElementById('pw-error');
    const result = await app.changePassword(
      document.getElementById('pw-current').value,
      document.getElementById('pw-new').value,
    );
    if (!result.ok) {
      err.hidden = false;
      err.textContent = result.error;
      return;
    }
    err.hidden = true;
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value = '';
    alert('Password updated. Admin account remains saved.');
  });

  document.getElementById('btn-victory-close').onclick = () => {
    document.getElementById('victory-modal').classList.add('hidden');
  };
  document.getElementById('btn-seal-age').onclick = () => {
    app.sealAge();
    document.getElementById('victory-modal').classList.add('hidden');
  };

  document.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.onclick = () => {
      stateRef.current.zoom = btn.dataset.zoom;
      if (btn.dataset.zoom === 'street' && stateRef.current.cities[0]) {
        stateRef.current.selectedCityId = stateRef.current.cities[0].id;
      }
      redraw();
    };
  });

  canvas.addEventListener('click', (e) => {
    const state = stateRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * state.world.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * state.world.height);
    const unit = state.units.find((u) => u.id === state.selectedUnitId);
    const clickedUnit = state.units.find((u) => u.x === x && u.y === y);
    if (clickedUnit) {
      state.selectedUnitId = clickedUnit.id;
    } else if (unit) {
      app.moveSelected(x, y);
    }
    const city = state.cities.find((c) => c.x === x && c.y === y);
    if (city) state.selectedCityId = city.id;
    refreshAll(app);
  });

  window.addEventListener('keydown', (e) => {
    const state = stateRef.current;
    const unit = state.units.find((u) => u.id === state.selectedUnitId);
    if (!unit) return;
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      app.moveSelected(unit.x + d[0], unit.y + d[1]);
      refreshAll(app);
    }
    if (e.key === 'f' || e.key === 'F') {
      if (unit.type === 'settler') foundCity(state, unit);
      refreshAll(app);
    }
    if (e.key === 'g' || e.key === 'G') {
      gatherDeposit(state, unit);
      refreshAll(app);
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const order = ['continent', 'realm', 'street'];
    const state = stateRef.current;
    let i = order.indexOf(state.zoom);
    i = clamp(i + (e.deltaY > 0 ? -1 : 1), 0, 2);
    state.zoom = order[i];
    redraw();
  }, { passive: false });
}

function tabBtn(id, onClick) {
  const b = document.createElement('button');
  b.textContent = label(id);
  b.dataset.tab = id;
  b.onclick = onClick;
  return b;
}

function label(id) {
  return ({
    realm: 'Realm', court: 'Court', diplo: 'Diplo', war: 'War', econ: 'Econ',
    explore: 'Explore', tech: 'Tech', wonders: 'Wonders', history: 'History',
    myth: 'Myth', space: 'Space', multi: 'Multi', mods: 'Mods', legacy: 'Legacy',
    lords: 'Lords', city: 'City', people: 'People', look: 'Look', events: 'Events',
    missions: 'Missions', culture: 'Culture', seasons: 'Seasons', bonds: 'Bonds',
    crime: 'Crime', faith: 'Faith', wildlife: 'Wildlife', great: 'Great',
    chains: 'Chains', victory: 'Victory', living: 'Living',
  })[id] || id;
}

export function refreshAll(app) {
  const state = app.stateRef.current;
  renderResources(state);
  renderPanels(state);
  renderLog(state);
  renderDecision(app);
  app.redraw();
  if (state.gameOver) {
    document.getElementById('victory-title').textContent = state.gameOver.title;
    document.getElementById('victory-body').textContent = 'Seal the age to continue +500 years in the Legacy system, or keep playing.';
    document.getElementById('victory-modal').classList.remove('hidden');
  }
}

function renderResources(state) {
  const el = document.getElementById('resources');
  const r = state.player.resources;
  el.innerHTML = ['food', 'wood', 'stone', 'gold', 'iron', 'weapons', 'lore']
    .map((k) => `<span>${k}: <b>${r[k] || 0}</b></span>`).join('');
  document.getElementById('season-label').textContent = state.season;
  document.getElementById('year-label').textContent = `Year ${state.year} · Abs ${state.calendarYear}`;
}

function renderLog(state) {
  const el = document.getElementById('log');
  el.innerHTML = state.log.slice(0, 12).map((l) => `<div>Y${l.year}: ${l.msg}</div>`).join('');
}

function renderDecision(app) {
  const state = app.stateRef.current;
  const banner = document.getElementById('decision-banner');
  const ev = state.activeEvent;
  const mis = state.pendingMission;
  if (!ev && !mis) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  if (ev) {
    banner.innerHTML = `<strong>Event:</strong> ${ev.name}
      ${ev.decisions.map((d) => `<button data-d="${d.id}">${d.label}</button>`).join('')}`;
    banner.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        resolveEvent(state, btn.dataset.d);
        refreshAll(app);
      };
    });
  } else if (mis) {
    banner.innerHTML = `<strong>Mission:</strong> ${mis.name}
      <button data-a="accept">Accept</button>
      <button data-a="decline">Decline</button>`;
    banner.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.a === 'accept') {
          mis.status = 'active';
          log(state, `Accepted: ${mis.name}`, 'mission');
        } else {
          mis.status = 'declined';
          log(state, `Declined: ${mis.name}`, 'mission');
        }
        state.pendingMission = null;
        refreshAll(app);
      };
    });
  }
}

function resolveEvent(state, decision) {
  const ev = state.activeEvent;
  if (!ev) return;
  if (decision === 'spend') {
    state.player.resources.gold = Math.max(0, state.player.resources.gold - 20);
    state.player.unrest = clamp(state.player.unrest - 5, 0, 100);
  } else if (decision === 'mobilize') {
    state.player.unrest += 5;
    state.player.resources.weapons += 1;
  } else {
    applyPressure(state, ev.pressure);
  }
  log(state, `Royal decision on ${ev.name}: ${decision}`, 'event');
  state.activeEvent = null;
}

function applyPressure(state, p = {}) {
  if (p.food) state.player.resources.food = Math.max(0, state.player.resources.food + p.food);
  if (p.gold) state.player.resources.gold = Math.max(0, state.player.resources.gold + p.gold);
  if (p.unrest) state.player.unrest = clamp(state.player.unrest + p.unrest, 0, 100);
  if (p.happiness) state.player.happiness = clamp(state.player.happiness + p.happiness, 0, 100);
  if (p.lore) state.player.resources.lore += p.lore;
  if (p.population && state.cities[0]) {
    state.cities[0].population += p.population;
  }
  if (p.mapScar) {
    const t = state.world.tiles[Math.floor(state.rand() * state.world.tiles.length)];
    t.type = 'desert';
    t.ash = 3;
  }
}

export function renderPanels(state) {
  document.querySelectorAll('#left-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.selectedTab);
  });
  document.querySelectorAll('#right-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.selectedRightTab);
  });
  document.getElementById('left-panel').innerHTML = renderLeft(state);
  document.getElementById('right-panel').innerHTML = renderRight(state);
  wirePanelActions(state);
}

function renderLeft(state) {
  switch (state.selectedTab) {
    case 'realm': return realmPanel(state);
    case 'court': return courtPanel(state);
    case 'diplo': return diploPanel(state);
    case 'war': return warPanel(state);
    case 'econ': return econPanel(state);
    case 'explore': return explorePanel(state);
    case 'tech': return techPanel(state);
    case 'wonders': return wondersPanel(state);
    case 'history': return historyPanel(state);
    case 'myth': return mythPanel(state);
    case 'space': return spacePanel(state);
    case 'multi': return multiPanel(state);
    case 'mods': return modsPanel(state);
    case 'legacy': return legacyPanel(state);
    case 'lords': return lordsPanel(state);
    default: return '';
  }
}

function renderRight(state) {
  switch (state.selectedRightTab) {
    case 'city': return cityPanel(state);
    case 'people': return peoplePanel(state);
    case 'look': return lookPanel(state);
    case 'events': return eventsPanel(state);
    case 'missions': return missionsPanel(state);
    case 'culture': return culturePanel(state);
    case 'seasons': return seasonsPanel(state);
    case 'bonds': return bondsPanel(state);
    case 'crime': return crimePanel(state);
    case 'faith': return faithPanel(state);
    case 'wildlife': return wildlifePanel(state);
    case 'great': return greatPanel(state);
    case 'chains': return chainsPanel(state);
    case 'victory': return victoryPanel(state);
    case 'living': return livingPanel(state);
    default: return '';
  }
}

function realmPanel(state) {
  const p = state.player;
  return `<h3>Realm</h3>
    <div class="row"><span>Kingdom</span><b>${p.name}</b></div>
    <div class="row"><span>Taxes</span><b>${p.taxes}%</b></div>
    <div class="actions">
      <button data-act="tax-down">− Tax</button>
      <button data-act="tax-up">+ Tax</button>
    </div>
    <h4>Laws (max 3)</h4>
    ${LAWS.map((l) => `<div class="row"><span>${l.name}</span>
      <button data-act="law" data-id="${l.id}">${p.laws.includes(l.id) ? 'Repeal' : 'Enact'}</button></div>`).join('')}
    <h4>State Religion</h4>
    <select data-act="religion">${RELIGIONS.map((r) => `<option value="${r.id}" ${p.religion === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
    <h4>National Mood</h4>
    <div class="row"><span>Happiness</span><b>${p.happiness}</b></div>
    <div class="row"><span>Crime</span><b>${p.crime}</b></div>
    <div class="row"><span>Unrest</span><b>${p.unrest}</b></div>
    <div class="row"><span>Corruption</span><b>${p.corruption}</b></div>
    <p class="muted">Civ look: ${p.civLook}</p>`;
}

function courtPanel(state) {
  const gov = GOVERNMENTS.find((g) => g.id === state.player.government);
  return `<h3>Court</h3>
    <div class="row"><span>Government</span><b>${gov?.name}</b></div>
    <div class="actions">
      ${GOVERNMENTS.map((g) => `<button data-act="gov" data-id="${g.id}">${g.name}</button>`).join('')}
    </div>
    <h4>Nobles</h4>
    ${state.nobles.map((n) => `<div class="list-item">
      <b>${n.house}</b> — ${n.head}<br/>
      <span class="muted">Loyalty ${n.loyalty} · Power ${n.power} · ${n.faction}</span>
      <div class="actions">
        <button data-act="bribe" data-id="${n.id}">Bribe</button>
        <button data-act="exile" data-id="${n.id}">Exile</button>
        <button data-act="heir" data-id="${n.id}">Name Heir</button>
      </div>
    </div>`).join('')}
    <h4>Parliament / Elections</h4>
    ${gov?.elections ? `<button data-act="election">Call Election</button>
      ${state.election ? `<p>Election in progress (${state.election.turnsLeft} turns). Fund:
      ${state.election.candidates.map((c) => `<button data-act="fund" data-id="${c.id}">${c.name}</button>`).join('')}</p>` : ''}`
      : '<p class="muted">No elections under this government.</p>'}
    <div class="actions">
      <button data-act="crush">Crush Rebellion</button>
      <button data-act="negotiate-crisis">Negotiate</button>
    </div>`;
}

function diploPanel(state) {
  return `<h3>Diplomacy</h3>
    ${state.rivals.map((r) => `<div class="list-item">
      <b style="color:${r.color}">${r.kingdom}</b><br/>
      ${r.ruler} · Opinion ${Math.round(r.opinion)}
      ${r.atWar ? ' · <span style="color:var(--bad)">WAR</span>' : ''}
      ${r.alliance ? ' · Ally' : ''}
      <p class="muted">Mind: pride ${r.mind.pride}, greed ${r.mind.greed}, honor ${r.mind.honor}, patience ${r.mind.patience}${r.mind.unforgiving ? ', unforgiving' : ''}</p>
      <p class="muted">Ambitions: ${r.mind.ambitions.join(', ')} · Fears: ${r.mind.fears.join(', ')}</p>
      <p class="muted">Why: ${whyDecide(r)}</p>
      <div class="actions">
        <button data-act="gift" data-id="${r.id}">Gift</button>
        <button data-act="threat" data-id="${r.id}">Threat</button>
        <button data-act="ally" data-id="${r.id}">Alliance</button>
        <button data-act="trade" data-id="${r.id}">Trade</button>
        <button data-act="embargo" data-id="${r.id}">Embargo</button>
        <button data-act="access" data-id="${r.id}">Access</button>
        <button data-act="marry" data-id="${r.id}">Marriage</button>
        <button data-act="hostage" data-id="${r.id}">Hostage</button>
        <button data-act="war" data-id="${r.id}">War</button>
        <button data-act="peace" data-id="${r.id}">Peace</button>
        <button data-act="joint" data-id="${r.id}">Joint War</button>
        <button data-act="conference" data-id="${r.id}">Conference</button>
      </div>
      <details><summary>Memory</summary>${r.memory.slice(-8).map((m) => `<div class="muted">${m.kind}: ${m.text}</div>`).join('') || '—'}</details>
    </div>`).join('')}`;
}

function whyDecide(r) {
  if (r.opinion < -30 && r.mind.aggression > 50) return 'Aggression and grudges push toward conflict.';
  if (r.mind.honor > 60 && r.alliance) return 'Honor binds them to keep faith with allies.';
  if (r.mind.greed > 60) return 'Greed colors every trade and gift.';
  if (r.mind.patience > 60) return 'Patience may yet forgive an insult.';
  return 'Balanced calculation of pride and interest.';
}

function warPanel(state) {
  const u = state.units.find((x) => x.id === state.selectedUnitId);
  return `<h3>Warfare</h3>
    <p class="muted">Formations, supply, morale, veterans, sieges, naval & balloons, mercs.</p>
    ${u ? `<div class="row"><span>${u.name}</span><b>${u.formation} · ${u.rank}</b></div>
      <div class="row"><span>Morale / Supply</span><b>${u.morale} / ${u.supply ? 'OK' : 'CUT'}</b></div>
      <div class="actions">${FORMATIONS.map((f) => `<button data-act="form" data-id="${f}">${f}</button>`).join('')}</div>
      <button data-act="fortify">Fortify (+morale)</button>` : '<p>Select a unit.</p>'}
    <h4>Mercenaries</h4>
    <button data-act="merc">Hire Mercenary (40g)</button>
    <h4>Raiders</h4>
    <p>${state.raiders.filter((r) => r.alive).length} bands remain</p>`;
}

function econPanel(state) {
  const e = state.economy;
  return `<h3>Economy</h3>
    <div class="row"><span>Cycle</span><b>${e.cycle}</b></div>
    <div class="row"><span>Inflation</span><b>${(e.inflation * 100).toFixed(1)}%</b></div>
    <div class="row"><span>Trade profit</span><b>${e.tradeProfit}</b></div>
    <h4>Prices</h4>
    ${Object.entries(e.prices).map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}g</b></div>`).join('')}
    <h4>Bank</h4>
    <div class="row"><span>Deposits / Loan</span><b>${e.bank.deposits} / ${e.bank.loan}</b></div>
    <div class="actions">
      <button data-act="deposit">Deposit 20g</button>
      <button data-act="withdraw">Withdraw 20g</button>
      <button data-act="loan">Take Loan 40g</button>
    </div>
    <h4>Companies & Routes</h4>
    <button data-act="company">Found Company (50g)</button>
    <button data-act="route">Open Shipping Route (30g)</button>
    <p class="muted">${e.companies.length} companies · ${e.routes.filter((r) => r.active).length} routes</p>
    <h4>Guild / Black Market</h4>
    <button data-act="guild">Pay Guild Dues</button>
    <button data-act="black">${e.blackMarket.open ? 'Close' : 'Open'} Black Market</button>
    <p class="muted">Heat ${e.blackMarket.heat} · Rep ${e.guild.reputation}</p>`;
}

function explorePanel(state) {
  const sites = state.world.sites.filter((s) => s.discovered);
  const u = state.units.find((x) => x.id === state.selectedUnitId);
  return `<h3>Exploration</h3>
    <p class="muted">Fog hides deep sites until you stand beside them. Delve for lore & loot.</p>
    <div class="row"><span>Lore</span><b>${state.player.resources.lore}</b></div>
    <div class="row"><span>Sites found</span><b>${sites.length}/${state.world.sites.length}</b></div>
    ${sites.map((s) => `<div class="list-item">
      <b>${s.kind.replace(/_/g, ' ')}</b> (${s.x},${s.y}) ${s.delved ? '✓' : `${s.progress}/3`}
      ${!s.delved && u ? `<button data-act="delve" data-id="${s.id}">Delve</button>` : ''}
    </div>`).join('') || '<p class="muted">Scout the fog.</p>'}
    <button data-act="train-explorer">Note: build Cartographer's Hall & train Explorer</button>`;
}

function techPanel(state) {
  const ageOrder = [...new Set(state.techs.map((t) => t.age))];
  const q = state.player.researchQueue[0];
  const available = state.techs.filter((t) => {
    if (state.player.researched.includes(t.id)) return false;
    if (t.requires?.length && !t.requires.every((r) => state.player.researched.includes(r))) return false;
    return t.keystone || t.name.endsWith(' 1') || state.player.researched.length < 5 || state.rand() < 0; // show keystones + first in pillar
  }).filter((t, i) => t.keystone || i < 24).slice(0, 30);
  // Better filter: show unresearched keystones and next in each pillar/age lightly
  const show = [];
  for (const age of ageOrder.slice(0, 4)) {
    for (const pillar of ['Craft', 'War', 'Civic', 'Trade', 'Lore', 'Explore', 'Nature', 'Arcana']) {
      const next = state.techs.find((t) => t.age === age && t.pillar === pillar && !state.player.researched.includes(t.id) &&
        (!t.requires?.length || t.requires.every((r) => state.player.researched.includes(r))));
      if (next) show.push(next);
    }
  }
  for (const t of state.techs.filter((x) => x.keystone && !state.player.researched.includes(x.id))) show.push(t);

  return `<h3>Technology</h3>
    <div class="row"><span>Science</span><b>${state.player.science}</b></div>
    <div class="row"><span>Researched</span><b>${state.player.researched.length} / ${state.techs.length}</b></div>
    <div class="row"><span>Queue</span><b>${q ? state.techs.find((t) => t.id === q)?.name : '—'}</b></div>
    <input id="tech-search" placeholder="Search techs..." style="width:100%;margin:0.4rem 0;padding:0.35rem;background:#101914;border:1px solid var(--line);color:var(--text)"/>
    <div id="tech-list">${show.slice(0, 40).map((t) => `<div class="row">
      <span>${t.name} <span class="muted">(${t.age} · ${t.cost})</span></span>
      <button data-act="research" data-id="${t.id}">Queue</button>
    </div>`).join('')}</div>`;
}

function wondersPanel(state) {
  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  return `<h3>Wonders</h3>
    <p class="muted">Only one civilization can complete each wonder.</p>
    ${state.wonders.map((w) => `<div class="list-item">
      <b>${w.name}</b> — ${w.owner ? `claimed by ${w.owner}` : `${w.progress}/${w.turns} · ${w.age}`}
      ${!w.owner && city ? `<button data-act="wonder" data-id="${w.id}">Start in ${city.name}</button>` : ''}
    </div>`).join('')}`;
}

function historyPanel(state) {
  const entries = state.chronicle.slice().reverse().slice(0, 80);
  return `<h3>Chronicle</h3>
    <p class="muted">Absolute years of a living history.</p>
    <div class="actions">
      <button data-act="hist-filter" data-id="all">All</button>
      <button data-act="hist-filter" data-id="war">War</button>
      <button data-act="hist-filter" data-id="diplomacy">Diplo</button>
      <button data-act="hist-filter" data-id="discovery">Discovery</button>
    </div>
    <div id="chronicle-list">${entries.map((e) => `<div class="row"><span>Year ${e.year}</span><span>${e.text}</span></div>`).join('')}</div>`;
}

function mythPanel(state) {
  return `<h3>Magic & Myth</h3>
    <p>Mode: <b>${state.player.fantasy ? 'Fantasy' : 'Realistic'}</b></p>
    <button data-act="toggle-fantasy">${state.player.fantasy ? 'Disable Fantasy' : 'Enable Fantasy'}</button>
    ${state.player.fantasy ? `
      <div class="row"><span>Mana</span><b>${state.player.resources.mana}</b></div>
      <div class="row"><span>Dragons</span><b>${state.myth.dragons.length}</b></div>
      <div class="row"><span>Bosses</span><b>${state.myth.bosses.filter((b) => b.hp > 0).length}</b></div>
      <button data-act="fight-boss">Challenge Nearest Boss</button>
      <button data-act="summon-hero">Summon Legendary Hero (20 mana)</button>
    ` : '<p class="muted">Realistic mode clears dragons, wizards, relics, and bosses.</p>'}`;
}

function spacePanel(state) {
  return `<h3>Space Expansion</h3>
    <div class="row"><span>Spaceport</span><b>Lv ${state.space.portLevel}</b></div>
    <div class="row"><span>Rockets</span><b>${state.space.rockets}</b></div>
    <button data-act="spaceport">Upgrade Spaceport (80g, 20 iron)</button>
    <button data-act="rocket">Launch Rocket (40g)</button>
    <h4>Colonies</h4>
    ${SPACE_BODIES.map((b) => {
      const yours = state.space.colonies.includes(b.id);
      const rival = state.rivals.find((r) => r.spaceRace.includes(b.id));
      return `<div class="row"><span>${b.name}</span>
        <b>${yours ? 'Yours' : rival ? rival.kingdom : '—'}</b>
        ${!yours && !rival ? `<button data-act="colonize" data-id="${b.id}">Colonize</button>` : ''}</div>`;
    }).join('')}`;
}

function multiPanel(state) {
  return `<h3>Multiplayer</h3>
    <p>Mode: <b>${state.multi.mode}</b> · World: ${state.multi.worldName}</p>
    <div class="actions">
      <button data-act="mode-coop">Co-op Hotseat</button>
      <button data-act="mode-pvp">PvP Hotseat</button>
      <button data-act="mode-solo">Solo</button>
      <button data-act="massive">Massive World (96×66)</button>
    </div>
    <h4>Seats</h4>
    ${state.multi.seats.map((s, i) => `<div class="row"><span>${s.name}</span><b>${i === state.multi.activeSeat ? 'Active' : ''}</b></div>`).join('')}
    <button data-act="pass-seat">Pass Seat</button>`;
}

function modsPanel(state) {
  const pack = state.mods.packs[0];
  return `<h3>Mod Lab</h3>
    <p>${pack.name} ${state.mods.enabled.includes(pack.id) ? '(enabled)' : ''}</p>
    <button data-act="toggle-mod">Toggle Pack</button>
    <button data-act="export-mod">Export Pack JSON</button>
    <h4>Contents</h4>
    <p class="muted">Civs, buildings, techs, maps, campaigns, units, quests</p>
    ${(pack.quests || []).map((q) => `<div class="row"><span>${q.name}</span><b>${q.progress}/${q.goal}</b></div>`).join('')}`;
}

function legacyPanel(state) {
  return `<h3>Legacy</h3>
    <p class="muted">Seal an age; continue +500 years on the same remembered map.</p>
    <button data-act="seal">Seal Age Now</button>
    <h4>Eras</h4>
    ${state.legacy.eras.map((e) => `<div class="list-item"><b>${e.name}</b> — ${e.fate}<br/><button data-act="continue-era" data-id="${e.id}">Continue +500y</button></div>`).join('') || '<p class="muted">No sealed eras yet.</p>'}
    <h4>Living Worlds</h4>
    ${state.legacy.livingWorlds.map((w) => `<div class="muted">${w.name} · year ${w.year}</div>`).join('') || '—'}`;
}

function lordsPanel(state) {
  return `<h3>Legacy Lords</h3>
    ${state.legends.map((l) => `<div class="list-item">
      <b>${l.name}</b> ${l.title || ''} — ${l.role} (${l.status})
      <p class="muted">${l.story || ''}</p>
      <details><summary>Memories</summary>${(l.memories || []).map((m) => `<div>${m.text}</div>`).join('')}</details>
      <div class="actions">
        <button data-act="spare" data-id="${l.id}">Spare</button>
        <button data-act="land" data-id="${l.id}">Grant Land</button>
        <button data-act="promote" data-id="${l.id}">Promote</button>
        <button data-act="exile-lord" data-id="${l.id}">Exile</button>
        <button data-act="crown" data-id="${l.id}">Crown</button>
      </div>
    </div>`).join('') || '<p class="muted">Legends will rise from battle and court.</p>'}`;
}

function cityPanel(state) {
  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  const unit = state.units.find((u) => u.id === state.selectedUnitId);
  if (!city) {
    return `<h3>City</h3>
      <p class="muted">No city yet. Move Settler (Z) and press <b>F</b> to found.</p>
      ${unit ? `<p>Selected: ${unit.name} @ (${unit.x},${unit.y}) moves ${unit.moves}</p>
        <div class="actions">
          <button data-act="found">Found City</button>
          <button data-act="gather">Gather (Worker)</button>
        </div>` : ''}`;
  }
  return `<h3>${city.name}</h3>
    <div class="row"><span>Stage</span><b>${city.stage}</b></div>
    <div class="row"><span>Pop / Housing</span><b>${city.population}/${city.housing}</b></div>
    <div class="row"><span>Archetype</span><b>${city.archetype}</b></div>
    <div class="row"><span>Happy / Crime</span><b>${Math.round(city.happiness)} / ${city.crime}</b></div>
    <div class="row"><span>Edu / Health / Faith</span><b>${city.education}/${city.healthcare}/${city.faith}</b></div>
    <h4>Governor</h4>
    <select data-act="governor">${[['','None'], ...state.governorList.map((g) => [g.id, g.name])].map(([id, n]) => `<option value="${id}" ${city.governor === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <h4>Build</h4>
    <div class="actions">${Object.entries(BUILDINGS).slice(0, 20).map(([id, b]) => `<button data-act="build" data-id="${id}" title="${JSON.stringify(b.cost)}">${b.name}</button>`).join('')}</div>
    <details><summary>More buildings</summary><div class="actions">${Object.entries(BUILDINGS).slice(20).map(([id, b]) => `<button data-act="build" data-id="${id}">${b.name}</button>`).join('')}</div></details>
    <h4>Train</h4>
    <div class="actions">${Object.entries(UNITS).map(([id, u]) => `<button data-act="train" data-id="${id}">${u.name}</button>`).join('')}</div>
    <h4>Queue</h4>
    ${city.queue.map((q) => `<div class="muted">${q.kind} ${q.id} (${q.left})</div>`).join('') || '—'}
    ${unit ? `<h4>Selected Unit</h4>
      <p>${unit.name} (${unit.type}) @ (${unit.x},${unit.y}) · moves ${unit.moves} · HP ${unit.hp}</p>
      <div class="actions">
        <button data-act="found">Found City</button>
        <button data-act="gather">Gather</button>
      </div>` : ''}`;
}

function peoplePanel(state) {
  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  const list = state.citizens.filter((c) => !city || c.cityId === city.id).slice(0, 40);
  return `<h3>People</h3>
    <p>${state.citizens.length} simulated citizens</p>
    <input id="people-search" placeholder="Search..." style="width:100%;margin:0.4rem 0;padding:0.35rem;background:#101914;border:1px solid var(--line);color:var(--text)"/>
    <div id="people-list">${list.map((c) => `<div class="list-item">
      <b>${c.name}</b> · ${c.age}y · ${c.occupation}<br/>
      <span class="muted">${c.personality} · ${c.routine} · health ${c.health} · wealth ${c.wealth}</span>
    </div>`).join('') || '<p class="muted">Found a city to generate families.</p>'}</div>`;
}

function lookPanel(state) {
  return `<h3>Living Visuals</h3>
    <div class="row"><span>Zoom</span><b>${state.zoom}</b></div>
    <div class="row"><span>Day/Night</span><b>${state.look.dayNight.toFixed(2)}</b></div>
    <button data-act="daynight">Cycle Day/Night</button>
    <button data-act="birds">Toggle Birds</button>
    <p class="muted">Cities evolve village → capital. Civ looks tint settlements. Scroll to zoom continent ↔ street.</p>`;
}

function eventsPanel(state) {
  return `<h3>World Events</h3>
    ${state.activeEvent ? `<p><b>${state.activeEvent.name}</b> awaits a decision (see banner).</p>` : '<p class="muted">No active event.</p>'}
    <p class="muted">Famine, civil war, meteor, quake, faith, gold rush, pirates, migration, disease, new continent.</p>`;
}

function missionsPanel(state) {
  return `<h3>Missions</h3>
    ${state.missions.slice().reverse().map((m) => `<div class="list-item">
      <b>${m.name}</b> — ${m.status} ${m.status === 'active' ? `(${m.turnsLeft})` : ''}
      ${m.status === 'active' ? `<button data-act="complete-mission" data-id="${m.id}">Send Aid / Complete</button>` : ''}
    </div>`).join('') || '<p class="muted">Objectives will emerge from the realm.</p>'}`;
}

function culturePanel(state) {
  return `<h3>Culture</h3>
    <div class="row"><span>Prestige</span><b>${state.player.prestige}</b></div>
    <div class="row"><span>Syncretism</span><b>${state.player.syncretism}</b></div>
    ${CULTURE_TRAITS.map((t) => `<div class="row"><span>${t}</span>
      <b>${state.player.culture[t]}</b>
      <button data-act="patron" data-id="${t}">Patron</button></div>`).join('')}
    <button data-act="festival">Hold Festival (25g)</button>`;
}

function seasonsPanel(state) {
  return `<h3>Seasons</h3>
    <p>Now: <b>${state.season}</b></p>
    <ul>
      <li>Spring — plant crops</li>
      <li>Summer — +1 moves, food ×1.55</li>
      <li>Autumn — harvest & stores</li>
      <li>Winter — freeze, −1 moves, food ×0.4</li>
    </ul>
    <button data-act="plant">Plant Crops</button>
    <button data-act="prepare-winter">Prepare Winter Stores</button>`;
}

function bondsPanel(state) {
  return `<h3>Character Bonds</h3>
    <h4>Factions</h4>
    ${state.factions.map((f) => `<div class="row"><span>${f.name}</span><b>${f.power}</b></div>`).join('')}
    <h4>Ties</h4>
    ${state.bonds.map((b) => {
      const a = state.nobles.find((n) => n.id === b.a);
      const c = state.nobles.find((n) => n.id === b.b);
      return `<div class="muted">${a?.head} ↔ ${c?.head}: ${b.kind} (${b.strength})</div>`;
    }).join('') || '—'}
    <button data-act="feast">Host Feast (friends +)</button>`;
}

function crimePanel(state) {
  return `<h3>Crime</h3>
    ${CRIME_NETWORKS.map((n) => {
      const d = state.crime[n];
      return `<div class="list-item"><b>${n.replace('_', ' ')}</b> · heat ${d.heat} · ${d.stance}
        <div class="actions">
          <button data-act="crime" data-id="${n}" data-stance="fight">Fight</button>
          <button data-act="crime" data-id="${n}" data-stance="negotiate">Negotiate</button>
          <button data-act="crime" data-id="${n}" data-stance="benefit">Benefit</button>
        </div></div>`;
    }).join('')}`;
}

function faithPanel(state) {
  return `<h3>Faith</h3>
    ${state.faiths.map((f) => `<div class="list-item">
      <b>${f.name}</b> spread ${f.spread} ${f.id === state.player.religion ? '(state)' : ''}
      <div class="actions">
        <button data-act="adopt-faith" data-id="${f.id}">Adopt</button>
        <button data-act="preach" data-id="${f.id}">Preach</button>
        <button data-act="reform" data-id="${f.id}">Steer Reform</button>
      </div>
    </div>`).join('')}
    <button data-act="holy-day">Celebrate Holy Day</button>`;
}

function wildlifePanel(state) {
  return `<h3>Wildlife</h3>
    ${state.world.wildlife.map((w) => `<div class="row"><span>${w.species}</span><b>sz ${w.size} @(${w.x},${w.y})</b></div>`).join('')}
    <div class="actions">
      <button data-act="guard-flocks">Guard Flocks</button>
      <button data-act="hunt-wolves">Hunt Wolves</button>
      <button data-act="fish">Cast Nets</button>
    </div>`;
}

function greatPanel(state) {
  return `<h3>Great People</h3>
    ${state.greatPeople.map((g) => `<div class="list-item">
      <b>${g.name}</b> the ${g.kindName} · loyalty ${g.loyalty}
      <button data-act="support-gp" data-id="${g.id}">Support (15g)</button>
    </div>`).join('') || '<p class="muted">Talent will emerge from your cities.</p>'}`;
}

function chainsPanel(state) {
  const r = state.player.resources;
  return `<h3>Natural Economy</h3>
    <p class="muted">No free food from workers; mines need industry; weapons need iron+coal.</p>
    <div class="row"><span>Wheat → Flour → Bread</span><b>${r.wheat}/${r.flour}/${r.bread || 0}</b></div>
    <div class="row"><span>Iron / Coal / Weapons</span><b>${r.iron}/${r.coal}/${r.weapons}</b></div>
    <p>Farm → Mill → Bakery · Mine + Coal Pit → Blacksmith</p>
    <button data-act="import-wheat">Import Wheat Route</button>`;
}

function victoryPanel(state) {
  return `<h3>Victory Paths</h3>
    ${Object.entries(state.victories).map(([k, v]) => `<div>
      <div class="row"><span>${k}</span><b>${v.progress}/${v.goal}${v.done ? ' ✓' : ''}</b></div>
      <div class="bar-meter"><i style="width:${(v.progress / v.goal) * 100}%"></i></div>
    </div>`).join('')}`;
}

function livingPanel(state) {
  const s = state.livingScore;
  return `<h3>Living World Score</h3>
    <div class="score-ring" style="--p:${s.value}"><span>${s.value}</span></div>
    <p class="muted">Hold 75+ for five seasons to thrive.</p>
    ${Object.entries(s.pillars).map(([k, v]) => `<div>
      <div class="row"><span>${k}</span><b>${v}</b></div>
      <div class="bar-meter"><i style="width:${v}%"></i></div>
    </div>`).join('')}`;
}

function wirePanelActions(state) {
  const panel = (sel) => document.querySelector(sel);
  // Use event delegation on both panels
  for (const root of [document.getElementById('left-panel'), document.getElementById('right-panel')]) {
    root.onclick = (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      handleAction(state, btn.dataset.act, btn.dataset);
      // re-render triggered by main via custom event
      window.dispatchEvent(new CustomEvent('aetheria-refresh'));
    };
    root.onchange = (e) => {
      const el = e.target;
      if (el.dataset.act === 'religion') {
        state.player.religion = el.value;
        log(state, `State religion is now ${el.value}.`, 'faith');
      }
      if (el.dataset.act === 'governor') {
        const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
        if (city) city.governor = el.value || null;
      }
      window.dispatchEvent(new CustomEvent('aetheria-refresh'));
    };
  }
}

function handleAction(state, act, data) {
  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  const unit = state.units.find((u) => u.id === state.selectedUnitId);
  const rival = state.rivals.find((r) => r.id === data.id);

  switch (act) {
    case 'tax-up': state.player.taxes = clamp(state.player.taxes + 5, 0, 40); break;
    case 'tax-down': state.player.taxes = clamp(state.player.taxes - 5, 0, 40); break;
    case 'law': {
      const i = state.player.laws.indexOf(data.id);
      if (i >= 0) state.player.laws.splice(i, 1);
      else if (state.player.laws.length < 3) state.player.laws.push(data.id);
      break;
    }
    case 'gov': state.player.government = data.id; log(state, `Government reformed: ${data.id}`, 'politics'); chronicle(state, `Government becomes ${data.id}.`, 'politics'); break;
    case 'bribe': {
      const n = state.nobles.find((x) => x.id === data.id);
      if (n && state.player.resources.gold >= 15) {
        state.player.resources.gold -= 15;
        n.loyalty += 15;
        n.memories.push('Bribed by the crown');
      }
      break;
    }
    case 'exile': {
      const n = state.nobles.find((x) => x.id === data.id);
      if (n) {
        n.loyalty = 0;
        n.memories.push('Exiled — heirs may seek revenge');
        state.legends.push({
          id: n.id + '_heir', name: personName(state.rand), title: 'the Wronged', role: 'heir',
          status: 'plotting', story: `Child of ${n.house} plots revenge for exile.`,
          memories: [{ text: `${n.head} was exiled`, weight: 25 }], loyalty: -50,
        });
        log(state, `${n.head} exiled.`, 'politics');
      }
      break;
    }
    case 'heir': {
      const n = state.nobles.find((x) => x.id === data.id);
      if (n) {
        state.heir = n.head;
        log(state, `${n.head} named royal heir.`, 'politics');
      }
      break;
    }
    case 'election': {
      if (!GOVERNMENTS.find((g) => g.id === state.player.government)?.elections) break;
      state.election = {
        turnsLeft: 3,
        candidates: state.nobles.slice(0, 3).map((n) => ({ id: n.id, name: n.head, funds: 0 })),
      };
      log(state, 'Election called.', 'politics');
      break;
    }
    case 'fund': {
      if (state.election && state.player.resources.gold >= 10) {
        state.player.resources.gold -= 10;
        const c = state.election.candidates.find((x) => x.id === data.id);
        if (c) c.funds += 10;
      }
      break;
    }
    case 'crush': state.player.unrest = clamp(state.player.unrest - 15, 0, 100); state.player.happiness -= 5; break;
    case 'negotiate-crisis': state.player.unrest = clamp(state.player.unrest - 8, 0, 100); state.player.resources.gold = Math.max(0, state.player.resources.gold - 10); break;
    case 'gift': if (rival && state.player.resources.gold >= 20) {
      state.player.resources.gold -= 20;
      rival.opinion += 10 + (rival.mind.greed > 50 ? 5 : 0);
      rival.memory.push({ kind: 'gift', text: 'Received gold gift', turn: state.turn });
      log(state, `Gift sent to ${rival.kingdom}.`, 'diplo');
    } break;
    case 'threat': if (rival) {
      rival.opinion -= 15;
      rival.memory.push({ kind: 'insult', text: 'Threatened by your realm', turn: state.turn });
      if (!rival.mind.unforgiving && rival.mind.patience > 60 && state.rand() < 0.3) {
        log(state, `${rival.ruler} may forgive in time.`, 'diplo');
      } else log(state, `${rival.ruler} remembers this insult.`, 'diplo');
    } break;
    case 'ally': if (rival && rival.opinion > 10) {
      rival.alliance = true;
      rival.memory.push({ kind: 'alliance', text: 'Formed alliance', turn: state.turn });
      chronicle(state, `Alliance with ${rival.kingdom}.`, 'diplomacy');
      log(state, `Alliance forged with ${rival.kingdom}.`, 'diplo');
    } else log(state, 'Opinion too low for alliance.', 'warn'); break;
    case 'trade': if (rival && !rival.embargo) {
      rival.trade = true;
      rival.opinion += 5;
      rival.memory.push({ kind: 'trade', text: 'Trade opened', turn: state.turn });
      state.player.resources.gold += 8;
      chronicle(state, `Trade with ${rival.kingdom}.`, 'diplomacy');
    } break;
    case 'embargo': if (rival) {
      rival.embargo = !rival.embargo;
      rival.trade = false;
      rival.opinion -= 10;
      rival.memory.push({ kind: 'embargo', text: 'Embargo toggled', turn: state.turn });
    } break;
    case 'access': if (rival && rival.opinion > 0) {
      rival.access = true;
      rival.memory.push({ kind: 'access', text: 'Military access', turn: state.turn });
    } break;
    case 'marry': if (rival && rival.opinion > 20) {
      rival.marriage = true;
      rival.opinion += 20;
      rival.memory.push({ kind: 'marriage', text: 'Royal marriage', turn: state.turn });
      chronicle(state, `Royal marriage with ${rival.kingdom}.`, 'diplomacy');
      state.player.syncretism += 5;
    } break;
    case 'hostage': if (rival) {
      rival.hostage = true;
      rival.opinion -= 5;
      rival.memory.push({ kind: 'hostage', text: 'Hostages exchanged', turn: state.turn });
    } break;
    case 'war': if (rival) {
      rival.atWar = true;
      rival.alliance = false;
      rival.memory.push({ kind: 'war', text: 'War declared', turn: state.turn });
      chronicle(state, `War declared on ${rival.kingdom}.`, 'war');
      if (!state.chronicle.some((c) => c.text.includes('First Great War'))) chronicle(state, 'First Great War begins.', 'war');
    } break;
    case 'peace': if (rival && rival.atWar) {
      rival.atWar = false;
      rival.siege = 0;
      rival.memory.push({ kind: 'peace', text: 'Peace signed', turn: state.turn });
      chronicle(state, `Peace with ${rival.kingdom} — Treaty recorded.`, 'diplomacy');
    } break;
    case 'joint': if (rival && rival.alliance) {
      const foe = state.rivals.find((r) => r.id !== rival.id);
      if (foe) {
        foe.atWar = true;
        rival.atWar = true; // joint vs foe represented simply
        log(state, `Joint war with ${rival.kingdom} against ${foe.kingdom}!`, 'war');
      }
    } break;
    case 'conference': if (rival) {
      rival.opinion += 8;
      chronicle(state, `Peace conference with ${rival.kingdom}.`, 'diplomacy');
      log(state, 'Peace conference convened.', 'diplo');
    } break;
    case 'form': if (unit) unit.formation = data.id; break;
    case 'fortify': if (unit) {
      unit.morale = clamp(unit.morale + 15, 0, 100);
      unit.moves = 0;
    } break;
    case 'merc': if (city && canAfford(state.player.resources, { gold: 40 })) {
      pay(state.player.resources, { gold: 40 });
      queueUnit(state, city, 'mercenary');
    } break;
    case 'deposit': if (state.player.resources.gold >= 20) {
      state.player.resources.gold -= 20;
      state.economy.bank.deposits += 20;
    } break;
    case 'withdraw': if (state.economy.bank.deposits >= 20) {
      state.economy.bank.deposits -= 20;
      state.player.resources.gold += 20;
    } break;
    case 'loan': {
      state.economy.bank.loan += 40;
      state.player.resources.gold += 40;
      break;
    }
    case 'company': if (state.player.resources.gold >= 50) {
      state.player.resources.gold -= 50;
      state.economy.companies.push({ id: 'co_' + state.economy.companies.length, name: 'Trade Co.' });
      log(state, 'Trade company founded.', 'economy');
    } break;
    case 'route': if (state.player.resources.gold >= 30 && state.cities[0]) {
      state.player.resources.gold -= 30;
      const c = state.cities[0];
      state.economy.routes.push({
        id: 'rt_' + state.economy.routes.length,
        name: 'Sea Lane ' + (state.economy.routes.length + 1),
        active: true,
        from: { x: c.x, y: c.y },
        to: { x: clamp(c.x + 10, 0, state.world.width - 1), y: c.y },
        good: pick(state.rand, ['wheat', 'coal', 'iron', 'flour']),
      });
      log(state, 'Shipping route opened.', 'economy');
    } break;
    case 'guild': if (state.player.resources.gold >= 5) {
      state.player.resources.gold -= 5;
      state.economy.guild.reputation += 5;
    } break;
    case 'black': state.economy.blackMarket.open = !state.economy.blackMarket.open; break;
    case 'delve': {
      const site = state.world.sites.find((s) => s.id === data.id);
      if (site && unit) delveSite(state, unit, site);
      break;
    }
    case 'research': {
      if (!state.player.researchQueue.includes(data.id)) state.player.researchQueue.push(data.id);
      log(state, `Research queued.`, 'tech');
      break;
    }
    case 'wonder': {
      const w = state.wonders.find((x) => x.id === data.id);
      if (w && city && !w.owner && canAfford(state.player.resources, w.cost)) {
        pay(state.player.resources, w.cost);
        city.queue.push({ kind: 'wonder', id: w.id, left: w.turns });
        w.building = true;
        log(state, `Begun ${w.name}.`, 'wonder');
      } else log(state, 'Cannot start wonder.', 'warn');
      break;
    }
    case 'toggle-fantasy': {
      state.player.fantasy = !state.player.fantasy;
      if (!state.player.fantasy) {
        state.myth = { dragons: [], wizards: [], relics: [], heroes: [], bosses: [] };
        log(state, 'Realistic mode — myth cleared.', 'myth');
      } else log(state, 'Fantasy mode enabled.', 'myth');
      break;
    }
    case 'fight-boss': {
      const boss = state.myth.bosses.find((b) => b.hp > 0);
      const fighter = state.units.find((u) => u.atk > 0);
      if (boss && fighter) {
        boss.hp -= fighter.atk + 5;
        fighter.hp -= 4;
        if (boss.hp <= 0) {
          log(state, `${boss.name} defeated!`, 'myth');
          chronicle(state, `First Dragon defeated.`, 'legend');
          state.player.prestige += 25;
          state.player.resources.lore += 20;
        }
      }
      break;
    }
    case 'summon-hero': if (state.player.resources.mana >= 20) {
      state.player.resources.mana -= 20;
      state.myth.heroes.push({ name: personName(state.rand) });
      log(state, 'Legendary hero summoned.', 'myth');
      break;
    } break;
    case 'spaceport': if (canAfford(state.player.resources, { gold: 80, iron: 20 })) {
      pay(state.player.resources, { gold: 80, iron: 20 });
      state.space.portLevel += 1;
      log(state, 'Spaceport upgraded.', 'space');
    } break;
    case 'rocket': if (state.space.portLevel > 0 && state.player.resources.gold >= 40) {
      state.player.resources.gold -= 40;
      state.space.rockets += 1;
    } break;
    case 'colonize': {
      const body = SPACE_BODIES.find((b) => b.id === data.id);
      if (body && state.space.rockets > 0 && state.space.portLevel > 0) {
        state.space.rockets -= 1;
        state.space.colonies.push(body.id);
        log(state, `Colonized ${body.name}!`, 'space');
        chronicle(state, `Colony established on ${body.name}.`, 'space');
      } else log(state, 'Need spaceport + rocket.', 'warn');
      break;
    }
    case 'mode-coop':
      state.multi.mode = 'coop';
      state.multi.seats = [{ id: 'p1', name: 'Host' }, { id: 'p2', name: 'Ally' }];
      break;
    case 'mode-pvp':
      state.multi.mode = 'pvp';
      state.multi.seats = [{ id: 'p1', name: 'Realm A' }, { id: 'p2', name: 'Realm B' }];
      break;
    case 'mode-solo': state.multi.mode = 'solo'; state.multi.seats = [{ id: 'player', name: 'You' }]; break;
    case 'massive': log(state, 'Start a New Campaign from Menu with massive world (use New + reload). Setting flagged.', 'system'); state.multi.wantMassive = true; break;
    case 'pass-seat':
      state.multi.activeSeat = (state.multi.activeSeat + 1) % state.multi.seats.length;
      if (state.multi.activeSeat === 0) endTurn(state);
      log(state, `Active seat: ${state.multi.seats[state.multi.activeSeat].name}`, 'multi');
      break;
    case 'toggle-mod': {
      const id = state.mods.packs[0].id;
      if (state.mods.enabled.includes(id)) state.mods.enabled = [];
      else state.mods.enabled = [id];
      break;
    }
    case 'export-mod': {
      const blob = new Blob([JSON.stringify(state.mods.packs[0], null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'jade-coast-pack.json';
      a.click();
      break;
    }
    case 'seal': window.dispatchEvent(new CustomEvent('aetheria-seal')); break;
    case 'continue-era': {
      const era = state.legacy.eras.find((e) => e.id === data.id);
      if (era) window.dispatchEvent(new CustomEvent('aetheria-continue', { detail: era }));
      break;
    }
    case 'spare':
    case 'land':
    case 'promote':
    case 'exile-lord':
    case 'crown': {
      const lord = state.legends.find((l) => l.id === data.id);
      if (!lord) break;
      if (act === 'spare') {
        lord.memories.push({ text: 'Spared after defeat', weight: 15 });
        lord.loyalty += 30;
        lord.story = 'Spared once — the mercy became part of their legend.';
      }
      if (act === 'land') {
        lord.memories.push({ text: 'Granted land', weight: 10 });
        lord.loyalty += 20;
        lord.title = lord.title || 'Landed';
      }
      if (act === 'promote') {
        lord.role = lord.role === 'soldier' ? 'captain' : 'general';
        lord.title = 'Ironheart';
        lord.memories.push({ text: 'Promoted for valor', weight: 12 });
      }
      if (act === 'exile-lord') {
        lord.status = 'exiled';
        lord.memories.push({ text: 'Exiled by the crown', weight: 20 });
        state.legends.push({
          id: lord.id + '_child', name: personName(state.rand), title: 'Oathbreaker\'s Heir',
          role: 'heir', status: 'plotting', loyalty: -60,
          story: 'Child of an exile — revenge ripens across decades.',
          memories: [{ text: `Parent ${lord.name} was exiled`, weight: 30 }],
        });
      }
      if (act === 'crown') {
        lord.role = 'ruler';
        lord.title = 'the Merchant King';
        chronicle(state, `The people demand ${lord.name} wear the crown.`, 'legend');
        log(state, `${lord.name} crowned by popular demand!`, 'legend');
      }
      break;
    }
    case 'found': if (unit) foundCity(state, unit); break;
    case 'gather': if (unit) gatherDeposit(state, unit); break;
    case 'build': if (city) queueBuilding(state, city, data.id); break;
    case 'train': if (city) queueUnit(state, city, data.id); break;
    case 'daynight': state.look.dayNight = (state.look.dayNight + 0.25) % 1; break;
    case 'birds': state.look.birds = !state.look.birds; break;
    case 'complete-mission': {
      const m = state.missions.find((x) => x.id === data.id);
      if (m && m.status === 'active') {
        m.status = 'done';
        state.player.resources.gold += m.reward.gold;
        state.player.prestige += 3;
        for (const n of state.nobles) n.loyalty += m.reward.loyalty || 0;
        log(state, `Mission complete: ${m.name}`, 'mission');
        chronicle(state, `Mission fulfilled — ${m.name}.`, 'mission');
      }
      break;
    }
    case 'patron':
      if (state.player.resources.gold >= 10) {
        state.player.resources.gold -= 10;
        state.player.culture[data.id] += 5;
        state.player.prestige += 1;
      }
      break;
    case 'festival':
      if (state.player.resources.gold >= 25) {
        state.player.resources.gold -= 25;
        state.player.happiness = clamp(state.player.happiness + 10, 0, 100);
        state.player.prestige += 5;
        chronicle(state, 'A great festival unites the realm.', 'culture');
      }
      break;
    case 'plant':
      for (const c of state.cities) {
        c.planted = true;
        c.harvestReady = true;
      }
      log(state, 'Crops planted around cities.', 'season');
      break;
    case 'prepare-winter':
      for (const c of state.cities) c.foodStore += 8;
      state.player.resources.food = Math.max(0, state.player.resources.food - 10);
      log(state, 'Winter stores prepared.', 'season');
      break;
    case 'feast':
      if (state.player.resources.gold >= 15) {
        state.player.resources.gold -= 15;
        for (const b of state.bonds) if (b.kind === 'rival' && state.rand() < 0.4) b.kind = 'friend';
        log(state, 'A feast softens rivalries.', 'bonds');
      }
      break;
    case 'crime':
      state.crime[data.id].stance = data.stance;
      log(state, `${data.id}: stance ${data.stance}`, 'crime');
      break;
    case 'adopt-faith':
      state.player.religion = data.id;
      break;
    case 'preach': {
      const f = state.faiths.find((x) => x.id === data.id);
      if (f) f.spread += 5;
      break;
    }
    case 'reform': {
      const f = state.faiths.find((x) => x.id === data.id);
      if (f) f.reform += 15;
      break;
    }
    case 'holy-day':
      state.player.happiness = clamp(state.player.happiness + 8, 0, 100);
      chronicle(state, 'A holy day lifts every hearth.', 'faith');
      break;
    case 'guard-flocks':
      state.player.resources.gold = Math.max(0, state.player.resources.gold - 5);
      state.livingScore.guarded = true;
      log(state, 'Flocks guarded against wolves.', 'wildlife');
      break;
    case 'hunt-wolves':
      for (const w of state.world.wildlife.filter((x) => x.species === 'wolves')) w.size = Math.max(1, w.size - 2);
      break;
    case 'fish': {
      const fish = state.world.wildlife.find((w) => w.species === 'fish' && w.size > 2);
      if (fish) {
        fish.size -= 1;
        state.player.resources.food += 6;
      }
      break;
    }
    case 'support-gp': {
      const gp = state.greatPeople.find((g) => g.id === data.id);
      if (gp && state.player.resources.gold >= 15) {
        state.player.resources.gold -= 15;
        gp.support += 3;
        gp.loyalty = clamp(gp.loyalty + 20, 0, 100);
      }
      break;
    }
    case 'import-wheat':
      if (state.player.resources.gold >= 20) {
        state.player.resources.gold -= 20;
        state.economy.routes.push({
          id: 'import_wheat', name: 'Wheat Import', active: true, good: 'wheat',
          from: state.cities[0] || { x: 0, y: 0 },
          to: state.cities[0] || { x: 5, y: 5 },
        });
      }
      break;
    case 'hist-filter': {
      const list = document.getElementById('chronicle-list');
      if (!list) break;
      const entries = state.chronicle.filter((e) => data.id === 'all' || e.category === data.id).slice().reverse().slice(0, 80);
      list.innerHTML = entries.map((e) => `<div class="row"><span>Year ${e.year}</span><span>${e.text}</span></div>`).join('');
      break;
    }
    default: break;
  }
}

export { renderMap };
