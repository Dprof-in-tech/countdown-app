/**
 * Privacy-preserving usage metrics.
 *
 * Nothing identifying is ever written. Counters are plain integers keyed by style/day/source.
 * "Unique wallpapers" is a HyperLogLog fed a salted, truncated hash of the wallpaper link —
 * the sketch only stores a cardinality estimate, and the salt rotates daily/monthly so the
 * hash can't be correlated across periods or reversed into anyone's exam schedule.
 */
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { WALLPAPER_STYLES, type WallpaperStyle } from './styles';

/** The subset of Redis commands the metrics layer needs — swappable in tests. */
export interface MetricsStore {
  incr(key: string): Promise<number>;
  pfadd(key: string, ...members: string[]): Promise<number>;
  pfcount(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(number | string | null)[]>;
  expire(key: string, seconds: number): Promise<number>;
}

export type RenderSource = 'fetch' | 'preview';
export const EVENTS = ['save', 'copy', 'install_open'] as const;
export type EventName = (typeof EVENTS)[number];

const DAY = 86_400;
const KEEP_DAYS = 90 * DAY;
const KEEP_MONTHS = 400 * DAY;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);

/** Salted, truncated hash of a wallpaper link. `period` picks the salt rotation. */
export function fingerprint(link: string, period: 'day' | 'month', now: Date): string {
  const salt = `${process.env.METRICS_SALT ?? 'exam-countdown'}:${period === 'day' ? iso(now) : ym(now)}`;
  return createHash('sha256').update(salt).update('\n').update(link).digest('hex').slice(0, 16);
}

export interface Stats {
  configured: boolean;
  generatedAt: string;
  renders: {
    total: number;
    today: number;
    last14: { date: string; count: number }[];
    byStyle: { id: WallpaperStyle; name: string; count: number }[];
    bySource: Record<RenderSource, number>;
  };
  uniques: { today: number; month: number };
  events: Record<EventName, number>;
}

export function createMetrics(store: MetricsStore | null) {
  const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

  return {
    /** One wallpaper render. `link` is hashed before it touches the store. */
    async recordRender(r: { style: WallpaperStyle; source: RenderSource; link: string; now?: Date }): Promise<void> {
      if (!store) return;
      const now = r.now ?? new Date();
      const day = iso(now);
      const month = ym(now);
      try {
        await Promise.all([
          store.incr('m:renders:total'),
          store.incr(`m:renders:style:${r.style}`),
          store.incr(`m:renders:source:${r.source}`),
          store.incr(`m:renders:day:${day}`).then(() => store.expire(`m:renders:day:${day}`, KEEP_DAYS)),
          store.pfadd(`m:uniques:day:${day}`, fingerprint(r.link, 'day', now)).then(() => store.expire(`m:uniques:day:${day}`, KEEP_DAYS)),
          store.pfadd(`m:uniques:month:${month}`, fingerprint(r.link, 'month', now)).then(() => store.expire(`m:uniques:month:${month}`, KEEP_MONTHS)),
        ]);
      } catch (err) {
        console.warn('[metrics] recordRender failed', err);
      }
    },

    /** A client-side event (save / copy / install). Unknown names are ignored. */
    async recordEvent(name: EventName, style?: string): Promise<boolean> {
      if (!(EVENTS as readonly string[]).includes(name)) return false;
      if (!store) return true;
      try {
        await store.incr(`m:events:${name}`);
        if (style && WALLPAPER_STYLES.some((s) => s.id === style)) await store.incr(`m:events:${name}:style:${style}`);
      } catch (err) {
        console.warn('[metrics] recordEvent failed', err);
      }
      return true;
    },

    async getStats(now = new Date()): Promise<Stats> {
      const days: string[] = [];
      for (let i = 13; i >= 0; i--) days.push(iso(new Date(now.getTime() - i * DAY * 1000)));
      const empty: Stats = {
        configured: !!store,
        generatedAt: now.toISOString(),
        renders: {
          total: 0, today: 0,
          last14: days.map((date) => ({ date, count: 0 })),
          byStyle: WALLPAPER_STYLES.map((s) => ({ id: s.id, name: s.name, count: 0 })),
          bySource: { fetch: 0, preview: 0 },
        },
        uniques: { today: 0, month: 0 },
        events: { save: 0, copy: 0, install_open: 0 },
      };
      if (!store) return empty;
      try {
        const keys = [
          'm:renders:total',
          ...WALLPAPER_STYLES.map((s) => `m:renders:style:${s.id}`),
          'm:renders:source:fetch', 'm:renders:source:preview',
          ...days.map((d) => `m:renders:day:${d}`),
          ...EVENTS.map((e) => `m:events:${e}`),
        ];
        const [values, uToday, uMonth] = await Promise.all([
          store.mget(...keys),
          store.pfcount(`m:uniques:day:${iso(now)}`),
          store.pfcount(`m:uniques:month:${ym(now)}`),
        ]);
        let i = 0;
        const total = n(values[i++]);
        const byStyle = WALLPAPER_STYLES.map((s) => ({ id: s.id, name: s.name, count: n(values[i++]) }));
        const bySource = { fetch: n(values[i++]), preview: n(values[i++]) };
        const last14 = days.map((date) => ({ date, count: n(values[i++]) }));
        const events = Object.fromEntries(EVENTS.map((e) => [e, n(values[i++])])) as Record<EventName, number>;
        return {
          ...empty,
          renders: { total, today: last14[last14.length - 1].count, last14, byStyle, bySource },
          uniques: { today: n(uToday), month: n(uMonth) },
          events,
        };
      } catch (err) {
        console.warn('[metrics] getStats failed', err);
        return empty;
      }
    },
  };
}

let _metrics: ReturnType<typeof createMetrics> | null = null;

/**
 * Process-wide metrics bound to Upstash when its env vars exist; a silent no-op otherwise (local dev).
 * The Vercel Marketplace install names the vars KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
 */
export function metrics() {
  if (!_metrics) {
    // Vercel runtime sets process.env; the Vite dev server exposes .env.local through import.meta.env
    const env = (k: string): string | undefined =>
      process.env[k] ?? ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[k]);
    const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL');
    const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN');
    _metrics = createMetrics(url && token ? (new Redis({ url, token }) as unknown as MetricsStore) : null);
  }
  return _metrics;
}
