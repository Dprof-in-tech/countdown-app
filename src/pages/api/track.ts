import type { APIRoute } from 'astro';
import { metrics, type EventName } from '../../lib/metrics';

export const prerender = false;

/**
 * POST /api/track  { event: "save" | "copy" | "install_open", style?: string }
 * Anonymous counters only — no cookies, no IDs, no payload beyond the event name and style.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { event?: string; style?: string } = {};
  try {
    body = await request.json();
  } catch {
    // sendBeacon may post text/plain
    try { body = JSON.parse(await request.text()); } catch { /* ignore */ }
  }
  const ok = await metrics().recordEvent(body.event as EventName, body.style);
  return new Response(null, { status: ok ? 204 : 400 });
};
