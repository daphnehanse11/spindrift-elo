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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
}
