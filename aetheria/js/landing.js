import { CONTINENTS } from './data.js';

const grid = document.getElementById('atlas-grid');
const detail = document.getElementById('atlas-detail');

function show(c) {
  detail.innerHTML = `
    <h3 style="color:${c.color}">${c.name}</h3>
    <p>${c.blurb}</p>
    <p><strong>Resources:</strong> ${c.resources.join(' · ')}</p>
  `;
  grid.querySelectorAll('.atlas-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === c.id);
  });
}

CONTINENTS.forEach((c, i) => {
  const btn = document.createElement('button');
  btn.className = 'atlas-btn' + (i === 0 ? ' active' : '');
  btn.dataset.id = c.id;
  btn.style.setProperty('--accent', c.color);
  btn.textContent = c.name;
  btn.addEventListener('click', () => show(c));
  grid.appendChild(btn);
});

show(CONTINENTS[0]);
