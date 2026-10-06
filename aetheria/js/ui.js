import { BUILDINGS, UNITS, TECHS, TUTORIAL } from './data.js';
import {
  foundCity, moveUnit, gather, delve, queueBuilding, queueUnit,
  startWonder, queueResearch, diploAction, endTurn, resolveEvent, estimateYields,
} from './game.js';
import { renderMap, renderMinimap, screenToTile } from './render.js';
import { beep } from './audio.js';
import { toast, clamp } from './utils.js';

const PRIMARY_TABS = [
  { id: 'city', label: 'City', icon: '⌂' },
  { id: 'tech', label: 'Tech', icon: '◇' },
  { id: 'diplo', label: 'Diplo', icon: '⇄' },
  { id: 'explore', label: 'Explore', icon: '◎' },
  { id: 'wonders', label: 'Wonders', icon: '▲' },
  { id: 'more', label: 'More', icon: '···' },
];

const RES_ICONS = {
  food: '◈',
  wood: '▣',
  stone: '▢',
  gold: '✶',
  iron: '▮',
  lore: '✦',
};

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('Missing element #' + id);
    return;
  }
  el.addEventListener(event, handler);
}

export function bindUI(app) {
  const { stateRef, canvas } = app;
  if (!canvas) throw new Error('Map canvas missing');

  const tabs = document.getElementById('panel-tabs');
  if (tabs) {
    tabs.innerHTML = '';
    PRIMARY_TABS.forEach((tab) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.panel = tab.id;
      b.innerHTML = `<span class="tab-ico" aria-hidden="true">${tab.icon}</span><span>${tab.label}</span>`;
      b.onclick = () => {
        if (!stateRef.current) return;
        stateRef.current.uiPanel = tab.id;
        beep('ui');
        refreshAll(app);
      };
      tabs.appendChild(b);
    });
  }

  on('btn-end-turn', 'click', () => {
    if (!stateRef.current) return;
    endTurn(stateRef.current);
    beep('turn');
    refreshAll(app);
    maybeVictory(app);
  });

  on('btn-menu', 'click', () => document.getElementById('menu-modal')?.classList.remove('hidden'));
  on('btn-close-menu', 'click', () => document.getElementById('menu-modal')?.classList.add('hidden'));
  on('btn-new', 'click', () => {
    app.newGame();
    document.getElementById('menu-modal')?.classList.add('hidden');
    toast('New campaign started', 'info');
  });
  on('btn-save', 'click', () => app.save());
  on('btn-load', 'click', () => app.load());
  on('btn-help', 'click', () => {
    document.getElementById('menu-modal')?.classList.add('hidden');
    document.getElementById('help-modal')?.classList.remove('hidden');
  });
  on('btn-close-help', 'click', () => document.getElementById('help-modal')?.classList.add('hidden'));
  on('btn-clear-saves', 'click', () => app.clearSaves());

  on('btn-found', 'click', () => {
    if (!stateRef.current) return;
    const u = selectedUnit(stateRef.current);
    if (foundCity(stateRef.current, u)) beep('build');
    refreshAll(app);
  });
  on('btn-gather', 'click', () => {
    if (!stateRef.current) return;
    gather(stateRef.current, selectedUnit(stateRef.current));
    refreshAll(app);
  });
  on('btn-delve', 'click', () => {
    const state = stateRef.current;
    if (!state) return;
    const u = selectedUnit(state);
    if (!u) {
      toast('Select a unit first.', 'warn');
      return;
    }
    const site = state.world.sites.find((s) => s.discovered && !s.delved && Math.abs(s.x - u.x) + Math.abs(s.y - u.y) <= 1);
    if (!site) toast('No site adjacent.', 'warn');
    else delve(state, u, site);
    refreshAll(app);
  });
  on('btn-wait', 'click', () => {
    if (!stateRef.current) return;
    const u = selectedUnit(stateRef.current);
    if (u) u.moves = 0;
    refreshAll(app);
  });
  on('btn-next-unit', 'click', () => {
    if (!stateRef.current) return;
    cycleUnit(stateRef.current);
    refreshAll(app);
  });

  on('btn-zoom-in', 'click', () => {
    if (!stateRef.current) return;
    stateRef.current.camera.zoom = clamp(stateRef.current.camera.zoom + 0.15, 1.0, 2.8);
    refreshAll(app);
  });
  on('btn-zoom-out', 'click', () => {
    if (!stateRef.current) return;
    stateRef.current.camera.zoom = clamp(stateRef.current.camera.zoom - 0.15, 1.0, 2.8);
    refreshAll(app);
  });
  on('btn-center', 'click', () => {
    const state = stateRef.current;
    if (!state) return;
    const u = selectedUnit(state) || state.cities[0];
    if (u) {
      state.camera.x = u.x;
      state.camera.y = u.y;
      state.selectedTile = { x: u.x, y: u.y };
    }
    refreshAll(app);
  });

  canvas.addEventListener('click', (e) => {
    const state = stateRef.current;
    if (!state) return;
    const tile = screenToTile(canvas, state, e.clientX, e.clientY);
    if (!tile) return;
    state.selectedTile = { x: tile.x, y: tile.y };
    const clicked = state.units.find((u) => u.x === tile.x && u.y === tile.y);
    if (clicked) {
      state.selectedUnitId = clicked.id;
      beep('ui');
    } else {
      const u = selectedUnit(state);
      if (u) {
        const dx = Math.sign(tile.x - u.x);
        const dy = Math.sign(tile.y - u.y);
        if (dx || dy) {
          if (Math.abs(tile.x - u.x) >= Math.abs(tile.y - u.y)) moveUnit(state, u, u.x + dx, u.y);
          else moveUnit(state, u, u.x, u.y + dy);
          beep('ui');
        }
      }
    }
    const city = state.cities.find((c) => c.x === tile.x && c.y === tile.y);
    if (city) state.selectedCityId = city.id;
    refreshAll(app);
  });

  const mini = document.getElementById('minimap');
  mini?.addEventListener('click', (e) => {
    const state = stateRef.current;
    if (!state || !mini) return;
    const rect = mini.getBoundingClientRect();
    state.camera.x = Math.floor(((e.clientX - rect.left) / rect.width) * state.world.width);
    state.camera.y = Math.floor(((e.clientY - rect.top) / rect.height) * state.world.height);
    state.selectedTile = { x: state.camera.x, y: state.camera.y };
    refreshAll(app);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea')) return;
    const state = stateRef.current;
    if (!state) return;
    const u = selectedUnit(state);
    const map = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    };
    if (map[e.key] && u) {
      e.preventDefault();
      moveUnit(state, u, u.x + map[e.key][0], u.y + map[e.key][1]);
      refreshAll(app);
    }
    if ((e.key === 'f' || e.key === 'F') && u) {
      foundCity(state, u);
      refreshAll(app);
    }
    if ((e.key === 'g' || e.key === 'G') && u) {
      gather(state, u);
      refreshAll(app);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleUnit(state);
      refreshAll(app);
    }
    if (e.key === 'Enter') {
      endTurn(state);
      beep('turn');
      refreshAll(app);
      maybeVictory(app);
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    }
  });

  on('btn-tutorial-next', 'click', () => {
    if (!stateRef.current) return;
    stateRef.current.tutorialStep = Math.min(TUTORIAL.length, stateRef.current.tutorialStep + 1);
    refreshAll(app);
  });
  on('btn-tutorial-skip', 'click', () => {
    if (!stateRef.current) return;
    stateRef.current.tutorialStep = TUTORIAL.length;
    refreshAll(app);
  });
  on('btn-victory-close', 'click', () => {
    document.getElementById('victory-modal')?.classList.add('hidden');
  });
}

