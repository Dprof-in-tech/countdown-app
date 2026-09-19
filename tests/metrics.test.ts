import { describe, it, expect, beforeEach } from 'vitest';
import { createMetrics, fingerprint, type MetricsStore } from '../src/lib/metrics';

/** In-memory stand-in for the handful of Redis commands the metrics layer uses. */
function fakeStore(): MetricsStore & { data: Map<string, number>; sets: Map<string, Set<string>>; ttl: Map<string, number> } {
  const data = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  const ttl = new Map<string, number>();
  return {
    data, sets, ttl,
    async incr(key) { const v = (data.get(key) ?? 0) + 1; data.set(key, v); return v; },
    async pfadd(key, ...members) { const s = sets.get(key) ?? new Set(); members.forEach((m) => s.add(m)); sets.set(key, s); return 1; },
    async pfcount(key) { return sets.get(key)?.size ?? 0; },
    async mget(...keys) { return keys.map((k) => data.get(k) ?? null); },
    async expire(key, seconds) { ttl.set(key, seconds); return 1; },
  };
}

const now = new Date('2026-09-19T10:00:00Z');

describe('metrics', () => {
  let store: ReturnType<typeof fakeStore>;
  beforeEach(() => { store = fakeStore(); });

  it('fingerprint is a salted hash — never the raw link, and different per day and per month', () => {
    const raw = '[{"title":"EEE 576","date":"2026-09-28","time":"09:00"}]';
    const a = fingerprint(raw, 'day', now);
    const b = fingerprint(raw, 'day', new Date('2026-09-20T10:00:00Z'));
    const m1 = fingerprint(raw, 'month', now);
    const m2 = fingerprint(raw, 'month', new Date('2026-09-25T10:00:00Z'));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toContain('EEE');
    expect(a).not.toBe(b);
    expect(m1).toBe(m2);
    expect(fingerprint(raw, 'day', now)).toBe(a);
  });

  it('recordRender bumps totals, style, day, source, and uniques', async () => {
    const m = createMetrics(store);
    await m.recordRender({ style: 'sign', source: 'fetch', link: 'A', now });
    await m.recordRender({ style: 'sign', source: 'preview', link: 'A', now });
    await m.recordRender({ style: 'call', source: 'fetch', link: 'B', now });
    expect(store.data.get('m:renders:total')).toBe(3);
    expect(store.data.get('m:renders:style:sign')).toBe(2);
    expect(store.data.get('m:renders:style:call')).toBe(1);
    expect(store.data.get('m:renders:day:2026-09-19')).toBe(3);
    expect(store.data.get('m:renders:source:fetch')).toBe(2);
    expect(store.data.get('m:renders:source:preview')).toBe(1);
    expect(store.sets.get('m:uniques:day:2026-09-19')?.size).toBe(2);
    expect(store.sets.get('m:uniques:month:2026-09')?.size).toBe(2);
    // nothing stored resembles the link itself
    for (const s of store.sets.values()) for (const member of s) expect(member).not.toContain('A');
  });

  it('daily keys expire; uniques keyed by fetch-only', async () => {
    const m = createMetrics(store);
    await m.recordRender({ style: 'minimal', source: 'preview', link: 'X', now });
    expect(store.ttl.get('m:renders:day:2026-09-19')).toBeGreaterThan(0);
    expect(store.ttl.get('m:uniques:day:2026-09-19')).toBeGreaterThan(0);
  });

  it('recordEvent only accepts known events', async () => {
    const m = createMetrics(store);
    expect(await m.recordEvent('save', 'stare')).toBe(true);
    expect(await m.recordEvent('nope' as any, 'stare')).toBe(false);
    expect(store.data.get('m:events:save')).toBe(1);
    expect(store.data.get('m:events:save:style:stare')).toBe(1);
  });

  it('getStats assembles the dashboard shape', async () => {
    const m = createMetrics(store);
    await m.recordRender({ style: 'sign', source: 'fetch', link: 'A', now });
    await m.recordRender({ style: 'panic', source: 'fetch', link: 'B', now: new Date('2026-09-18T10:00:00Z') });
    await m.recordEvent('save', 'sign');
    const stats = await m.getStats(now);
    expect(stats.configured).toBe(true);
    expect(stats.renders.total).toBe(2);
    expect(stats.renders.today).toBe(1);
    expect(stats.renders.byStyle.find((s) => s.id === 'sign')?.count).toBe(1);
    expect(stats.renders.byStyle.find((s) => s.id === 'minimal')?.count).toBe(0);
    expect(stats.renders.last14).toHaveLength(14);
    expect(stats.renders.last14.at(-1)).toEqual({ date: '2026-09-19', count: 1 });
    expect(stats.renders.last14.at(-2)).toEqual({ date: '2026-09-18', count: 1 });
    expect(stats.uniques.today).toBe(1);
    expect(stats.uniques.month).toBe(2);
    expect(stats.events.save).toBe(1);
  });

  it('is a silent no-op without a store', async () => {
    const m = createMetrics(null);
    await expect(m.recordRender({ style: 'sign', source: 'fetch', link: 'A', now })).resolves.toBeUndefined();
    const stats = await m.getStats(now);
    expect(stats.configured).toBe(false);
    expect(stats.renders.total).toBe(0);
  });
});
