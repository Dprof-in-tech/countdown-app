# Exam Countdown Wallpaper

Paste your exam schedule → get a lock-screen wallpaper URL that renders "**N days to <next exam>**" fresh on every fetch → let an iOS Shortcut fetch it daily and set it as your lock screen.

No accounts, no database. Exams live in your browser's `localStorage` and inside the wallpaper link itself.

## Stack

- **Astro 7** (static pages + on-demand API routes) with **Vue 3** for the interactive form
- **Tailwind CSS 4** — monochrome: black, white, two greys, 1px borders
- **@napi-rs/canvas** for server-side PNG rendering (prebuilt binaries — runs on Vercel without native compilation; `node-canvas` does not)
- **Vitest** for the TDD suite
- Deploys to **Vercel** via `@astrojs/vercel`

## Run it

```sh
npm install
npm run dev        # http://localhost:4321
npm test           # vitest — 37 tests covering parse / countdown / wallpaper / storage / link
npm run build      # production build → .vercel/output
```

## How it works

```
Browser                              Server (Vercel Function)
───────                              ────────────────────────
paste text ─▶ parseExams() ─▶ table
      └▶ Save ─▶ localStorage
      └▶ buildWallpaperUrl()  ─────▶ GET /api/wallpaper?exams=<json>&tz=<zone>
                                       ├─ decodeExamsParam()  (validate)
                                       ├─ getCountdown(now)   (next exam, calendar days)
                                       └─ renderWallpaper()   → PNG 1170×2532, Cache-Control: no-store
```

Key decisions:

- **Calendar days, in the user's timezone.** "9 days to" on 19 Sep for a 28 Sep exam, and "Today" on exam day even after the start time has passed — which is what a lock screen should say. The page embeds the browser's IANA timezone in the link (`tz=`) so the server (UTC) counts from *your* midnight.
- **Always answer with a PNG.** Malformed link or render failure → a fallback image with a message, so the Shortcut never sets a broken wallpaper or errors out.
- **Fonts are bundled.** Vercel functions have no system fonts; Inter TTFs in `src/assets/fonts` are registered at first render and shipped via `includeFiles` in `astro.config.mjs`.

## API

### `POST /api/parse`
Body `{ "text": "Course, Date, Time\n…" }` → `{ success, exams }` or `422 { success: false, errors: [{ line, message }] }`.

Accepted dates: `28 Sep 2026`, `Sep 28, 2026`, `Mon, 28 Sep 2026`, `09/28/2026`, `28/09/2026` (when day > 12), `2026-09-28`.
Accepted times: `9:00 am`, `9am`, `09:00`, `14:30`, `2.30 pm`.

### `GET /api/wallpaper?exams=<url-encoded JSON>&tz=<IANA zone>&style=minimal|call|sign`
`exams` is `[{ "title", "date": "YYYY-MM-DD", "time": "HH:MM" }]`. Returns `image/png`, `Cache-Control: no-cache, no-store`.

Styles (all black & white, all 1170×2532):

| style | what you get |
|---|---|
| `minimal` (default) | Big day count, course, date, exam-period progress bar |
| `call` | "EXAM is calling in N days" — an incoming-call parody with Decline / Study buttons |
| `sign` | An original line-art character holding the countdown on a placard. Its face and the message under it change as the exam gets closer (`messageFor()` in `src/lib/styles.ts`). |
| `stare` | The character head-on, arms crossed, giving you the look. Eyes narrow and the headline sharpens ("You again?" → "Seriously?") as the exam approaches. |
| `panic` | Chest-up, elbows out, hands gripping the top of the head, mouth wide open. Calm at 30+ days, worried at 7–29, full scream with shake lines in the final week. |

## iOS Shortcut setup

See `/setup` in the app, or: Shortcuts → Automation → Time of Day (6:00 AM, daily, Run Immediately) → **Get Contents of URL** (your wallpaper link) → **Set Wallpaper** (Lock Screen, Show Preview off).

## Project layout

```
src/
  lib/
    types.ts       Exam, Countdown, ParseResult
    parse.ts       parseExams / parseDate / parseTime / sortExams
    countdown.ts   daysUntil / findNextExam / getCountdown (tz-aware)
    styles.ts      style list, parseStyle, messageFor (browser-safe)
    wallpaper.ts   renderWallpaper / renderErrorWallpaper (canvas, server only)
    storage.ts     localStorage wrapper (examCountdownExams)
    link.ts        buildWallpaperUrl / decodeExamsParam
  pages/
    index.astro    app page
    setup.astro    Shortcuts guide
    api/parse.ts   POST
    api/wallpaper.ts GET
  components/ExamApp.vue
  assets/fonts/    Inter (OFL)
tests/             vitest, mirrors the spec's test cases 1.x–5.x
```

## Deploy

```sh
vercel            # preview
vercel --prod
```

Local Node 25 is fine for dev; Vercel runs the function on Node 24.
