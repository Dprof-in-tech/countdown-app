import type { APIRoute } from 'astro';
import { renderOgImage } from '../lib/og';

/** Built once at deploy time; served as a static file. */
export const prerender = true;

export const GET: APIRoute = async ({ site }) =>
  new Response(await renderOgImage(site?.host), { headers: { 'Content-Type': 'image/png' } });
