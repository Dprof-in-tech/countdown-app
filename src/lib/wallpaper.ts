import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const WALLPAPER_WIDTH = 1170;
export const WALLPAPER_HEIGHT = 2532;

import { messageFor, parseStyle, WALLPAPER_STYLES, type WallpaperStyle } from './styles';
export { messageFor, parseStyle, WALLPAPER_STYLES, type WallpaperStyle };

export interface WallpaperData {
  title: string;
  days: number | null;
  dateLabel: string;
  index: number;
  total: number;
  progress: number;
  now: Date;
  tz: string;
  style?: WallpaperStyle;
}

// ---------------------------------------------------------------------------
// Fonts

const FONT_DISPLAY = 'ExamDisplay';
const FONT_BODY = 'ExamBody';
let fontsReady = false;

/** Register bundled Inter fonts once. Lambda has no system fonts, so this is required on Vercel. */
function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const candidates = [
    fileURLToPath(new URL('../assets/fonts/', import.meta.url)),
    path.join(process.cwd(), 'src/assets/fonts'),
  ];
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'InterDisplay-Bold.ttf')));
  if (!dir) {
    console.warn('[wallpaper] font directory not found; falling back to system fonts');
    return;
  }
  GlobalFonts.registerFromPath(path.join(dir, 'InterDisplay-Bold.ttf'), FONT_DISPLAY);
  GlobalFonts.registerFromPath(path.join(dir, 'Inter-SemiBold.ttf'), `${FONT_BODY}-semibold`);
  GlobalFonts.registerFromPath(path.join(dir, 'Inter-Medium.ttf'), `${FONT_BODY}-medium`);
  GlobalFonts.registerFromPath(path.join(dir, 'Inter-Regular.ttf'), FONT_BODY);
}

const font = (px: number, family: string) => `${px}px "${family}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const display = (px: number) => font(px, FONT_DISPLAY);
const body = (px: number, weight: 'regular' | 'medium' | 'semibold' = 'regular') =>
  font(px, weight === 'regular' ? FONT_BODY : `${FONT_BODY}-${weight}`);

// ---------------------------------------------------------------------------
// Helpers

/** Greedy word-wrap; breaks over-long single words by character. */
function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
    } else {
      let chunk = '';
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Wrap at `size`, shrinking until it fits in `maxLines`. Returns the lines and the size used. */
function fitText(ctx: SKRSContext2D, text: string, maxWidth: number, size: number, maxLines: number, minSize: number, fontFor: (px: number) => string) {
  ctx.font = fontFor(size);
  let lines = wrap(ctx, text, maxWidth);
  while (lines.length > maxLines && size > minSize) {
    size -= 6;
    ctx.font = fontFor(size);
    lines = wrap(ctx, text, maxWidth);
  }
  return { lines: lines.slice(0, maxLines), size };
}

function drawLines(ctx: SKRSContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function formatToday(now: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  }
}

/** Thick white line-art stroke on a black fill. */
function stroke(ctx: SKRSContext2D, width = 14) {
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#000000';
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

const W = WALLPAPER_WIDTH;
const H = WALLPAPER_HEIGHT;
const MARGIN = 96;
const CONTENT_W = W - MARGIN * 2;

function headlineFor(days: number): string {
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : String(days);
}

// ---------------------------------------------------------------------------
// Style: minimal

function paintMinimal(ctx: SKRSContext2D, data: WallpaperData) {
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = body(40, 'medium');
  ctx.textAlign = 'right';
  ctx.fillText(formatToday(data.now, data.tz).toUpperCase(), W - MARGIN, 700);
  ctx.textAlign = 'left';

  let y = 1180;
  if (data.days === null) {
    ctx.fillStyle = '#ffffff';
    const { lines, size } = fitText(ctx, data.title, CONTENT_W, 120, 3, 72, display);
    y = drawLines(ctx, lines, MARGIN, y, size * 1.14);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = body(44);
    ctx.fillText(data.total === 0 ? 'Add your exams to get a countdown here.' : messageFor(null), MARGIN, y + 40);
    return;
  }

  const days = data.days;
  const headline = headlineFor(days);
  ctx.fillStyle = '#ffffff';
  ctx.font = display(days > 1 ? 300 : 200);
  ctx.fillText(headline, MARGIN - 8, y);
  const headlineW = ctx.measureText(headline).width;

  ctx.font = body(64, 'semibold');
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const tag = days === 1 ? 'day to' : days > 1 ? 'days to' : 'is the day for';
  if (days > 1 && headlineW + 40 + ctx.measureText(tag).width <= CONTENT_W) {
    ctx.fillText(tag, MARGIN + headlineW + 24, y);
  } else {
    y += 90;
    ctx.fillText(tag, MARGIN, y);
  }

  y += 130;
  ctx.fillStyle = '#ffffff';
  const { lines, size } = fitText(ctx, data.title, CONTENT_W, 92, 4, 56, display);
  y = drawLines(ctx, lines, MARGIN, y, size * 1.18);

  y += 24;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = body(48, 'medium');
  ctx.fillText(data.dateLabel, MARGIN, y);

  y += 110;
  paintProgress(ctx, y, data);
}

function paintProgress(ctx: SKRSContext2D, y: number, data: WallpaperData) {
  const barH = 14;
  roundRect(ctx, MARGIN, y, CONTENT_W, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  if (data.progress > 0) {
    roundRect(ctx, MARGIN, y, Math.max(barH, CONTENT_W * data.progress), barH, barH / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = body(36);
  ctx.textAlign = 'left';
  ctx.fillText(`Exam ${data.index + 1} of ${data.total}`, MARGIN, y + 70);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(data.progress * 100)}% through exam period`, W - MARGIN, y + 70);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Style: incoming call