function selectedUnit(state) {
  if (!state?.units?.length) return null;
  return state.units.find((u) => u.id === state.selectedUnitId) || state.units[0];
}

function cycleUnit(state) {
  if (!state.units.length) return;
  const idx = state.units.findIndex((u) => u.id === state.selectedUnitId);
  const next = state.units[(idx + 1) % state.units.length];
  state.selectedUnitId = next.id;
  state.camera.x = next.x;
  state.camera.y = next.y;
  state.selectedTile = { x: next.x, y: next.y };
}

function canFound(state, unit) {
  if (!unit || unit.type !== 'settler') return false;
  const t = state.world.tiles[unit.y * state.world.width + unit.x];
  if (!t || t.type === 'water') return false;
  return !state.cities.some((c) => Math.abs(c.x - unit.x) + Math.abs(c.y - unit.y) < 4);
}

function canGather(state, unit) {
  if (!unit || unit.type !== 'worker') return false;
  return state.world.deposits.some((d) => d.amount > 0 && d.x === unit.x && d.y === unit.y);
}

function canDelve(state, unit) {
  if (!unit) return false;
  return state.world.sites.some((s) => s.discovered && !s.delved && Math.abs(s.x - unit.x) + Math.abs(s.y - unit.y) <= 1);
}

function setCmdState(id, enabled, primary = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.disabled = !enabled;
  el.classList.toggle('is-disabled', !enabled);
  if (primary) el.classList.toggle('cmd-primary', enabled);
}

