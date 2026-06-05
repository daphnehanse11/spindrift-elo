/* Spindrift Elo — head-to-head flavor ranking with an Elo rating system. */

const STORAGE_KEY = "spindrift-elo-v1";
const START_RATING = 1500;
const K = 32;

// --- State -----------------------------------------------------------------

function freshState() {
  const flavors = {};
  for (const f of FLAVORS) {
    flavors[f.id] = { rating: START_RATING, wins: 0, losses: 0 };
  }
  return { flavors, votes: 0, lastPair: null, excluded: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const saved = JSON.parse(raw);
    // Merge so newly-added flavors get default stats without wiping progress.
    const base = freshState();
    for (const id in saved.flavors) {
      if (base.flavors[id]) base.flavors[id] = saved.flavors[id];
    }
    base.votes = saved.votes || 0;
    base.excluded = (saved.excluded || []).filter((id) => base.flavors[id]);
    return base;
  } catch (e) {
    return freshState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
const byId = Object.fromEntries(FLAVORS.map((f) => [f.id, f]));

// --- Backend (optional global leaderboard) ----------------------------------
// Loaded lazily; the app is fully functional without it.

const USER_KEY = "spindrift-user-id";
function getUserId() {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}
const USER_ID = getUserId();

let fb = null;            // the firebase-service module, once loaded
let globalReady = false;  // true once Firestore is connected
let globalRatings = {};   // { flavorId: rating } cache for the live ranking
let globalMeta = { totalVotes: 0, uniqueUsersCount: 0 };
let boardMode = "personal"; // flips to "global" once the backend is ready

function globalRating(id) {
  return typeof globalRatings[id] === "number" ? globalRatings[id] : START_RATING;
}

async function initBackend() {
  try {
    fb = await import("./js/firebase-service.js");
    const ok = await fb.initFirebase();
    if (!ok) return;
    const data = await fb.getGlobalELO();
    if (!data) return;
    globalRatings = {};
    for (const f of FLAVORS) globalRatings[f.id] = globalRating(f.id);
    for (const k in data) {
      if (byId[k]) globalRatings[k] = data[k];
    }
    globalMeta.totalVotes = data.totalVotes || 0;
    globalMeta.uniqueUsersCount = data.uniqueUsersCount || 0;
    globalReady = true;
    boardMode = "global";
    document.getElementById("board-toggle").hidden = false;
    if (activeTab === "rank") renderLeaderboard();
  } catch (err) {
    console.warn("Global leaderboard unavailable:", err);
  }
}

function pushGlobalVote(winnerId, loserId) {
  if (!globalReady) return;
  const rw = globalRating(winnerId);
  const rl = globalRating(loserId);
  const nw = rw + K * (1 - expected(rw, rl));
  const nl = rl + K * (0 - expected(rl, rw));
  globalRatings[winnerId] = nw;
  globalRatings[loserId] = nl;
  globalMeta.totalVotes += 1;
  // Fire-and-forget; failures fall back silently to local-only behavior.
  fb.updateGlobalELO(winnerId, loserId, nw, nl, USER_ID);
  fb.saveVote(USER_ID, winnerId, loserId);
}

// --- Elo --------------------------------------------------------------------

function expected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

function applyResult(winnerId, loserId) {
  const w = state.flavors[winnerId];
  const l = state.flavors[loserId];
  const ew = expected(w.rating, l.rating);
  const el = expected(l.rating, w.rating);
  w.rating += K * (1 - ew);
  l.rating += K * (0 - el);
  w.wins += 1;
  l.losses += 1;
  state.votes += 1;
  saveState();
}

// --- Matchmaking ------------------------------------------------------------

let current = null; // { left, right }

// Flavors the user has marked "haven't had" — kept out of all matchups.
function isExcluded(id) {
  return state.excluded.includes(id);
}
function activeIds() {
  return FLAVORS.map((f) => f.id).filter((id) => !isExcluded(id));
}

function pickPair() {
  const ids = activeIds();
  // First flavor: weight toward the least-played so coverage stays even.
  const minPlays = Math.min(...ids.map((id) => plays(id)));
  const underplayed = ids.filter((id) => plays(id) <= minPlays + 1);
  const a = sample(underplayed);

  // Opponent: prefer a similarly-rated flavor for a meaningful matchup,
  // but keep some randomness so the same pairs don't repeat.
  const others = ids.filter((id) => id !== a);
  others.sort(
    (x, y) =>
      Math.abs(state.flavors[x].rating - state.flavors[a].rating) -
      Math.abs(state.flavors[y].rating - state.flavors[a].rating)
  );
  const poolSize = Math.min(8, others.length);
  let b = sample(others.slice(0, poolSize));

  // Avoid immediately repeating the previous matchup.
  if (state.lastPair && [a, b].sort().join() === state.lastPair) {
    b = sample(others.slice(0, poolSize));
  }

  const pair = Math.random() < 0.5 ? { left: a, right: b } : { left: b, right: a };
  state.lastPair = [a, b].sort().join();
  return pair;
}

function plays(id) {
  const f = state.flavors[id];
  return f.wins + f.losses;
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Rendering: matchup -----------------------------------------------------

const arena = document.getElementById("arena");
const voteCountEl = document.getElementById("vote-count");

function cardHTML(id, side) {
  const f = byId[id];
  return `
    <div class="card" data-id="${id}" data-side="${side}" style="--accent:${f.color}" role="button" tabindex="0">
      <button class="skip" data-skip="${id}" title="Remove ${f.name} from rotation">Haven't had</button>
      <div class="can-wrap"><img class="can" src="${f.img}" alt="${f.name}" loading="eager"></div>
      <div class="card-name">${f.name}</div>
      <div class="pick-hint">Tap to pick</div>
    </div>`;
}

function renderMatchup() {
  voteCountEl.textContent = state.votes.toLocaleString();

  if (activeIds().length < 2) {
    current = null;
    arena.innerHTML = `
      <div class="empty">
        <p class="empty-title">Not enough flavors in rotation</p>
        <p class="empty-sub">You've set too many aside. Restore some from the Leaderboard to keep matching.</p>
        <button class="empty-btn" data-go-rank>Go to Leaderboard</button>
      </div>`;
    arena.querySelector("[data-go-rank]").addEventListener("click", () => setTab("rank"));
    return;
  }

  current = pickPair();
  arena.innerHTML =
    cardHTML(current.left, "left") +
    `<div class="vs">VS</div>` +
    cardHTML(current.right, "right");

  arena.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("click", () => onVote(c.dataset.id));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onVote(c.dataset.id); }
    });
  });
  arena.querySelectorAll(".skip").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      excludeFlavor(b.dataset.skip);
    })
  );
}

