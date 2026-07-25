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

1. Sign in (first run creates a protected **admin** account: `admin` / `admin`)
2. Move the **Scout** (click tile or arrow keys)
3. **Found City** with the Settler (`F` or City panel)
4. Build / train from **City**
5. Gather deposits with a **Worker** (`G`)
6. **End Turn**

### Admin account persistence

Accounts live in `localStorage` key `aetheria_vault`, separate from campaign saves (`aetheria_save`).

- **New Campaign** and **Clear campaign data** never delete the admin account
- **Remember me** keeps you signed in on this browser
- Menu → **Account** to change password
- Sign-in screen can **Export / Import** the account vault as JSON backup

Optional: `npm run smoke` (needs Node) for a quick systems check.
