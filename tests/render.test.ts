import { describe, it, expect } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderWallpaper, WALLPAPER_WIDTH as W, WALLPAPER_HEIGHT as H } from '../src/lib/wallpaper';
import { getCountdown } from '../src/lib/countdown';
import { WALLPAPER_STYLES, type WallpaperStyle } from '../src/lib/styles';
import type { ExamInput } from '../src/lib/types';

/**
 * The wallpaper is an image nobody reviews daily, so it can break silently — the character's
 * brows and mouth once drew black-on-black for weeks while every test still passed, because the
 * suite only checked the PNG's dimensions. These tests look at the pixels instead.
 */

const tz = 'UTC';
const now = new Date('2026-10-17T08:00:00Z');

/** Where each style draws eyes and mouth. */
const FACE: Record<string, [number, number, number, number]> = {
  stare: [430, 1800, 310, 260],
  panic: [430, 1780, 310, 400],
  sign: [600, 1520, 220, 200],
  call: [450, 820, 270, 220],
};
const CHARACTERS = ['stare', 'panic', 'sign', 'call'] as const;

const exam = (title: string, date: string): ExamInput => ({ title, date, time: '09:00', durationMinutes: 180 });
/** Next exam is months away. */
const CALM = [exam('A', '2026-12-20'), exam('B', '2026-12-28')];
/** Next exam is three days away and is *not* the last — the tense state. */
const NEAR = [exam('A', '2026-10-20'), exam('B', '2026-10-25'), exam('C', '2026-11-01')];
/** Next exam is three days away and is the last — the hopeful state. */
const FINAL = [exam('A', '2026-10-02'), exam('B', '2026-10-20')];

function render(exams: ExamInput[], style: WallpaperStyle): Buffer {
  return renderWallpaper({ ...getCountdown(exams, now, tz), now, tz, style });
}

async function pixels(png: Buffer, box?: [number, number, number, number]) {
  const img = await loadImage(png);
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const [x, y, w, h] = box ?? [0, 0, W, H];
  return g.getImageData(x, y, w, h).data;
}

/** Share of pixels that are drawn on rather than left black. */
function ink(data: Uint8ClampedArray): number {
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > 60) lit++;
  return lit / (data.length / 4);
}

/** Share of pixels that differ between two renders of the same region. */
function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 60) n++;
  return n / (a.length / 4);
}

describe('every style actually draws something', () => {
  it.each(WALLPAPER_STYLES.map((s) => s.id))('%s is neither blank nor a solid block', async (style) => {
    for (const exams of [CALM, NEAR, FINAL]) {
      const coverage = ink(await pixels(render(exams, style)));
      expect(coverage).toBeGreaterThan(0.005);
      expect(coverage).toBeLessThan(0.25);
    }
  });
});

describe('the characters have faces', () => {
  // Floors are roughly half of what each style actually draws, so a redesign has room
  // but a face that fails to draw at all cannot slip through.
  const FLOOR: Record<string, number> = { stare: 0.03, panic: 0.02, sign: 0.1, call: 0.06 };

  it.each(CHARACTERS)('%s draws eyes and a mouth in every state', async (style) => {
    for (const exams of [CALM, NEAR, FINAL]) {
      const coverage = ink(await pixels(render(exams, style), FACE[style]));
      expect(coverage).toBeGreaterThan(FLOOR[style]);
    }
  });
});

describe('the face responds to the countdown', () => {
  it.each(['stare', 'panic', 'sign'] as const)('%s looks different once the exam is close', async (style) => {
    const calm = await pixels(render(CALM, style), FACE[style]);
    const near = await pixels(render(NEAR, style), FACE[style]);
    expect(changed(calm, near)).toBeGreaterThan(0.03);
  });

  it.each(CHARACTERS)('%s looks different on the last exam', async (style) => {
    const near = await pixels(render(NEAR, style), FACE[style]);
    const final = await pixels(render(FINAL, style), FACE[style]);
    expect(changed(near, final)).toBeGreaterThan(0.015);
  });
});
