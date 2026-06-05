// Firebase configuration for the GLOBAL leaderboard (optional).
//
// Until you fill this in, the app runs perfectly in local-only mode — every
// visitor just gets their own private ratings. To enable the shared "Everyone"
// leaderboard:
//   1. Create a Firebase project + Firestore database (test mode is fine).
//   2. Register a web app and copy its firebaseConfig object below.
//   3. Publish js/../firestore.rules from the Firebase console (or CLI).
//   4. Commit — GitHub Actions redeploys automatically.
export const firebaseConfig = {
  apiKey: "AIzaSyAkF4sIwCn6e-da5HNrMmj3HyZQQg4sEOs",
  authDomain: "spindrift-elo.firebaseapp.com",
  projectId: "spindrift-elo",
  storageBucket: "spindrift-elo.firebasestorage.app",
  messagingSenderId: "113747691789",
  appId: "1:113747691789:web:a8e085073aa4c97dc3c844",
  measurementId: "G-6GXQER1JPE",
};

export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
}
