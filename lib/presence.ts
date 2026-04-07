/**
 * Real-time user presence via Firebase Realtime Database.
 * Tracks approximate user locations (from IP geolocation) and
 * syncs active user positions to all connected clients for
 * rendering density dots on the 3D globe.
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onDisconnect, onValue, serverTimestamp } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyC36eXXLGdGqeQCdE7IdxMenKZvtmkEtQA",
  authDomain: "skyport-globe.firebaseapp.com",
  databaseURL: "https://skyport-globe-default-rtdb.firebaseio.com",
  projectId: "skyport-globe",
  storageBucket: "skyport-globe.firebasestorage.app",
  messagingSenderId: "125963711659",
  appId: "1:125963711659:web:fd8c4d6b27f62c958cf3ee",
};

// Unique session ID per tab
const sessionId = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

let db: ReturnType<typeof getDatabase> | null = null;

function getDb() {
  if (!db) {
    const app = initializeApp(firebaseConfig, 'presence');
    db = getDatabase(app);
  }
  return db;
}

export interface ActiveUser {
  lat: number;
  lon: number;
  t: number;
}

/**
 * Register this user's presence. Call once with the IP-derived lat/lon.
 * Sets up onDisconnect for auto-cleanup and a heartbeat to keep entry fresh.
 */
export function registerPresence(lat: number, lon: number): () => void {
  try {
    const database = getDb();
    const userRef = ref(database, `presence/${sessionId}`);

    const data = { lat, lon, t: Date.now() };

    // Write initial presence
    set(userRef, data);

    // Auto-remove when user disconnects (closes tab, loses connection)
    onDisconnect(userRef).remove();

    // Heartbeat every 60s to confirm still active
    const heartbeat = setInterval(() => {
      set(userRef, { lat, lon, t: Date.now() });
    }, 60000);

    // Return cleanup function
    return () => {
      clearInterval(heartbeat);
      set(userRef, null); // Remove on manual cleanup
    };
  } catch (err) {
    console.warn('[SKYPORT] Presence registration failed:', err);
    return () => {};
  }
}

/**
 * Subscribe to all active user locations.
 * Calls the callback with an array of {lat, lon} whenever presence changes.
 * Filters out stale entries (>2 minutes old).
 */
export function subscribePresence(callback: (users: ActiveUser[]) => void): () => void {
  try {
    const database = getDb();
    const presenceRef = ref(database, 'presence');

    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        callback([]);
        return;
      }

      const now = Date.now();
      const users: ActiveUser[] = [];

      for (const key of Object.keys(val)) {
        const entry = val[key];
        // Filter out stale entries (older than 2 minutes)
        if (entry && typeof entry.lat === 'number' && typeof entry.lon === 'number' && (now - entry.t) < 120000) {
          users.push({ lat: entry.lat, lon: entry.lon, t: entry.t });
        }
      }

      callback(users);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[SKYPORT] Presence subscription failed:', err);
    return () => {};
  }
}
