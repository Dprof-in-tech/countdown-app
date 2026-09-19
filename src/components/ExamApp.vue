<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Exam, ParseError } from '../lib/types';
import { parseExams, parseDate, parseTime, sortExams, toExam } from '../lib/parse';
import { clearExams, guideSeen, loadExams, loadStyle, markGuideSeen, saveExams, saveStyle, storageAvailable } from '../lib/storage';
import { buildWallpaperUrl } from '../lib/link';
import { getCountdown } from '../lib/countdown';
import { WALLPAPER_STYLES, parseStyle, type WallpaperStyle } from '../lib/styles';
import InstallSteps from './InstallSteps.vue';
import Tour, { type TourStep } from './Tour.vue';

const SAMPLE = `EEE 576: Introduction to Optimal Control, 28 Sep 2026, 9:00 am
EEE 574: Discrete Control Systems, 2 Oct 2026, 9:00 am
EEE 512: Renewable & New Energy Systems, 5 Oct 2026, 9:00 am`;

const text = ref('');
const errors = ref<ParseError[]>([]);
/** Parsed-but-unsaved exams shown in the editable table. */
const draft = ref<Exam[]>([]);
/** Saved exams — the ones the wallpaper link is built from. */
const saved = ref<Exam[]>([]);
const dirty = ref(false);
/** Suppresses the dirty flag while the initial state is loaded from storage. */
const ready = ref(false);
const storageOk = ref(true);
const copied = ref(false);
const previewNonce = ref(0);
const showInstall = ref(false);

const style = ref<WallpaperStyle>('minimal');
const tz = ref('UTC');
const origin = ref('');

onMounted(() => {
  storageOk.value = storageAvailable();
  tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  origin.value = window.location.origin;
  saved.value = loadExams();
  style.value = parseStyle(loadStyle());
  draft.value = saved.value.map((e) => ({ ...e }));
  nextTick(() => { ready.value = true; });
  // First visit with nothing saved: run the walkthrough
  if (!saved.value.length && !guideSeen()) startTour();
});

const errorLines = computed(() => new Set(errors.value.map((e) => e.line)));
const hasSaved = computed(() => saved.value.length > 0);
const wallpaperUrl = computed(() =>
  hasSaved.value && origin.value ? buildWallpaperUrl(origin.value, saved.value, tz.value, style.value) : '',
);
/** The phone always shows something: the saved wallpaper, or the empty-state render. */
const previewUrl = computed(() => {
  if (!origin.value) return '';
  const base = wallpaperUrl.value || buildWallpaperUrl(origin.value, [], tz.value, style.value);
  return `${base}&_=${previewNonce.value}`;
});
/** Thumbnail URL for each style option, built from the saved exams. */
function styleThumb(id: WallpaperStyle) {
  return hasSaved.value && origin.value ? `${buildWallpaperUrl(origin.value, saved.value, tz.value, id)}&_=${previewNonce.value}` : '';
}
function pickStyle(id: WallpaperStyle) {
  style.value = id;
  saveStyle(id);
}

const countdown = computed(() => getCountdown(saved.value, new Date(), tz.value));

// --- Walkthrough ---
const tourStep = ref(-1); // -1 = not running

const TOUR: TourStep[] = [
  { target: '#bulk', title: 'Paste your exams', body: 'One per line: course, date, time. Hit "Use sample" above the box if you just want to see it work.' },
  { target: '#btn-parse', title: 'Parse & Preview', body: 'Turns your text into a table you can edit. Click it now.', blocked: 'Click Parse & Preview to continue.' },
  { target: '#exam-table', title: 'Check the table', body: 'Fix a date, rename a course, reorder or delete rows. Anything the parser got wrong, you can correct here.' },
  { target: '#btn-save', title: 'Save to Wallpaper', body: 'Stores the schedule in this browser and builds your wallpaper. Click it now.', blocked: 'Click Save to Wallpaper to continue.' },
  { target: '#style-picker', title: 'Pick a style', body: 'Minimal, or one of the little guys. They all get more nervous as the exam gets closer. Tap one to switch.' },
  { target: '#wallpaper-link', title: 'Your wallpaper link', body: 'This URL renders a fresh PNG every time it is fetched. Your exams and timezone live inside it — copy it.' },
  { target: '#btn-install', title: 'Install', body: 'Opens the step-by-step for iPhone Shortcuts or Android. A daily automation fetches the link and sets your lock screen.' },
];

