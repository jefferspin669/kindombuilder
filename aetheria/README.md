# Kingdom Builder — The World of Aetheria

Plain **HTML / CSS / JavaScript** testing build.

## Run

```bash
cd aetheria
python3 -m http.server 8080
```

Then open:

- http://localhost:8080/ — landing page
- http://localhost:8080/game.html — click **Begin Reign** to start

Or from the landing page, click **Begin Reign** / **Play**.

> Must use a local server (not `file://`) so JavaScript modules load.

## Play

1. Click **Begin Reign**
2. Move the Scout (click tiles or WASD)
3. Select Settler → **F** or Found City
4. Build / train from the City panel
5. **End Turn** (or Enter)

| Control | Action |
|---|---|
| Click unit / tile | Select / step |
| WASD / arrows | Move |
| F | Found city |
| G | Gather |
| Tab | Next unit |
| Enter | End turn |

Optional: `npm run smoke`
