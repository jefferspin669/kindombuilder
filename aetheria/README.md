# Kingdom Builder — The World of Aetheria

Plain **HTML / CSS / JavaScript** testing build. No login, no build step.

## Run

```bash
cd aetheria
python3 -m http.server 8080
```

- Landing: http://localhost:8080/
- Game: http://localhost:8080/game.html

> ES modules need a local server — don’t open via `file://`.

## Play

Open the game page and start immediately. Use Menu for New / Save / Load.

| Control | Action |
|---|---|
| Click unit / tile | Select / step move |
| WASD or arrows | Move |
| F | Found city (Settler) |
| G | Gather (Worker) |
| Tab | Next unit |
| Enter | End turn |

Optional: `npm run smoke`
