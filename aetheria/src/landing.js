const continents = [
  {
    id: 'verdoria',
    name: 'Verdoria',
    color: '#3f8f4a',
    blurb: 'The heartland. Rich farmland, dense forests, and peaceful villages—ideal for a first reign.',
    resources: ['Wheat', 'Wood', 'Horses', 'Clay'],
  },
  {
    id: 'ashkar',
    name: 'Ashkar',
    color: '#c45a3a',
    blurb: 'A volcanic continent—dangerous, but rich in iron, coal, gold, gems, and obsidian.',
    resources: ['Iron', 'Coal', 'Gold', 'Gems', 'Obsidian'],
  },
  {
    id: 'frostheim',
    name: 'Frostheim',
    color: '#5b8fb8',
    blurb: 'A frozen kingdom of fur, ice crystal, silver, and fish. Blizzards and ice giants await.',
    resources: ['Fur', 'Ice Crystal', 'Silver', 'Fish'],
  },
  {
    id: 'sunreach',
    name: 'Sunreach',
    color: '#d4a24c',
    blurb: 'Massive desert of salt, incense, oil, and rare relics hidden in pyramids and temples.',
    resources: ['Salt', 'Incense', 'Oil', 'Relics'],
  },
  {
    id: 'emerald',
    name: 'Emerald Isles',
    color: '#2f9e8f',
    blurb: 'Hundreds of islands. Best naval civilization—pearls, coral, fish, and tropical fruit.',
    resources: ['Pearls', 'Fish', 'Coral', 'Tropical Fruit'],
  },
  {
    id: 'shadow',
    name: 'Shadow Wilds',
    color: '#4a4658',
    blurb: 'Corrupted forests and forgotten cities. Few kingdoms survive long. Late-game exploration.',
    resources: ['Moonstone', 'Ancient Relics', 'Mythril'],
  },
];

const grid = document.getElementById('atlas-grid');
const detail = document.getElementById('atlas-detail');

function showContinent(c) {
  detail.style.animation = 'none';
  // reflow for animation restart
  void detail.offsetWidth;
  detail.style.animation = '';
  detail.innerHTML = `
    <h3 style="color:${c.color}">${c.name}</h3>
    <p>${c.blurb}</p>
    <p><strong>Resources:</strong> ${c.resources.join(' · ')}</p>
  `;
  grid.querySelectorAll('.atlas-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === c.id);
  });
}

continents.forEach((c, i) => {
  const btn = document.createElement('button');
  btn.className = 'atlas-btn' + (i === 0 ? ' active' : '');
  btn.dataset.id = c.id;
  btn.style.setProperty('--accent', c.color);
  btn.textContent = c.name;
  btn.addEventListener('click', () => showContinent(c));
  grid.appendChild(btn);
});

showContinent(continents[0]);
