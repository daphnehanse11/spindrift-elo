// Firestore-backed global leaderboard. Mirrors the taylor-swift-elo service.
// All functions no-op gracefully when Firebase isn't configured, so the app
// always works local-only as a fallback.
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let db = null;
let initialized = false;
let fns = null;

export async function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured — using local storage only.");
    return false;
  }
  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
    );
    const { getFirestore, doc, getDoc, setDoc, addDoc, collection, increment } =
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    fns = { doc, getDoc, setDoc, addDoc, collection, increment };
    initialized = true;
    console.log("Firebase initialized.");
    return true;
  } catch (err) {
    console.error("Firebase init failed:", err);
    initialized = false;
    return false;
  }
}

export function isInitialized() {
  return initialized;
}

// Read the global ratings doc: { [flavorId]: rating, totalVotes, uniqueUsersCount }.
export async function getGlobalELO() {
  if (!initialized) return null;
  try {
    const { doc, getDoc } = fns;
    const snap = await getDoc(doc(db, "globalELO", "ratings"));
    return snap.exists() ? snap.data() : {};
  } catch (err) {
    console.error("getGlobalELO failed:", err);
    return null;
  }
}

// Append a raw vote record (winner/loser/user/timestamp).
export async function saveVote(userId, winnerId, loserId) {
  if (!initialized) return;
  try {
    const { collection, addDoc } = fns;
    await addDoc(collection(db, "votes"), {
      userId,
      winnerId,
      loserId,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("saveVote failed:", err);
  }
}

// Merge the two updated ratings into the global doc; bump vote/user counters.
export async function updateGlobalELO(winnerId, loserId, newWinner, newLoser, userId) {
  if (!initialized) return;
  try {
    const { doc, getDoc, setDoc, increment } = fns;

    const userRef = doc(db, "uniqueUsers", userId);
    const isNewUser = !(await getDoc(userRef)).exists();

    const updates = {
      [winnerId]: newWinner,
      [loserId]: newLoser,
      totalVotes: increment(1),
      lastUpdated: Date.now(),
    };
    if (isNewUser) updates.uniqueUsersCount = increment(1);

    await setDoc(doc(db, "globalELO", "ratings"), updates, { merge: true });
    if (isNewUser) await setDoc(userRef, { firstVote: Date.now() });
  } catch (err) {
    console.error("updateGlobalELO failed:", err);
  }
}