const tourActive = computed(() => tourStep.value >= 0);
const tourCanNext = computed(() => {
  switch (tourStep.value) {
    case 1: return draft.value.length > 0;
    case 3: return hasSaved.value && !dirty.value;
    default: return true;
  }
});
function startTour() { tourStep.value = 0; }
function endTour() { tourStep.value = -1; markGuideSeen(); }
function tourNext() { if (tourStep.value >= TOUR.length - 1) endTour(); else tourStep.value += 1; }
function tourBack() { if (tourStep.value > 0) tourStep.value -= 1; }
// Auto-advance when the user performs the step's action
watch(() => draft.value.length, (len) => { if (tourStep.value === 1 && len > 0) tourStep.value = 2; });
watch(hasSaved, (v) => { if (tourStep.value === 3 && v) tourStep.value = 4; });

watch(draft, () => { if (ready.value) dirty.value = true; }, { deep: true });

function parse() {
  const result = parseExams(text.value);
  errors.value = result.errors;
  if (result.success) {
    draft.value = result.exams;
    dirty.value = true;
  }
}

function useSample() {
  text.value = SAMPLE;
  parse();
}

/** Row-level edits: keep date/time normalised so bad values can't reach the wallpaper. */
const rowErrors = ref<Record<string, string>>({});
function updateField(exam: Exam, field: 'title' | 'date' | 'time', value: string) {
  if (field === 'title') {
    exam.title = value.trim();
    return;
  }
  const parsed = field === 'date' ? parseDate(value) : parseTime(value);
  if (!parsed) {
    rowErrors.value[exam.id] = field === 'date' ? 'Date not understood' : 'Time not understood';
    return;
  }
  delete rowErrors.value[exam.id];
  exam[field] = parsed;
  exam.datetime = `${exam.date}T${exam.time}:00`;
}

function remove(id: string) {
  draft.value = draft.value.filter((e) => e.id !== id);
  delete rowErrors.value[id];
}
function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= draft.value.length) return;
  const next = [...draft.value];
  [next[index], next[target]] = [next[target], next[index]];
  draft.value = next;
}
function sortDraft() {
  draft.value = sortExams(draft.value);
}
function addRow() {
  const today = new Date().toISOString().slice(0, 10);
  draft.value = [...draft.value, toExam({ title: 'New exam', date: today, time: '09:00' })];
}

const canSave = computed(() => draft.value.length > 0 && Object.keys(rowErrors.value).length === 0 && draft.value.every((e) => e.title));

function save() {
  if (!canSave.value) return;
  saved.value = draft.value.map((e) => ({ ...e }));
  storageOk.value = saveExams(saved.value);
  dirty.value = false;
  previewNonce.value += 1;
  track('save');
}

function clearAll() {
  clearExams();
  saved.value = [];
  draft.value = [];
  text.value = '';
  errors.value = [];
  rowErrors.value = {};
  dirty.value = false;
  showInstall.value = false;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(wallpaperUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
    track('copy');
  } catch {
    // Clipboard blocked (e.g. non-secure context) — user can select the text field instead.
    (document.getElementById('wallpaper-link') as HTMLInputElement | null)?.select();
  }
}

/** Anonymous usage beacon — event name and style only. */
function track(event: 'save' | 'copy' | 'install_open') {
  try {
    const body = JSON.stringify({ event, style: style.value });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch { /* never block the UI on analytics */ }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { showInstall.value = false; if (tourActive.value) endTour(); }
}
watch(showInstall, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});

