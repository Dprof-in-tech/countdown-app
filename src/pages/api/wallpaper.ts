import type { APIRoute } from 'astro';
import { getCountdown } from '../../lib/countdown';
import { decodeExamsParam } from '../../lib/link';
import { parseStyle, renderErrorWallpaper, renderWallpaper } from '../../lib/wallpaper';
import { metrics } from '../../lib/metrics';

export const prerender = false;

const PNG_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * GET /api/wallpaper?exams=<json>&tz=<IANA zone>&style=minimal|call|sign
 * Always answers with a PNG so the iOS Shortcut can set it as wallpaper unconditionally.
 */
export const GET: APIRoute = async ({ url }) => {
  const tz = url.searchParams.get('tz') || 'UTC';
  const style = parseStyle(url.searchParams.get('style'));
  const raw = url.searchParams.get('exams');
  const now = new Date();

  try {
    if (raw !== null) {
      const exams = decodeExamsParam(raw);
      if (!exams) {
        return new Response(renderErrorWallpaper('Wallpaper link is malformed — regenerate it from the app.'), { headers: PNG_HEADERS });
      }
      const countdown = getCountdown(exams, now, tz);
      const png = renderWallpaper({ ...countdown, now, tz, style });
      // The page's live preview appends a cache-busting `_`; anything else is a real fetch (Shortcut, browser).
      const source = url.searchParams.has('_') ? 'preview' : 'fetch';
      await metrics().recordRender({ style, source, link: `${raw}|${tz}`, now });
      return new Response(png, { headers: PNG_HEADERS });
    }
    const countdown = getCountdown([], now, tz);
    return new Response(renderWallpaper({ ...countdown, now, tz, style }), { headers: PNG_HEADERS });
  } catch (err) {
    console.error('[wallpaper] render failed', err);
    return new Response(renderErrorWallpaper('Could not render wallpaper.'), { headers: PNG_HEADERS });
  }
};