function excludeFlavor(id) {
  if (busy || isExcluded(id)) return;
  state.excluded.push(id);
  saveState();
  renderMatchup();
  if (activeTab === "rank") renderLeaderboard();
}

function restoreFlavor(id) {
  state.excluded = state.excluded.filter((x) => x !== id);
  saveState();
  renderLeaderboard();
}

let busy = false;
function onVote(winnerId) {
  if (busy) return;
  busy = true;
  const loserId = winnerId === current.left ? current.right : current.left;

  const winnerEl = arena.querySelector(`.card[data-id="${winnerId}"]`);
  const loserEl = arena.querySelector(`.card[data-id="${loserId}"]`);
  const before = state.flavors[winnerId].rating;
  applyResult(winnerId, loserId);
  const delta = Math.round(state.flavors[winnerId].rating - before);

  pushGlobalVote(winnerId, loserId);

  winnerEl.classList.add("winner");
  loserEl.classList.add("loser");
  showDelta(winnerEl, `+${delta}`);
  showDelta(loserEl, `−${delta}`);

  if (activeTab === "rank") renderLeaderboard();

  setTimeout(() => {
    busy = false;
    renderMatchup();
  }, 620);
}

function showDelta(cardEl, text) {
  const tag = document.createElement("div");
  tag.className = "delta";
  tag.textContent = text;
  cardEl.appendChild(tag);
}

// --- Rendering: leaderboard -------------------------------------------------

