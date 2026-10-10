/**
 * Anonymous usage beacon. Event name and wallpaper style only — no identifiers, no payload.
 * Shared so every place that performs an action reports it the same way.
 */
import type { EventName } from './metrics';

export function track(event: EventName, style?: string): void {
  try {
    const body = JSON.stringify({ event, style });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {
    // analytics must never break the page
  }
}