function paintCall(ctx: SKRSContext2D, data: WallpaperData) {
  const cx = W / 2;
  ctx.textAlign = 'center';

  // Avatar: circle with a worried face
  const ay = 900;
  const r = 130;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(cx, ay, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - 45, ay - 25, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 45, ay - 25, 12, 0, Math.PI * 2); ctx.fill();
  // mouth: frown, or a flat line when it's over
  ctx.beginPath();
  if (data.days === null) {
    ctx.moveTo(cx - 40, ay + 45); ctx.lineTo(cx + 40, ay + 45);
  } else {
    ctx.arc(cx, ay + 80, 50, Math.PI * 1.2, Math.PI * 1.8);
  }
  ctx.stroke();

  // Caller
  let y = ay + r + 150;
  ctx.fillStyle = '#ffffff';
  const caller = data.days === null ? 'REST' : 'EXAM';
  ctx.font = display(150);
  ctx.fillText(caller, cx, y);
  y += 90;
  ctx.font = body(56);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const sub = data.days === null
    ? 'is calling. Finally.'
    : data.days === 0 ? 'is calling. Now.'
    : `is calling in ${data.days} day${data.days === 1 ? '' : 's'}`;
  ctx.fillText(sub, cx, y);

  // Course + date, small
  y += 130;
  if (data.days !== null) {
    ctx.fillStyle = '#ffffff';
    const { lines, size } = fitText(ctx, data.title, CONTENT_W, 52, 3, 40, (px) => body(px, 'semibold'));
    y = drawLines(ctx, lines, cx, y, size * 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = body(40);
    ctx.fillText(data.dateLabel, cx, y + 10);
  } else if (data.total > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = body(44);
    ctx.fillText(`All ${data.total} exams done.`, cx, y);
  }

  // Secondary actions
  const sy = 1850;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = body(34);
  drawIconLabel(ctx, cx - 300, sy, 'Remind Me', (x, yy) => {
    ctx.beginPath(); ctx.arc(x, yy, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, yy - 16); ctx.lineTo(x, yy); ctx.lineTo(x + 12, yy + 8); ctx.stroke();
  });
  drawIconLabel(ctx, cx + 300, sy, 'Message', (x, yy) => {
    roundRect(ctx, x - 34, yy - 24, 68, 46, 12); ctx.stroke();
  });

  // Decline / Accept
  const by = 2130;
  const br = 90;
  ctx.lineWidth = 8;
  // Decline (outlined, dim) — an X
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(cx - 260, by, br, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 260 - 30, by - 30); ctx.lineTo(cx - 260 + 30, by + 30);
  ctx.moveTo(cx - 260 + 30, by - 30); ctx.lineTo(cx - 260 - 30, by + 30);
  ctx.stroke();
  // Accept (solid white) — a handset
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx + 260, by, br, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 260 - 34, by - 30);
  ctx.quadraticCurveTo(cx + 260 - 34, by + 34, cx + 260 + 30, by + 34);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = body(36);
  ctx.fillText('Decline', cx - 260, by + br + 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.days === null ? 'Rest' : 'Study', cx + 260, by + br + 60);
  ctx.textAlign = 'left';
}

