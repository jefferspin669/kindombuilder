# Kingdom Builder — The World of Aetheria

Plain **HTML / CSS / JS** prototype (no build step). Use this to playtest and squash bugs before a fuller game engine.

## Run

```bash
cd aetheria
python3 -m http.server 8080
```

Then open:

- Landing: http://localhost:8080/
- Game: http://localhost:8080/game.html

Or: `npm start` (same server).

> ES modules need a local server — don’t open the HTML via `file://`.

## Layout

```
aetheria/
├── index.html          # landing
├── game.html           # playable game
├── css/
│   ├── landing.css
│   └── game.css
├── js/
│   ├── main.js         # game bootstrap
│   ├── state.js
│   ├── world.js
│   ├── systems.js
│   ├── render.js
│   ├── ui.js
│   ├── data.js
│   ├── utils.js
│   └── landing.js
└── scripts/smoke.mjs   # optional headless checks
```

## Play

1. Move the **Scout** (click tile or arrow keys)
2. **Found City** with the Settler (`F` or City panel)
3. Build / train from **City**
4. Gather deposits with a **Worker** (`G`)
5. **End Turn**

Optional: `npm run smoke` (needs Node) for a quick systems check.
