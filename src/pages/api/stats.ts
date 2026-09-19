import type { APIRoute } from 'astro';
import { metrics } from '../../lib/metrics';

export const prerender = false;

/** GET /api/stats — public, anonymous aggregate usage numbers. */
export const GET: APIRoute = async () => {
  const stats = await metrics().getStats();
  return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=60' } });
};