function drawIconLabel(ctx: SKRSContext2D, x: number, y: number, label: string, icon: (x: number, y: number) => void) {
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  icon(x, y);
  ctx.fillText(label, x, y + 85);
}

// ---------------------------------------------------------------------------
// Style: sign — an original little character (3/4 view, hand on hip) holding up a placard

interface Placard { x: number; y: number; w: number; h: number; draw: () => void }

/** Measure the placard contents and return a closure that paints it, so the character can be positioned first. */
function layoutPlacard(ctx: SKRSContext2D, data: WallpaperData, w: number): Omit<Placard, 'x' | 'y'> & { paint: (x: number, y: number) => void } {
  const pad = 64;
  const headline = data.days === null ? data.title : `${headlineFor(data.days)}${data.days > 1 ? ' days' : ''}`;
  const sub = data.days === null ? '' : `to ${data.title}`;
  const head = fitText(ctx, headline, w - pad * 2, data.days !== null && data.days > 1 ? 150 : 110, 2, 70, display);
  const subT = sub ? fitText(ctx, sub, w - pad * 2, 50, 3, 36, (px) => body(px, 'semibold')) : { lines: [] as string[], size: 0 };
  const headLH = head.size * 1.1;
  const subLH = subT.size * 1.3;

  // Offsets from the placard's top edge to each baseline
  const headBase = pad + head.size * 0.9;
  let cursor = headBase + (head.lines.length - 1) * headLH;
  let subBase = 0;
  if (subT.lines.length) {
    subBase = cursor + head.size * 0.35 + subT.size;
    cursor = subBase + (subT.lines.length - 1) * subLH;
  }
  let dateBase = 0;
  if (data.days !== null) {
    dateBase = cursor + 70;
    cursor = dateBase;
  }
  const h = cursor + pad;

  return {
    w, h,
    draw: () => {},
    paint: (x, y) => {
      const cx = x + w / 2;
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = display(head.size);
      drawLines(ctx, head.lines, cx, y + headBase, headLH);
      if (subT.lines.length) {
        ctx.font = body(subT.size, 'semibold');
        drawLines(ctx, subT.lines, cx, y + subBase, subLH);
      }
      if (data.days !== null) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = body(36);
        ctx.fillText(data.dateLabel, cx, y + dateBase);
      }
    },
  };
}

type Mood = 'happy' | 'stern' | 'alarmed';

/**
 * Draws the character with its feet at (0, 0) in the current transform, facing right.
 * Returns the hand position (where the placard stick is gripped) in the same coordinates.
 */
