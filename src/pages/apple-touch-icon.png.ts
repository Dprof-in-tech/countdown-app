import type { APIRoute } from 'astro';
import { renderTouchIcon } from '../lib/og';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(renderTouchIcon(180), { headers: { 'Content-Type': 'image/png' } });