const board = document.getElementById("board");

const statEl = document.getElementById("board-stat");

function renderLeaderboard() {
  const global = boardMode === "global" && globalReady;

  // Global view shows every flavor; personal view hides ones you've set aside.
  const pool = global ? FLAVORS.slice() : FLAVORS.filter((f) => !isExcluded(f.id));
  const ranked = pool.sort((a, b) =>
    global
      ? globalRating(b.id) - globalRating(a.id)
      : state.flavors[b.id].rating - state.flavors[a.id].rating
  );

  board.innerHTML = ranked
    .map((f, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
      const rating = global ? globalRating(f.id) : state.flavors[f.id].rating;
      let meta = "";
      if (!global) {
        const s = state.flavors[f.id];
        const games = s.wins + s.losses;
        const wr = games ? Math.round((s.wins / games) * 100) : 0;
        meta = `${s.wins}–${s.losses}${games ? ` · ${wr}%` : ""}`;
      }
      return `
        <li class="row" style="--accent:${f.color}">
          <span class="rank">${medal}</span>
          <img class="row-can" src="${f.img}" alt="">
          <span class="row-name">${f.name}</span>
          <span class="row-record">${meta}</span>
          <span class="row-rating">${Math.round(rating)}</span>
        </li>`;
    })
    .join("");

  if (global) {
    const v = globalMeta.totalVotes.toLocaleString();
    const u = globalMeta.uniqueUsersCount.toLocaleString();
    statEl.textContent = `${v} votes from ${u} ${globalMeta.uniqueUsersCount === 1 ? "person" : "people"}`;
    statEl.hidden = false;
  } else {
    statEl.textContent = `Based on your ${state.votes.toLocaleString()} votes on this device`;
    statEl.hidden = false;
  }

  renderExcluded();
}

const excludedEl = document.getElementById("excluded");

function renderExcluded() {
  if (!state.excluded.length) {
    excludedEl.hidden = true;
    excludedEl.innerHTML = "";
    return;
  }
  excludedEl.hidden = false;
  const chips = state.excluded
    .map((id) => byId[id])
    .map(
      (f) => `
      <button class="chip" data-restore="${f.id}" style="--accent:${f.color}" title="Put ${f.name} back in rotation">
        <img src="${f.img}" alt=""><span>${f.name}</span><span class="chip-plus">+ add back</span>
      </button>`
    )
    .join("");
  excludedEl.innerHTML = `
    <h3 class="excluded-title">Haven't had (${state.excluded.length}) — set aside, not ranked</h3>
    <div class="chips">${chips}</div>`;
  excludedEl
    .querySelectorAll("[data-restore]")
    .forEach((b) => b.addEventListener("click", () => restoreFlavor(b.dataset.restore)));
}

// --- Tabs & controls --------------------------------------------------------

let activeTab = "play";

function setTab(tab) {
  activeTab = tab;
  document.getElementById("view-play").hidden = tab !== "play";
  document.getElementById("view-rank").hidden = tab !== "rank";
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  if (tab === "rank") renderLeaderboard();
}

document
  .querySelectorAll(".tab")
  .forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

document.getElementById("reset").addEventListener("click", () => {
  if (!confirm("Reset all ratings and start fresh?")) return;
  state = freshState();
  saveState();
  renderMatchup();
  if (activeTab === "rank") renderLeaderboard();
});

// Keyboard: ← / → to vote.
document.addEventListener("keydown", (e) => {
  if (activeTab !== "play" || busy) return;
  if (e.key === "ArrowLeft") onVote(current.left);
  if (e.key === "ArrowRight") onVote(current.right);
});

// Leaderboard mode toggle (Everyone / Your picks).
document.querySelectorAll(".seg").forEach((b) =>
  b.addEventListener("click", () => {
    boardMode = b.dataset.mode;
    document
      .querySelectorAll(".seg")
      .forEach((s) => s.classList.toggle("active", s.dataset.mode === boardMode));
    renderLeaderboard();
  })
);

// --- Go ---------------------------------------------------------------------

renderMatchup();
initBackend();