function downloadJson() {
  const blob = new Blob([JSON.stringify(saved.value.length ? saved.value : draft.value, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'exams.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<template>
  <div>
  <div class="grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
    <!-- LEFT: input -->
    <div class="space-y-12" :class="hasSaved ? 'order-2 lg:order-1' : ''">
      <section>
        <h1 class="text-5xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
          Your next exam,<br />on your lock screen.
        </h1>
        <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Paste your exam schedule. Get a wallpaper that counts down the days.
          Updated automatically every morning.
        </p>
      </section>

      <!-- 1. Paste -->
      <section>
        <div class="flex items-baseline justify-between">
          <label for="bulk" class="text-lg font-semibold">Paste your exams</label>
          <div class="flex gap-4">
            <button type="button" @click="startTour" class="btn-text text-xs">Walkthrough</button>
            <button type="button" @click="useSample" class="btn-text text-xs">Use sample</button>
          </div>
        </div>
        <p class="mt-1 mb-3 text-sm text-muted">One per line: <span class="text-white">Course name, date, time</span></p>
        <textarea id="bulk" v-model="text" rows="6" spellcheck="false"
          placeholder="EEE 576: Introduction to Optimal Control, 28 Sep 2026, 9:00 am"
          class="field resize-y font-mono leading-relaxed"></textarea>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button id="btn-parse" type="button" @click="parse" class="btn-primary" :disabled="!text.trim()">Parse &amp; Preview</button>
          <span class="text-xs text-dim">28 Sep 2026 · 09/28/2026 · 2026-09-28 — 9:00 am · 09:00 · 9am</span>
        </div>

        <div v-if="errors.length" class="card mt-4 overflow-hidden">
          <ul class="space-y-1 border-b border-line p-3 text-sm">
            <li v-for="e in errors" :key="e.line"><span class="text-white">Line {{ e.line }}:</span> <span class="text-muted">{{ e.message }}</span></li>
          </ul>
          <pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><template v-for="(line, i) in text.split('\n')" :key="i"><span :class="errorLines.has(i + 1) ? 'bg-white text-black' : 'text-dim'">{{ line || ' ' }}</span>
</template></pre>
        </div>
      </section>

      <!-- 2. Review table -->
      <section>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">Exams <span class="text-sm font-normal text-muted">{{ draft.length }}</span></h2>
          <div class="flex gap-4">
            <button type="button" @click="addRow" class="btn-text text-xs">Add row</button>
            <button type="button" @click="sortDraft" class="btn-text text-xs" :disabled="draft.length < 2">Sort by date</button>
          </div>
        </div>

        <p v-if="!draft.length" id="exam-table" class="card mt-3 p-8 text-center text-sm text-dim">
          No exams yet. Paste your schedule above.
        </p>

        <div v-else id="exam-table" class="card mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wider text-dim">
              <tr class="border-b border-line">
                <th class="min-w-[16rem] px-3 py-2.5 font-medium">Course</th>
                <th class="w-36 px-3 py-2.5 font-medium">Date</th>
                <th class="w-24 px-3 py-2.5 font-medium">Time</th>
                <th class="w-28 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(exam, i) in draft" :key="exam.id" class="border-b border-line align-top last:border-b-0">
                <td class="px-1 py-1">
                  <input :value="exam.title" @change="updateField(exam, 'title', ($event.target as HTMLInputElement).value)" class="cell" :class="{ 'border-white': !exam.title }" />
                </td>
                <td class="px-1 py-1">
                  <input :value="exam.date" @change="updateField(exam, 'date', ($event.target as HTMLInputElement).value)" class="cell font-mono" />
                </td>
                <td class="px-1 py-1">
                  <input :value="exam.time" @change="updateField(exam, 'time', ($event.target as HTMLInputElement).value)" class="cell font-mono" />
                  <p v-if="rowErrors[exam.id]" class="px-2 pb-1 text-xs text-white">{{ rowErrors[exam.id] }}</p>
                </td>
                <td class="whitespace-nowrap px-2 py-1.5 text-right">
                  <button type="button" @click="move(i, -1)" :disabled="i === 0" class="icon" title="Move up" aria-label="Move up">↑</button>
                  <button type="button" @click="move(i, 1)" :disabled="i === draft.length - 1" class="icon" title="Move down" aria-label="Move down">↓</button>
                  <button type="button" @click="remove(exam.id)" class="icon" title="Delete" aria-label="Delete">×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <button id="btn-save" type="button" @click="save" class="btn-primary" :disabled="!canSave">Save to Wallpaper</button>
          <button type="button" @click="downloadJson" class="btn-text" :disabled="!draft.length && !hasSaved">Download JSON</button>
          <button type="button" @click="clearAll" class="btn-text" :disabled="!draft.length && !hasSaved">Clear all</button>
          <span v-if="dirty && hasSaved" class="text-xs text-muted">Unsaved changes</span>
        </div>
        <p v-if="!storageOk" class="mt-2 text-xs text-muted">
          localStorage isn't available in this browser, so your exams won't survive a reload. Use Download JSON to keep a copy — the wallpaper link still works.
        </p>
      </section>
    </div>

    <!-- RIGHT: output -->
    <aside class="lg:sticky lg:top-8 lg:self-start" :class="hasSaved ? 'order-1 lg:order-2' : ''">
      <div class="card p-6">
        <!-- Phone -->
        <div class="mx-auto w-[240px]">
          <div class="aspect-[1170/2532] overflow-hidden rounded-[2.2rem] border border-neutral-700 bg-black p-1.5">
            <img v-if="previewUrl" :src="previewUrl" alt="Wallpaper preview" class="h-full w-full rounded-[1.8rem] object-cover" />
          </div>
        </div>

        <p class="mt-5 text-center text-sm">
          <template v-if="hasSaved && countdown.days !== null"><span class="text-white">{{ countdown.days }} days</span> <span class="text-muted">to {{ countdown.title }}</span></template>
          <template v-else-if="hasSaved" class="text-white">{{ countdown.title }}</template>
          <template v-else><span class="text-muted">Save your exams to build the wallpaper.</span></template>
          <span v-if="dirty && hasSaved" class="text-dim"> · unsaved edits</span>
        </p>

        <!-- Style -->
        <div id="style-picker" class="mt-6">
          <p class="text-xs uppercase tracking-wider text-dim">Style</p>
          <div class="mt-2 grid grid-cols-5 gap-1.5">
            <button v-for="opt in WALLPAPER_STYLES" :key="opt.id" type="button" @click="pickStyle(opt.id)"
              class="rounded-md border p-1 text-center transition-colors hover:bg-white/5" :class="style === opt.id ? 'border-white' : 'border-line'"
              :title="opt.blurb">
              <div class="aspect-[1170/2532] overflow-hidden rounded-sm bg-black">
                <img v-if="hasSaved && styleThumb(opt.id)" :src="styleThumb(opt.id)" :alt="opt.name" loading="lazy" class="h-full w-full object-cover" />
              </div>
              <div class="mt-1 truncate text-[11px]" :class="style === opt.id ? 'text-white' : 'text-muted'">{{ opt.name }}</div>
            </button>
          </div>
          <p class="mt-2 text-xs text-dim">{{ WALLPAPER_STYLES.find((o) => o.id === style)?.blurb }}</p>
        </div>

        <!-- Link + install -->
        <div v-if="hasSaved" class="mt-6 border-t border-line pt-5">
          <p class="text-xs uppercase tracking-wider text-dim">Wallpaper link</p>
          <div class="mt-2 flex gap-2">
            <input id="wallpaper-link" :value="wallpaperUrl" readonly class="field min-w-0 flex-1 font-mono text-xs" />
            <button type="button" @click="copyLink" class="btn-outline shrink-0 px-3" :title="copied ? 'Copied' : 'Copy link'">
              <span v-if="copied" class="text-xs">Copied</span>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
          <p class="mt-2 text-xs text-dim">Fetched daily by a Shortcut. Timezone: {{ tz }}.</p>
          <div class="mt-4 flex items-center gap-4">
            <button id="btn-install" type="button" @click="showInstall = true; track('install_open')" class="btn-outline flex-1">
              Install
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <a :href="wallpaperUrl" target="_blank" rel="noopener" class="btn-text whitespace-nowrap">Open PNG</a>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <!-- Walkthrough -->
    <Tour v-if="tourActive" :steps="TOUR" :step="tourStep" :can-next="tourCanNext" @next="tourNext" @back="tourBack" @close="endTour" />

  <!-- Install modal -->
    <div v-if="showInstall" class="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-8" @click.self="showInstall = false" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div class="card mx-auto max-w-2xl p-6 sm:p-10">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 id="install-title" class="text-3xl font-bold tracking-[-0.03em]">Installation Steps</h2>
            <p class="mt-2 text-sm text-muted">Create an automation to run daily, then add the shortcut actions to update your lock screen.</p>
          </div>
          <button type="button" @click="showInstall = false" class="btn-text -mr-2 -mt-1 px-2 text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <InstallSteps :url="wallpaperUrl" />
        <div class="mt-8 text-center">
          <button type="button" @click="showInstall = false" class="btn-text">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles/global.css";
.icon { @apply rounded px-1.5 py-0.5 text-muted hover:bg-white/10 hover:text-white disabled:opacity-30; }
.cell { @apply w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-white hover:border-line focus:border-neutral-500 focus:bg-field focus:outline-none; }
</style>
