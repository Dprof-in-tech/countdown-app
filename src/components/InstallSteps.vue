<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { loadExams } from '../lib/storage';
import { buildWallpaperUrl } from '../lib/link';
import { track } from '../lib/track';
import { SHORTCUT_TEMPLATE_URL } from '../lib/shortcut';

const props = defineProps<{
  /** URL passed from the parent app; when omitted the component reads saved exams itself. */
  url?: string;
  /** Renders its own heading (used on /setup). */
  standalone?: boolean;
}>();

const device = ref<'iphone' | 'android'>('iphone');
const localUrl = ref('');
const copied = ref(false);
const qr = ref('');
/** A QR is for getting the link onto a *different* device, so it only earns its place on a big screen. */
const onDesktop = ref(false);

onMounted(() => {
  onDesktop.value = window.innerWidth >= 1024;
  if (!props.url) {
    const exams = loadExams();
    if (exams.length) {
      localUrl.value = buildWallpaperUrl(window.location.origin, exams, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }
  }
});

const wallpaperUrl = computed(() => props.url || localUrl.value);
const hasTemplate = computed(() => SHORTCUT_TEMPLATE_URL.length > 0);

watch([wallpaperUrl, onDesktop], async () => {
  if (!wallpaperUrl.value || !onDesktop.value) { qr.value = ''; return; }
  try {
    // A schedule-carrying link is long, so the code is dense — roughly 105 modules across for
    // six exams. It needs about 3 screen pixels per module to scan, hence the generous size.
    qr.value = await QRCode.toDataURL(wallpaperUrl.value, { width: 680, margin: 2, errorCorrectionLevel: 'L' });
  } catch {
    qr.value = '';
  }
}, { immediate: true });

async function copy() {
  try {
    await navigator.clipboard.writeText(wallpaperUrl.value);
    copied.value = true;
    track('copy');
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    (document.getElementById('install-url') as HTMLInputElement | null)?.select();
  }
}
</script>

<template>
  <section>
    <template v-if="standalone">
      <h1 class="text-4xl font-bold tracking-[-0.03em]">Set it up</h1>
      <p class="mt-3 max-w-lg text-muted">Two minutes, once. After that it refreshes itself every morning.</p>
    </template>

    <div class="mt-8 grid grid-cols-2 gap-3 sm:max-w-sm">
      <button type="button" class="card px-4 py-5 text-center transition-colors hover:bg-white/5"
        :class="device === 'iphone' ? 'border-white' : ''" @click="device = 'iphone'">
        <div class="font-semibold">iPhone</div>
        <div class="mt-1 text-xs text-muted">Shortcuts</div>
      </button>
      <button type="button" class="card px-4 py-5 text-center transition-colors hover:bg-white/5"
        :class="device === 'android' ? 'border-white' : ''" @click="device = 'android'">
        <div class="font-semibold">Android</div>
        <div class="mt-1 text-xs text-muted">MacroDroid</div>
      </button>
    </div>

    <p v-if="!wallpaperUrl" class="card mt-8 p-4 text-sm text-muted">
      Save your exams on the <a href="/" class="text-white underline underline-offset-2">home page</a> first — your link will appear here.
    </p>

    <ol v-else class="mt-10 space-y-10">
      <!-- 1 · get the link where you need it -->
      <li class="flex gap-4">
        <span class="step-num">1</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold leading-8">{{ onDesktop ? 'Open this on your phone' : 'Copy your link' }}</h3>
          <div class="card mt-3 p-4">
            <div v-if="onDesktop && qr" class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img :src="qr" alt="QR code for your wallpaper link" width="320" height="320" class="shrink-0 rounded-lg bg-white p-2" />
              <div class="min-w-0 flex-1 sm:pt-2">
                <p class="text-sm text-muted">Scan it with your phone camera. The rest of the setup happens on the phone, so that is where the link needs to be.</p>
                <button type="button" class="btn-text mt-3 text-xs" @click="copy">{{ copied ? 'Copied' : 'or copy the link instead' }}</button>
              </div>
            </div>
            <template v-else>
              <p class="mb-3 text-sm text-muted">This link is your schedule. Keep it — editing your exams later means copying a fresh one.</p>
              <div class="flex gap-2">
                <input id="install-url" :value="wallpaperUrl" readonly class="field min-w-0 flex-1 font-mono text-xs" />
                <button type="button" class="btn-primary shrink-0 px-4" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
              </div>
            </template>
          </div>
        </div>
      </li>

      <!-- 2 · the automation -->
      <li class="flex gap-4">
        <span class="step-num">2</span>
        <div class="min-w-0 flex-1">
          <template v-if="device === 'iphone'">
            <h3 class="text-lg font-semibold leading-8">{{ hasTemplate ? 'Add the ready-made Shortcut' : 'Build the Shortcut' }}</h3>
            <div class="card mt-3 p-4 text-sm leading-relaxed text-muted">
              <template v-if="hasTemplate">
                <a :href="SHORTCUT_TEMPLATE_URL" target="_blank" rel="noopener" class="btn-primary">Add Shortcut</a>
                <p class="mt-3">Tap <span class="text-white">Add Shortcut</span>, then paste your link into the <span class="text-white">Get Contents of URL</span> box. Nothing else to change.</p>
              </template>
              <template v-else>
                <p>Open <span class="text-white">Shortcuts</span> → <span class="text-white">+</span> → add these two actions, in order:</p>
                <ol class="mt-3 space-y-3">
                  <li class="flex gap-3"><span class="text-dim">1</span><span><span class="text-white">Get Contents of URL</span> — paste your link from step 1</span></li>
                  <li class="flex gap-3"><span class="text-dim">2</span><span><span class="text-white">Set Wallpaper Photo</span> — choose <span class="text-white">Lock Screen</span>, turn <span class="text-white">Show Preview</span> off</span></li>
                </ol>
                <p class="mt-3">Name it <span class="text-white">Exam Countdown</span> and tap Done. Run it once — your lock screen should change straight away.</p>
                <p class="mt-3 border-l-2 border-white/30 pl-3 text-xs">
                  Pick <span class="text-white">Set Wallpaper Photo</span>, not <span class="text-white">Set Wallpaper</span>. They sound alike, but the second one ignores your image and leaves the screen looking blank.
                </p>
              </template>
            </div>
          </template>
          <template v-else>
            <h3 class="text-lg font-semibold leading-8">Build the macro</h3>
            <div class="card mt-3 p-4 text-sm leading-relaxed text-muted">
              <p>Install <span class="text-white">MacroDroid</span> → Add Macro, then:</p>
              <ol class="mt-3 space-y-3">
                <li class="flex gap-3"><span class="text-dim">1</span><span>Action: <span class="text-white">HTTP Request</span> (GET) — paste your link, save the response to a file</span></li>
                <li class="flex gap-3"><span class="text-dim">2</span><span>Action: <span class="text-white">Set Wallpaper</span> → <span class="text-white">Lock Screen</span> → pick that file</span></li>
              </ol>
              <p class="mt-3">Test it from the macro list — your lock screen should change straight away.</p>
            </div>
          </template>
        </div>
      </li>

      <!-- 3 · make it daily -->
      <li class="flex gap-4">
        <span class="step-num">3</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold leading-8">Make it run every morning</h3>
          <div class="card mt-3 p-4 text-sm leading-relaxed text-muted">
            <template v-if="device === 'iphone'">
              <span class="text-white">Automation</span> tab → <span class="text-white">+</span> → <span class="text-white">Time of Day</span> →
              <span class="text-white">6:00 AM</span>, <span class="text-white">Daily</span> → choose <span class="text-white">Run Immediately</span> →
              pick the Shortcut you just made.
            </template>
            <template v-else>
              Add a trigger to the macro: <span class="text-white">Day/Time</span> → <span class="text-white">6:00</span>, every day. Save.
            </template>
            <p class="mt-3 text-xs">That's it. The countdown drops by one each morning on its own.</p>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