function fmtDelta(n) {
  if (!n) return { text: '+0', cls: 'delta zero' };
  if (n > 0) return { text: `+${n}`, cls: 'delta' };
  return { text: String(n), cls: 'delta neg' };
}

export function refreshAll(app) {
  const state = app.stateRef.current;
  if (!state) return;
  if (!state.uiPanel) state.uiPanel = 'city';

  const kingdom = document.getElementById('kingdom-name');
  if (kingdom) kingdom.textContent = state.player.name;

  const turnMeta = document.getElementById('turn-meta');
  if (turnMeta) turnMeta.textContent = `${state.season}, Year ${state.year} · Turn ${state.turn}`;

  const yields = estimateYields(state);
  const res = state.player.res;
  const resEl = document.getElementById('resources');
  if (resEl) {
    resEl.innerHTML = ['food', 'wood', 'stone', 'gold', 'iron', 'lore']
      .map((k) => {
        const d = fmtDelta(yields[k] || 0);
        return `<span class="res"><span class="res-ico" aria-hidden="true">${RES_ICONS[k]}</span><b>${res[k] || 0}</b><span class="${d.cls}">${d.text}</span></span>`;
      }).join('');
  }

  const pop = state.cities.reduce((s, c) => s + c.pop, 0);
  const popValue = document.getElementById('pop-value');
  const happyValue = document.getElementById('happy-value');
  if (popValue) popValue.textContent = String(pop);
  if (happyValue) happyValue.textContent = `${Math.round(state.player.happiness)}%`;

  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  const cityTitle = document.getElementById('city-title');
  const citySub = document.getElementById('city-subtitle');
  const cityAvatar = document.getElementById('city-avatar');
  if (city) {
    if (cityTitle) cityTitle.textContent = city.name;
    if (citySub) citySub.textContent = `${city.stage} · Pop ${city.pop}`;
    if (cityAvatar) cityAvatar.textContent = city.name.slice(0, 1).toUpperCase();
  } else {
    if (cityTitle) cityTitle.textContent = state.player.name.replace(/^Kingdom of\s+/i, '') || 'Realm';
    if (citySub) citySub.textContent = 'No city founded yet';
    if (cityAvatar) cityAvatar.textContent = 'A';
  }

  const u = selectedUnit(state);
  const unitInfo = document.getElementById('unit-info');
  const unitStats = document.getElementById('unit-stats');
  const portrait = document.getElementById('unit-portrait');
  if (u) {
    const def = UNITS[u.type] || {};
    if (unitInfo) {
      unitInfo.innerHTML = `<strong>${u.name}</strong><div class="unit-meta">Lv${u.level} · (${u.x},${u.y})</div>`;
    }
    if (unitStats) {
      unitStats.innerHTML = `
        <span class="pill"><i>HP</i>${u.hp}/${u.maxHp}</span>
        <span class="pill"><i>ATK</i>${u.atk}</span>
        <span class="pill"><i>MOV</i>${u.moves}/${u.maxMoves}</span>
        <span class="pill"><i>VIS</i>${u.vision}</span>`;
    }
    if (portrait) portrait.textContent = def.glyph || '?';
  } else if (unitInfo) {
    unitInfo.innerHTML = 'No unit selected';
    if (unitStats) unitStats.innerHTML = '';
    if (portrait) portrait.textContent = '?';
  }

  setCmdState('btn-found', canFound(state, u), true);
  setCmdState('btn-gather', canGather(state, u));
  setCmdState('btn-delve', canDelve(state, u));
  setCmdState('btn-wait', Boolean(u && u.moves > 0));
  setCmdState('btn-next-unit', state.units.length > 1);

  document.querySelectorAll('#panel-tabs button').forEach((b) => {
    const active = b.dataset.panel === state.uiPanel
      || (b.dataset.panel === 'more' && ['more', 'realm', 'chronicle', 'missions'].includes(state.uiPanel));
    b.classList.toggle('active', active && (b.dataset.panel === state.uiPanel || (b.dataset.panel === 'more' && state.uiPanel === 'more')));
    if (['realm', 'chronicle', 'missions'].includes(state.uiPanel)) {
      b.classList.toggle('active', b.dataset.panel === 'more');
    }
  });

  const side = document.getElementById('side-panel');
  if (side) side.innerHTML = renderPanel(state);
  wirePanel(app);

  const logEl = document.getElementById('log');
  if (logEl) {
    logEl.innerHTML = state.log.slice(0, 6)
      .map((l) => `<div><span>Y${l.year}</span><span>${l.msg}</span></div>`).join('');
  }

  const banner = document.getElementById('event-banner');
  if (banner) {
    if (state.event) {
      banner.classList.remove('hidden');
      banner.innerHTML = `<strong>${state.event.name}</strong> — ${state.event.text}
        <button type="button" data-ev="accept">Accept</button>
        <button type="button" data-ev="spend">Spend 15g</button>
        <button type="button" data-ev="endure">Endure</button>`;
      banner.querySelectorAll('button').forEach((btn) => {
        btn.onclick = () => {
          resolveEvent(state, btn.dataset.ev);
          beep('good');
          refreshAll(app);
        };
      });
    } else {
      banner.classList.add('hidden');
      banner.innerHTML = '';
    }
  }

  const tip = document.getElementById('tutorial');
  if (tip) {
    if (state.tutorialStep < TUTORIAL.length) {
      const step = TUTORIAL[state.tutorialStep];
      tip.classList.remove('hidden');
      const title = tip.querySelector('.tutorial-title');
      const body = tip.querySelector('.tutorial-body');
      if (title) title.textContent = `${state.tutorialStep + 1}/${TUTORIAL.length} · ${step.title}`;
      if (body) body.textContent = step.body;
    } else {
      tip.classList.add('hidden');
    }
  }

  if (app.canvas) renderMap(app.canvas, state);
  const miniCanvas = document.getElementById('minimap');
  if (miniCanvas) renderMinimap(miniCanvas, state);
  maybeVictory(app);
}

