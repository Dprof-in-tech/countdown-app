import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { renderWallpaper, WALLPAPER_WIDTH, WALLPAPER_HEIGHT } from './wallpaper';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const SAMPLE = {
  title: 'EEE 576: Introduction to Optimal Control',
  days: 9,
  dateLabel: 'Mon, 28 Sep 2026, 9:00 am',
  index: 0,
  total: 3,
  progress: 0.2,
  tz: 'UTC',
} as const;

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

/**
 * Social card: headline on the left, a phone on the right showing a real render of the Panic style.
 * Fonts are registered by renderWallpaper(), which runs first.
 */
export async function renderOgImage(domain = 'countdown-app-olive-eight.vercel.app'): Promise<Buffer> {
  const wallpaper = await loadImage(renderWallpaper({ ...SAMPLE, now: new Date('2026-09-19T08:00:00Z'), style: 'panic' }));

  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // --- Phone, right side ---
  const phoneW = 262;
  const phoneH = Math.round((phoneW * WALLPAPER_HEIGHT) / WALLPAPER_WIDTH); // 567
  const phoneX = OG_WIDTH - phoneW - 96;
  const phoneY = 110; // runs off the bottom edge on purpose
  const bezel = 8;
  ctx.save();
  roundRect(ctx, phoneX, phoneY, phoneW, phoneH, 40);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, phoneX + bezel, phoneY + bezel, phoneW - bezel * 2, phoneH - bezel * 2, 32);
  ctx.clip();
  ctx.drawImage(wallpaper, phoneX + bezel, phoneY + bezel, phoneW - bezel * 2, phoneH - bezel * 2);
  ctx.restore();

  // --- Copy, left side ---
  const x = 96;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '72px "ExamDisplay", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('Your next exam,', x, 250);
  ctx.fillText('on your lock screen.', x, 332);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '30px "ExamBody", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('Paste your schedule. Get a wallpaper that', x, 400);
  ctx.fillText('counts down the days. Updates every morning.', x, 442);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '26px "ExamBody-medium", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(domain, x, 540);

  return canvas.toBuffer('image/png');
}

/** 180×180 Apple touch icon: black rounded square with the white outline mark. */
export function renderTouchIcon(size = 180): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.0625;
  const inset = size * 0.22;
  ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  return canvas.toBuffer('image/png');
}
