# Spindrift Elo

Settle the great debate: which Spindrift flavor is actually the best? This is a head-to-head ranking app. Two cans face off, you pick the one you'd rather drink, and an [Elo rating system](https://en.wikipedia.org/wiki/Elo_rating_system) turns your votes into a live leaderboard of all 23 flavors.

## Features

- **Head-to-head matchups** — tap a can (or use ← / →) to vote
- **Live Elo ratings** — every flavor starts at 1500; K-factor of 32
- **Smart matchmaking** — favors under-played flavors and similarly-rated opponents so the ranking converges quickly
- **Leaderboard** — ranked standings with rating, win–loss record, and win rate
- **Persists locally** — your ratings are saved in `localStorage`; reset anytime
- **Zero build** — plain HTML/CSS/JS, no dependencies

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy

It's a static site, so GitHub Pages works out of the box: push to `main`, then enable Pages (Settings → Pages → deploy from `main` / root).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and layout |
| `styles.css` | Styling |
| `flavors.js` | The 23 flavors, accent colors, and official can images |
| `app.js` | Elo math, matchmaking, persistence, rendering |

## Credits

Flavor names and can images are © [Spindrift](https://drinkspindrift.com). This is a fan-made project and is not affiliated with or endorsed by Spindrift.