function renderPanel(state) {
  switch (state.uiPanel) {
    case 'city': return cityPanel(state);
    case 'tech': return techPanel(state);
    case 'diplo': return diploPanel(state);
    case 'explore': return explorePanel(state);
    case 'wonders': return wondersPanel(state);
    case 'chronicle': return chroniclePanel(state);
    case 'missions': return missionsPanel(state);
    case 'realm': return realmPanel(state);
    case 'more': return morePanel();
    default: return '';
  }
}

function morePanel() {
  return `<h3>More</h3>
    <div class="chip-actions">
      <button data-act="goto" data-id="realm">Realm</button>
      <button data-act="goto" data-id="chronicle">Chronicle</button>
      <button data-act="goto" data-id="missions">Missions</button>
    </div>
    <p class="muted" style="margin-top:0.75rem">Kingdom records, diplomacy archives, and victory paths.</p>`;
}

function cityPanel(state) {
  const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
  if (!city) {
    return `<h3>Overview</h3>
      <p class="muted">No city yet. Select your Settler and press <b>F</b> or use Found.</p>
      <p>Units: ${state.units.map((u) => u.name).join(', ')}</p>`;
  }
  const growth = city.pop < city.housing && city.happiness > 40 ? '+1?' : '—';
  const queueHtml = city.queue.length
    ? city.queue.map((q, i) => {
      const total = Math.max(q.left, q.turns || q.left || 1);
      const done = Math.max(0, total - q.left);
      const pct = Math.round((done / Math.max(1, total)) * 100);
      return `<div class="project-card">
        <div class="proj-ico">${q.kind === 'unit' ? 'A' : '◆'}</div>
        <div>
          <div class="proj-name">${q.name}</div>
          <div class="proj-desc">${q.kind}</div>
        </div>
        <div class="proj-turns">${q.left} turn${q.left === 1 ? '' : 's'}</div>
        ${i === 0 ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
      </div>`;
    }).join('')
    : '<p class="muted">No active projects.</p>';

  return `<h3>Overview</h3>
    <div class="overview-list">
      <div class="overview-row"><span>Population</span><b>${city.pop} / ${city.housing}</b></div>
      <div class="overview-row"><span>Happiness</span><b>${Math.round(city.happiness)}%</b></div>
      <div class="overview-row"><span>Defense</span><b>${city.defense}</b></div>
      <div class="overview-row"><span>Stage</span><b>${city.stage}</b></div>
      <div class="overview-row"><span>Growth</span><b>${growth}</b></div>
    </div>
    <h4>Projects</h4>
    ${queueHtml}
    <h4>Construct</h4>
    <div class="chip-actions">
      ${Object.entries(BUILDINGS).filter(([id]) => id !== 'town_hall').map(([id, b]) =>
    `<button data-act="build" data-id="${id}" title="${b.desc}">${b.name}</button>`).join('')}
    </div>
    <h4>Train</h4>
    <div class="chip-actions">
      ${Object.entries(UNITS).map(([id, u]) =>
    `<button data-act="train" data-id="${id}">${u.name}</button>`).join('')}
    </div>
    <h4>Your cities</h4>
    ${state.cities.map((c) => `<button data-act="select-city" data-id="${c.id}" class="${c.id === city.id ? 'active-city' : ''}">${c.name} (${c.stage})</button>`).join(' ')}
  `;
}

