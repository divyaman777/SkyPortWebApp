/**
 * push-alerts.ts
 *
 * "ISS overhead in 10 minutes" browser notifications.
 * Frontend half of the SkyPortService backend: registers the service worker,
 * subscribes via the Push API (VAPID), and hands the subscription + the
 * user's approximate location to the AWS Lambda subscription endpoint.
 */

import { getObserverLocation } from './observer-location';

// From SkyportServiceStack outputs (SkyPortCDK)
const SUBSCRIBE_URL = 'https://j5wvsg6iwlsdd6w6ynqwntwsle0zcyvx.lambda-url.ap-south-1.on.aws/';
const VAPID_PUBLIC_KEY = 'BNx7MB-8DPCtGCfHx1_9wOc8yD2PqRgnIPZFV5P5lb-Y9z5JVUDW9jGPwVX0tkuxJFSwwEA3cP4tiyxRafZLV0g';

const ENABLED_KEY = 'skyport_pass_alerts';

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function alertsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Full enable flow: permission → service worker → push subscription → backend.
 * Returns an error message on failure, null on success.
 */
export async function enablePassAlerts(): Promise<string | null> {
  if (!pushSupported()) return 'Notifications are not supported in this browser';

  const location = await getObserverLocation();
  if (!location) return 'Could not determine your location';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Notification permission was denied';

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const json = subscription.toJSON();
    const res = await fetch(SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        lat: location.lat,
        lon: location.lon,
        leadMinutes: 10,
      }),
    });
    if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);

    localStorage.setItem(ENABLED_KEY, '1');
    console.log('[SKYPORT] Pass alerts enabled');
    return null;
  } catch (err) {
    console.warn('[SKYPORT] Pass alert subscribe failed:', err);
    return 'Subscription failed — please try again';
  }
}

export async function disablePassAlerts(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await reg?.pushManager.getSubscription();
    if (subscription) {
      await fetch(SUBSCRIBE_URL, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn('[SKYPORT] Pass alert unsubscribe issue:', err);
  }
  try { localStorage.removeItem(ENABLED_KEY); } catch {}
  console.log('[SKYPORT] Pass alerts disabled');
}