function drawCharacter(ctx: SKRSContext2D, mood: Mood): { handX: number; handY: number } {
  ctx.lineWidth = 16;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#000000';

  // Raised arm (far side) — drawn first so the body overlaps its root
  const hand = { handX: -150, handY: -760 };
  ctx.beginPath();
  ctx.moveTo(-140, -330);
  ctx.bezierCurveTo(-250, -380, -270, -600, -185, -700);
  ctx.lineTo(hand.handX, hand.handY);
  ctx.stroke();

  // Body: loaf with a dome, slightly narrower at the waist, flared at the base
  ctx.beginPath();
  ctx.moveTo(-165, 0);
  ctx.bezierCurveTo(-150, -200, -175, -330, -165, -430);
  ctx.bezierCurveTo(-155, -600, 150, -620, 175, -430);
  ctx.bezierCurveTo(185, -330, 150, -200, 170, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Near arm: akimbo — out to an elbow, back to the hip; the gap in the middle is the classic triangle
  ctx.beginPath();
  ctx.moveTo(150, -330);
  ctx.lineTo(300, -230);
  ctx.lineTo(160, -110);
  ctx.stroke();
  // Hand on hip: a small bump where the arm meets the body
  ctx.beginPath();
  ctx.arc(165, -110, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Fist holding the stick
  ctx.beginPath();
  ctx.arc(hand.handX, hand.handY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Face — eyes offset to the right for a 3/4 view
  ctx.fillStyle = '#ffffff';
  const eyeY = -500;
  ctx.beginPath(); ctx.arc(20, eyeY, 13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(100, eyeY - 5, 13, 0, Math.PI * 2); ctx.fill();

  ctx.lineWidth = 10;
  ctx.beginPath();
  if (mood === 'happy') {
    // relaxed brows + smile
    ctx.moveTo(0, eyeY - 45); ctx.quadraticCurveTo(20, eyeY - 60, 40, eyeY - 48);
    ctx.moveTo(85, eyeY - 52); ctx.quadraticCurveTo(105, eyeY - 66, 125, eyeY - 54);
    ctx.moveTo(35, eyeY + 45); ctx.quadraticCurveTo(75, eyeY + 90, 115, eyeY + 40);
  } else if (mood === 'stern') {
    // one raised brow, flat unimpressed mouth
    ctx.moveTo(-5, eyeY - 40); ctx.lineTo(45, eyeY - 52);
    ctx.moveTo(80, eyeY - 75); ctx.lineTo(130, eyeY - 62);
    ctx.moveTo(45, eyeY + 60); ctx.lineTo(110, eyeY + 55);
  } else {
    // alarmed: both brows angled in, small open mouth
    ctx.moveTo(-5, eyeY - 55); ctx.lineTo(45, eyeY - 40);
    ctx.moveTo(80, eyeY - 45); ctx.lineTo(130, eyeY - 62);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(75, eyeY + 65, 18, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.stroke();

  return hand;
}

function paintSign(ctx: SKRSContext2D, data: WallpaperData) {
  const mood: Mood = data.days === null ? 'happy' : data.days <= 6 ? 'alarmed' : data.days <= 29 ? 'stern' : 'happy';

  // Character: feet at (footX, groundY), leaning a few degrees into the raised arm
  const groundY = 2090;
  const footX = W / 2 + 70;
  const lean = -0.045;
  const scale = 1.0;

  ctx.save();
  ctx.translate(footX, groundY);
  ctx.rotate(lean);
  ctx.scale(scale, scale);
  const hand = drawCharacter(ctx, mood);
  // Stick continues above the fist; the placard hangs from its top
  const stickTop = hand.handY - 110;
  ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(hand.handX, hand.handY - 30); ctx.lineTo(hand.handX, stickTop); ctx.stroke();

  // Placard, held at a slight tilt, centred over the stick
  const placard = layoutPlacard(ctx, data, 800);
  ctx.save();
  ctx.translate(hand.handX, stickTop);
  ctx.rotate(0.015); // placard hangs a touch straighter than the leaning stick
  placard.paint(-placard.w / 2 + 110, -placard.h + 8);
  ctx.restore();
  ctx.restore();

  // Message under the character
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  const msg = fitText(ctx, messageFor(data.days), CONTENT_W, 64, 2, 44, (px) => body(px, 'semibold'));
  drawLines(ctx, msg.lines, W / 2, groundY + 140, msg.size * 1.3);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Style: stare — the character, head-on, arms crossed, looking at you. Yes, you.

/** A rounded tube: white outline, black interior — covers whatever it's drawn over. */
function capsule(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number, thickness: number) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = thickness; ctx.stroke();
  ctx.strokeStyle = '#000000'; ctx.lineWidth = thickness - 36; ctx.stroke();
}

function stareLineFor(days: number | null): string {
  if (days === null) return "We're done here.";
  if (days <= 0) return "It's today.";
  if (days === 1) return 'Tomorrow. Really?';
  if (days <= 6) return 'Seriously?';
  if (days <= 29) return 'You again?';
  return "Oh, it's you.";
}

function paintStare(ctx: SKRSContext2D, data: WallpaperData) {
  const mood: Mood = data.days === null ? 'happy' : data.days <= 6 ? 'alarmed' : data.days <= 29 ? 'stern' : 'happy';
  const cx = W / 2;

  // --- Text block ---
  ctx.textAlign = 'center';
  let y = 900;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = display(88);
  ctx.fillText(stareLineFor(data.days), cx, y);

  y += 230;
  ctx.fillStyle = '#ffffff';
  if (data.days === null) {
    const t = fitText(ctx, data.title, CONTENT_W, 150, 2, 90, display);
    y = drawLines(ctx, t.lines, cx, y, t.size * 1.1);
    y -= t.size * 1.1;
  } else {
    const head = data.days > 1 ? `${data.days} days` : headlineFor(data.days);
    ctx.font = display(200);
    ctx.fillText(head, cx, y);
    y += 90;
    const t = fitText(ctx, `to ${data.title}`, CONTENT_W, 54, 2, 40, (px) => body(px, 'semibold'));
    y = drawLines(ctx, t.lines, cx, y, t.size * 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = body(40);
    ctx.fillText(data.dateLabel, cx, y + 6);
  }

  // --- Character, chest-up, rising from the bottom edge ---
  const top = 1640; // crown of the head
  const bodyW = 720;
  const bx = cx - bodyW / 2;
  const bottom = H + 60; // runs off the bottom of the screen

  ctx.save();
  ctx.translate(cx, top);
  ctx.rotate(-0.025); // the slightest head tilt
  ctx.translate(-cx, -top);

  stroke(ctx, 18);
  // Head + body: one big loaf
  ctx.beginPath();
  ctx.moveTo(bx, bottom);
  ctx.lineTo(bx, top + 360);
  ctx.bezierCurveTo(bx, top + 40, bx + 120, top, cx, top);
  ctx.bezierCurveTo(bx + bodyW - 120, top, bx + bodyW, top + 40, bx + bodyW, top + 360);
  ctx.lineTo(bx + bodyW, bottom);
  ctx.fill();
  ctx.stroke();

  // Crossed arms, built from outlined tubes so each overlap reads as "on top"
  const ay = top + 600;
  const thick = 120;
  // far side (viewer's right): upper arm down from the shoulder, forearm across to the left, hand tucked
  capsule(ctx, bx + bodyW - 10, ay - 200, bx + bodyW - 70, ay + 10, thick);
  capsule(ctx, bx + bodyW - 70, ay + 10, bx + 170, ay + 70, thick);
  // near side (viewer's left): upper arm, then forearm crossing over the far forearm
  capsule(ctx, bx + 10, ay - 200, bx + 70, ay + 60, thick);
  capsule(ctx, bx + 70, ay + 60, bx + bodyW - 170, ay + 140, thick);
  // Face
  const ey = top + 250;
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.beginPath();
  if (mood === 'stern') {
    // narrowed eyes: heavy lids, pupils peeking out from under
    for (const ex of [cx - 110, cx + 110]) {
      ctx.moveTo(ex - 40, ey - 8); ctx.lineTo(ex + 40, ey - 8);
    }
    ctx.stroke();
    for (const ex of [cx - 110, cx + 110]) {
      ctx.beginPath(); ctx.arc(ex, ey + 6, 14, 0, Math.PI); ctx.fill();
    }
    // brows angled in
    ctx.beginPath();
    ctx.moveTo(cx - 160, ey - 80); ctx.lineTo(cx - 60, ey - 55);
    ctx.moveTo(cx + 160, ey - 80); ctx.lineTo(cx + 60, ey - 55);
    // flat mouth, a little off-centre
    ctx.moveTo(cx - 45, ey + 110); ctx.lineTo(cx + 55, ey + 106);
  } else if (mood === 'alarmed') {
    // wide eyes, brows up, small open mouth
    for (const ex of [cx - 110, cx + 110]) {
      ctx.moveTo(ex + 20, ey); ctx.arc(ex, ey, 20, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 165, ey - 95); ctx.lineTo(cx - 60, ey - 110);
    ctx.moveTo(cx + 165, ey - 95); ctx.lineTo(cx + 60, ey - 110);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, ey + 115, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
  } else {
    // dot eyes, relaxed brows, small smile
    for (const ex of [cx - 110, cx + 110]) {
      ctx.moveTo(ex + 16, ey); ctx.arc(ex, ey, 16, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 160, ey - 70); ctx.quadraticCurveTo(cx - 110, ey - 95, cx - 60, ey - 72);
    ctx.moveTo(cx + 160, ey - 70); ctx.quadraticCurveTo(cx + 110, ey - 95, cx + 60, ey - 72);
    ctx.moveTo(cx - 50, ey + 95); ctx.quadraticCurveTo(cx, ey + 140, cx + 50, ey + 95);
  }
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Style: panic — hands on head, mouth wide open. The closer the exam, the louder.

function panicLineFor(days: number | null): string {
  if (days === null) return "It's over. Breathe.";
  if (days <= 0) return "IT'S TODAY.";
  if (days === 1) return 'TOMORROW.';
  if (days <= 6) return 'EXAMS.';
  if (days <= 29) return 'Exams are coming.';
  return 'Exams. Eventually.';
}

function paintPanic(ctx: SKRSContext2D, data: WallpaperData) {
  const mood: Mood = data.days === null ? 'happy' : data.days <= 6 ? 'alarmed' : data.days <= 29 ? 'stern' : 'happy';
  const cx = W / 2;

  // --- Text block ---
  ctx.textAlign = 'center';
  let y = 900;
  ctx.fillStyle = mood === 'alarmed' ? '#ffffff' : 'rgba(255,255,255,0.6)';
  ctx.font = display(mood === 'alarmed' ? 110 : 88);
  ctx.fillText(panicLineFor(data.days), cx, y);
  y += 230;
  ctx.fillStyle = '#ffffff';
  if (data.days === null) {
    const t = fitText(ctx, data.title, CONTENT_W, 150, 2, 90, display);
    drawLines(ctx, t.lines, cx, y, t.size * 1.1);
  } else {
    ctx.font = display(200);
    ctx.fillText(data.days > 1 ? `${data.days} days` : headlineFor(data.days), cx, y);
    y += 90;
    const t = fitText(ctx, `to ${data.title}`, CONTENT_W, 54, 2, 40, (px) => body(px, 'semibold'));
    y = drawLines(ctx, t.lines, cx, y, t.size * 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = body(40);
    ctx.fillText(data.dateLabel, cx, y + 6);
  }
  ctx.textAlign = 'left';

  // --- Character, chest-up, rising from the bottom edge ---
  const top = 1700;
  const bodyW = 640;
  const bx = cx - bodyW / 2;
  const bottom = H + 60;

  ctx.save();
  // Seen from below, leaning a touch: rotate the whole figure about its base
  ctx.translate(cx, bottom); ctx.rotate(mood === 'alarmed' ? -0.07 : -0.05); ctx.translate(-cx, -bottom);

  // Arms first (behind the body): one stroke each, shoulder → elbow out to the side → hand on top of the head
  const handL = { x: bx + 150, y: top + 60 };
  const handRt = { x: bx + bodyW - 150, y: top + 60 };
  stroke(ctx, 18);
  ctx.beginPath();
  if (mood !== 'happy') {
    ctx.moveTo(bx + 40, top + 640); ctx.lineTo(bx - 150, top + 260); ctx.lineTo(handL.x, handL.y);
    ctx.moveTo(bx + bodyW - 40, top + 640); ctx.lineTo(bx + bodyW + 150, top + 260); ctx.lineTo(handRt.x, handRt.y);
  } else {
    // arms hanging loose
    ctx.moveTo(bx - 10, top + 520); ctx.lineTo(bx - 40, top + 860);
    ctx.moveTo(bx + bodyW + 10, top + 520); ctx.lineTo(bx + bodyW + 40, top + 860);
  }
  ctx.stroke();

  // Head + body: a bell — narrow, slightly conical crown that flares out into the torso
  const apexX = cx - 15; // crown sits a little left of centre
  stroke(ctx, 18);
  ctx.beginPath();
  ctx.moveTo(bx, bottom);
  ctx.lineTo(bx, top + 900);
  ctx.quadraticCurveTo(bx + 25, top + 520, bx + 75, top + 330);
  ctx.bezierCurveTo(bx + 95, top + 90, apexX - 120, top, apexX, top);
  ctx.bezierCurveTo(apexX + 115, top, bx + bodyW - 85, top + 100, bx + bodyW - 65, top + 330);
  ctx.quadraticCurveTo(bx + bodyW - 20, top + 520, bx + bodyW, top + 900);
  ctx.lineTo(bx + bodyW, bottom);
  ctx.fill();
  ctx.stroke();

  // Face — eyes and mouth lifted from the reference SVG (head 72..191 × 55..135) and mapped onto this crown
  const faceLeft = bx + 65;
  const sx = (bodyW - 130) / 119;
  const sy = 5.2;
  const X = (v: number) => faceLeft + (v - 72) * sx;
  const Y = (v: number) => top + 25 + (v - 55) * sy;
  // Hair: spikes radiating outward along the crown, fist to fist — standing on end
  if (mood !== 'happy') {
    // The two cubic curves that make the dome (same control points as the body path)
    const left = [[bx + 75, top + 330], [bx + 95, top + 90], [apexX - 120, top], [apexX, top]] as const;
    const right = [[apexX, top], [apexX + 115, top], [bx + bodyW - 85, top + 100], [bx + bodyW - 65, top + 330]] as const;
    const at = (c: typeof left, t: number) => {
      const u = 1 - t;
      const x = u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0];
      const y = u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1];
      const dx = 3 * u * u * (c[1][0] - c[0][0]) + 6 * u * t * (c[2][0] - c[1][0]) + 3 * t * t * (c[3][0] - c[2][0]);
      const dy = 3 * u * u * (c[1][1] - c[0][1]) + 6 * u * t * (c[2][1] - c[1][1]) + 3 * t * t * (c[3][1] - c[2][1]);
      return { x, y, dx, dy };
    };
    const spread = mood === 'alarmed' ? 1.25 : 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath();
    let i = 0;
    for (const [curve, t0, t1, outward] of [[left, 0.42, 0.98, -1], [right, 0.02, 0.58, 1]] as const) {
      const n = 7;
      for (let k = 0; k <= n; k++, i++) {
        const t = t0 + ((t1 - t0) * k) / n;
        const p = at(curve, t);
        // outward normal: rotate the tangent; pick the side pointing away from the face
        const len0 = Math.hypot(p.dx, p.dy) || 1;
        let nx = -p.dy / len0, ny = p.dx / len0;
        if (nx * outward < 0) { nx = -nx; ny = -ny; }
        if (ny > 0) { nx = -nx; ny = -ny; } // never point down into the face
        // deterministic jitter so the fringe looks hand-drawn
        const jitter = ((i * 7919) % 13) / 13 - 0.5;
        const ang = jitter * 1.0;
        const rx = nx * Math.cos(ang) - ny * Math.sin(ang), ry = nx * Math.sin(ang) + ny * Math.cos(ang);
        // longer toward the hands (ends of the arc), shorter at the very top
        const edge = outward < 0 ? 1 - (t - t0) / (t1 - t0) : (t - t0) / (t1 - t0);
        const len = (55 + 75 * edge + 40 * Math.abs(((i * 104729) % 7) / 7 - 0.5)) * spread;
        ctx.moveTo(p.x + rx * 4, p.y + ry * 4);
        ctx.lineTo(p.x + rx * len, p.y + ry * len);
      }
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  // eyes: close together near the crown, the left one slightly lower
  ctx.beginPath(); ctx.arc(X(112), Y(72), 15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(X(145), Y(66), 15, 0, Math.PI * 2); ctx.fill();

  const mouth = () => {
    ctx.beginPath();
    ctx.moveTo(X(104), Y(135));
    ctx.bezierCurveTo(X(99), Y(110), X(115), Y(69), X(137), Y(70));
    ctx.bezierCurveTo(X(158), Y(71), X(169), Y(110), X(163), Y(135));
    ctx.closePath();
  };
  const tongue = () => {
    ctx.beginPath();
    ctx.moveTo(X(115), Y(135));
    ctx.bezierCurveTo(X(117), Y(125), X(126), Y(123), X(132), Y(128));
    ctx.bezierCurveTo(X(138), Y(123), X(147), Y(125), X(150), Y(135));
    ctx.closePath();
  };
  /** Mouth + tongue, scaled about the mouth's top edge so it grows downward. */
  const drawMouth = (k: number) => {
    ctx.save();
    ctx.translate(X(133.5), Y(72)); ctx.scale(k, k); ctx.translate(-X(133.5), -Y(72));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14 / k;
    mouth(); ctx.fillStyle = '#000000'; ctx.fill(); ctx.stroke();
    tongue(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 8 / k; ctx.stroke();
    ctx.restore();
  };
  if (mood === 'alarmed') {
    drawMouth(1.3);
    // shake lines outside the elbows
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of [
      [bx - 180, top + 60, bx - 240, top + 20], [bx - 230, top + 170, bx - 300, top + 150], [bx - 240, top + 290, bx - 310, top + 310],
      [bx + bodyW + 180, top + 60, bx + bodyW + 240, top + 20], [bx + bodyW + 230, top + 170, bx + bodyW + 300, top + 150], [bx + bodyW + 240, top + 290, bx + bodyW + 310, top + 310],
    ]) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
  } else if (mood === 'stern') {
    drawMouth(1.0);
  } else {
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(X(118), Y(112)); ctx.quadraticCurveTo(X(133), Y(126), X(148), Y(112)); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------

/** Render the lock-screen wallpaper as a PNG buffer. */
export function renderWallpaper(data: WallpaperData): Buffer {
  ensureFonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Pure black background — matches the iOS lock screen chrome and keeps the clock legible.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  switch (data.style ?? 'minimal') {
    case 'call': paintCall(ctx, data); break;
    case 'sign': paintSign(ctx, data); break;
    case 'stare': paintStare(ctx, data); break;
    case 'panic': paintPanic(ctx, data); break;
    default: paintMinimal(ctx, data);
  }
  return canvas.toBuffer('image/png');
}

/** Plain fallback so the Shortcut never receives a non-image. */
export function renderErrorWallpaper(message: string): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = '56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Exam Countdown', W / 2, 1200);
  ctx.font = '40px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(message, W / 2, 1280);
  return canvas.toBuffer('image/png');
}