function techPanel(state) {
  const q = state.player.researchQueue;
  const current = TECHS.find((t) => t.id === q);
  return `<h3>Technology</h3>
    <div class="stat-grid">
      <div><span>Science</span><b>${state.player.science}</b></div>
      <div><span>Queue</span><b>${current ? current.name : '—'}</b></div>
    </div>
    ${TECHS.map((t) => {
    const done = state.player.researched.includes(t.id);
    const locked = t.requires && !t.requires.every((r) => state.player.researched.includes(r));
    return `<div class="list-row">
      <div><b>${t.name}</b> <span class="muted">(${t.cost} sci)</span><br/><span class="muted">${t.desc}</span></div>
      <button data-act="research" data-id="${t.id}" ${done || locked ? 'disabled' : ''}>${done ? 'Done' : locked ? 'Locked' : 'Research'}</button>
    </div>`;
  }).join('')}`;
}

function diploPanel(state) {
  return `<h3>Diplomacy</h3>
    ${state.rivals.map((r) => `<div class="list-card">
      <div class="list-row">
        <div><b style="color:${r.color}">${r.name}</b><br/>
        <span class="muted">${r.ruler} · opinion ${Math.round(r.opinion)}${r.atWar ? ' · WAR' : ''}${r.alliance ? ' · Ally' : ''}${r.collapsed ? ' · Fallen' : ''}</span></div>
      </div>
      ${r.collapsed ? '' : `<div class="chip-actions">
        <button data-act="diplo" data-id="${r.id}" data-cmd="gift">Gift</button>
        <button data-act="diplo" data-id="${r.id}" data-cmd="trade">Trade</button>
        <button data-act="diplo" data-id="${r.id}" data-cmd="ally">Ally</button>
        <button data-act="diplo" data-id="${r.id}" data-cmd="threat">Threat</button>
        <button data-act="diplo" data-id="${r.id}" data-cmd="war">War</button>
        <button data-act="diplo" data-id="${r.id}" data-cmd="peace">Peace</button>
      </div>
      <p class="muted">Memory: ${r.memory.slice(-3).join('; ') || '—'}</p>`}
    </div>`).join('')}`;
}

function explorePanel(state) {
  const sites = state.world.sites.filter((s) => s.discovered);
  const fogLeft = state.world.tiles.filter((t) => t.fog).length;
  return `<h3>Exploration</h3>
    <div class="stat-grid">
      <div><span>World</span><b>${state.world.width}×${state.world.height}</b></div>
      <div><span>Fog left</span><b>${fogLeft}</b></div>
      <div><span>Sites found</span><b>${sites.length}/${state.world.sites.length}</b></div>
      <div><span>Delved</span><b>${state.stats.sitesDelved}</b></div>
    </div>
    ${sites.map((s) => `<div class="list-row">
      <div><b>${s.kind.replace(/_/g, ' ')}</b><br/><span class="muted">(${s.x},${s.y}) ${s.delved ? 'complete' : `${s.progress}/3`}</span></div>
      ${s.delved ? '' : '<span class="muted">Move adjacent & Delve</span>'}
    </div>`).join('') || '<p class="muted">Scout the fog to find ruins and secrets.</p>'}`;
}

