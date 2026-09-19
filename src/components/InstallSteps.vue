<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { loadExams } from '../lib/storage';
import { buildWallpaperUrl } from '../lib/link';

const props = defineProps<{
  /** URL passed from the parent app; when omitted the component reads saved exams itself. */
  url?: string;
  /** Renders its own heading (used on /setup). */
  standalone?: boolean;
}>();

const device = ref<'iphone' | 'android'>('iphone');
const localUrl = ref('');
const copied = ref(false);

onMounted(() => {
  if (props.url) return;
  const exams = loadExams();
  if (exams.length) {
    localUrl.value = buildWallpaperUrl(window.location.origin, exams, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }
});

const wallpaperUrl = computed(() => props.url || localUrl.value);

async function copy() {
  try {
    await navigator.clipboard.writeText(wallpaperUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    (document.getElementById('install-url') as HTMLInputElement | null)?.select();
  }
}
</script>

<template>
  <section>
    <template v-if="standalone">
      <h1 class="text-4xl font-bold tracking-[-0.03em]">Installation Steps</h1>
      <p class="mt-3 max-w-lg text-muted">
        Create an automation to run daily, then add the shortcut actions to update your lock screen.
      </p>
    </template>

    <!-- Device toggle -->
    <div class="mt-8 grid grid-cols-2 gap-3 sm:max-w-sm">
      <button type="button" class="card px-4 py-5 text-center transition-colors hover:bg-white/5"
        :class="device === 'iphone' ? 'border-white' : ''" @click="device = 'iphone'">
        <div class="font-semibold">iPhone</div>
        <div class="mt-1 text-xs text-muted">iOS Shortcuts</div>
      </button>
      <button type="button" class="card px-4 py-5 text-center transition-colors hover:bg-white/5"
        :class="device === 'android' ? 'border-white' : ''" @click="device = 'android'">
        <div class="font-semibold">Android</div>
        <div class="mt-1 text-xs text-muted">MacroDroid</div>
      </button>
    </div>

    <ol class="mt-10 space-y-10">
      <!-- Step 1 -->
      <li class="flex gap-4">
        <span class="step-num">1</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold leading-8">Copy your wallpaper link</h3>
          <div class="card mt-3 p-4 text-sm text-muted">
            <template v-if="wallpaperUrl">
              <p class="mb-3">This link carries your exams and timezone. Regenerate it whenever you edit your schedule.</p>
              <div class="flex gap-2">
                <input id="install-url" :value="wallpaperUrl" readonly class="field min-w-0 flex-1 font-mono text-xs" />
                <button type="button" class="btn-outline shrink-0 px-3" @click="copy" :title="copied ? 'Copied' : 'Copy link'">
                  <span v-if="copied" class="text-xs">Copied</span>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </template>
            <p v-else>Save your exams on the <a href="/" class="text-white underline underline-offset-2">home page</a> first — your link will appear here.</p>
          </div>
        </div>
      </li>

      <!-- Step 2 -->
      <li class="flex gap-4">
        <span class="step-num">2</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold leading-8">Create automation</h3>
          <div class="card mt-3 p-4 text-sm leading-relaxed text-muted">
            <template v-if="device === 'iphone'">
              Open <span class="text-white">Shortcuts</span> app → <span class="text-white">Automation</span> tab → New Automation →
              <span class="text-white">Time of Day</span> → <span class="text-white">6:00 AM</span> → Repeat <span class="text-white">Daily</span> →
              Select <span class="text-white">Run Immediately</span> → <span class="text-white">Create New Shortcut</span>
            </template>
            <template v-else>
              Install <span class="text-white">MacroDroid</span> → Add Macro → Trigger: <span class="text-white">Day/Time</span> →
              <span class="text-white">6:00</span>, every day
            </template>
          </div>
        </div>
      </li>

      <!-- Step 3 -->
      <li class="flex gap-4">
        <span class="step-num">3</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold leading-8">Add the actions</h3>
          <div class="card mt-3 p-4 text-sm leading-relaxed text-muted">
            <p class="mb-3 text-xs uppercase tracking-wider text-dim">Add these actions</p>
            <ol class="space-y-3">
              <template v-if="device === 'iphone'">
                <li class="flex gap-3"><span class="text-dim">3.1</span><span><span class="text-white">"Get Contents of URL"</span> → paste the wallpaper link from step 1</span></li>
                <li class="flex gap-3"><span class="text-dim">3.2</span><span><span class="text-white">"Set Wallpaper Photo"</span> → choose <span class="text-white">Lock Screen</span>, turn <span class="text-white">Show Preview</span> off</span></li>
                <li class="flex gap-3"><span class="text-dim">3.3</span><span>Tap <span class="text-white">Done</span>. Run it once by hand to confirm.</span></li>
              </template>
              <template v-else>
                <li class="flex gap-3"><span class="text-dim">3.1</span><span>Action: <span class="text-white">HTTP Request</span> (GET) → paste the wallpaper link → save response to a file</span></li>
                <li class="flex gap-3"><span class="text-dim">3.2</span><span>Action: <span class="text-white">Set Wallpaper</span> → <span class="text-white">Lock Screen</span> → pick that file</span></li>
                <li class="flex gap-3"><span class="text-dim">3.3</span><span>Save the macro. Test it once from the macro list.</span></li>
              </template>
            </ol>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
