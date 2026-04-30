// ============================================
// FIREBASE CONFIGURATION (Legacy Compat SDK)
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyD-CMXyf3hABhbKlMMHmOv1MQN0zhLBDQQ",
  authDomain: "findmypet-d9531.firebaseapp.com",
  projectId: "findmypet-d9531",
  storageBucket: "findmypet-d9531.appspot.com",
  messagingSenderId: "488618726667",
  appId: "1:488618726667:web:a9aa39d663da904759be0e"
};

// Initialize Firebase (Legacy Compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