function wondersPanel(state) {
  return `<h3>Wonders</h3>
    <p class="muted">Only one civilization can complete each wonder.</p>
    ${state.wonders.map((w) => `<div class="list-row">
      <div><b>${w.name}</b><br/><span class="muted">${w.owner ? `Owned by ${w.owner}` : `${w.progress || 0}/${w.turns}`}</span></div>
      ${w.owner ? '' : `<button data-act="wonder" data-id="${w.id}">Start</button>`}
    </div>`).join('')}`;
}

function chroniclePanel(state) {
  return `<h3>Chronicle</h3>
    <div class="chronicle">
      ${state.chronicle.slice().reverse().map((e) =>
    `<div><span>Year ${e.year}</span>${e.text}</div>`).join('')}
    </div>`;
}

function missionsPanel(state) {
  return `<h3>Missions</h3>
    ${state.missions.slice().reverse().map((m) =>
    `<div class="list-row"><div><b>${m.name}</b><br/><span class="muted">${m.status}${m.status === 'active' ? ` · ${m.turns} turns · reward ${m.reward}g` : ''}</span></div></div>`).join('')
    || '<p class="muted">Missions appear as your realm grows.</p>'}
    <h4>Victory paths</h4>
    <ul class="muted">
      <li>Military — defeat 5 raider bands + 2 cities</li>
      <li>Wonder — complete 2 wonders</li>
      <li>Diplomacy — 3 allies/trade partners</li>
      <li>Exploration — delve 6 sites + 40 lore</li>
      <li>Wealth — 250 gold + 2 cities</li>
    </ul>`;
}

function realmPanel(state) {
  return `<h3>Realm</h3>
    <div class="stat-grid">
      <div><span>Kingdom</span><b>${state.player.name}</b></div>
      <div><span>Taxes</span><b>${state.player.taxes}%</b></div>
      <div><span>Prestige</span><b>${state.player.prestige}</b></div>
      <div><span>Unrest</span><b>${state.player.unrest}</b></div>
    </div>
    <div class="chip-actions">
      <button data-act="tax" data-id="-5">− Tax</button>
      <button data-act="tax" data-id="5">+ Tax</button>
    </div>
    <h4>Stats</h4>
    <div class="muted">Cities founded: ${state.stats.citiesFounded}</div>
    <div class="muted">Raiders slain: ${state.stats.raidersSlain}</div>
    <div class="muted">Sites delved: ${state.stats.sitesDelved}</div>
    <div class="muted">Wonders built: ${state.stats.wondersBuilt}</div>
    <h4>Save slots</h4>
    <div class="chip-actions">
      <button data-act="slot-save" data-id="1">Save Slot 1</button>
      <button data-act="slot-save" data-id="2">Save Slot 2</button>
      <button data-act="slot-save" data-id="3">Save Slot 3</button>
      <button data-act="slot-load" data-id="1">Load 1</button>
      <button data-act="slot-load" data-id="2">Load 2</button>
      <button data-act="slot-load" data-id="3">Load 3</button>
    </div>`;
}

function wirePanel(app) {
  const root = document.getElementById('side-panel');
  root.onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const state = app.stateRef.current;
    const city = state.cities.find((c) => c.id === state.selectedCityId) || state.cities[0];
    const act = btn.dataset.act;
    if (act === 'goto') state.uiPanel = btn.dataset.id;
    if (act === 'build') queueBuilding(state, city, btn.dataset.id);
    if (act === 'train') queueUnit(state, city, btn.dataset.id);
    if (act === 'research') queueResearch(state, btn.dataset.id);
    if (act === 'wonder') startWonder(state, city, btn.dataset.id);
    if (act === 'diplo') diploAction(state, btn.dataset.id, btn.dataset.cmd);
    if (act === 'select-city') state.selectedCityId = btn.dataset.id;
    if (act === 'tax') state.player.taxes = clamp(state.player.taxes + Number(btn.dataset.id), 0, 40);
    if (act === 'slot-save') app.saveSlot(btn.dataset.id);
    if (act === 'slot-load') app.loadSlot(btn.dataset.id);
    beep('ui');
    refreshAll(app);
  };
}

function maybeVictory(app) {
  const state = app.stateRef.current;
  if (!state?.victory) return;
  const modal = document.getElementById('victory-modal');
  if (!modal.classList.contains('hidden')) return;
  document.getElementById('victory-title').textContent = `${state.victory.path} Victory`;
  document.getElementById('victory-body').textContent = state.victory.text;
  modal.classList.remove('hidden');
}
