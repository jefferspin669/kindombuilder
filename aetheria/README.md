# Kingdom Builder — The World of Aetheria

Plain **HTML / CSS / JS** strategy prototype (no build step). Bigger map, clearer UI, persistent admin login.

## Run

```bash
cd aetheria
python3 -m http.server 8080
```

- Landing: http://localhost:8080/
- Game: http://localhost:8080/game.html

> Needs a local server (ES modules). Don’t use `file://`.

## What’s in this rebuild

- **80×56** procedural world, fog of war, seasons
- Cities, buildings, units, tech tree, diplomacy, wonders, missions
- Exploration sites to delve, world events, chronicle
- Minimap, camera zoom/pan, tutorial tips, toast feedback, UI sounds
- Multiple save slots + autosave
- Several victory paths (military, wonder, diplomacy, exploration, wealth)
- **Persistent admin account** (`aetheria_vault`) — never wiped by New Campaign

## Default admin

- Username: `admin`
- Password: `admin`  
  Change it under Menu → Account after first login.

## Controls

| Key / action | Effect |
|---|---|
| Click unit / tile | Select / step move |
| WASD or arrows | Move |
| F | Found city (Settler) |
| G | Gather (Worker) |
| Tab | Next unit |
| Enter | End turn |

Optional: `npm run smoke`
