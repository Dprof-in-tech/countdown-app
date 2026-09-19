<script setup lang="ts">
/**
 * Spotlight walkthrough. Highlights one target element at a time with a cut-out overlay and a
 * tooltip. The parent owns the step index so it can auto-advance when the user performs the action.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  /** Text shown when the user can't move on yet (e.g. "Save to continue") */
  blocked?: string;
}

const props = defineProps<{ steps: TourStep[]; step: number; canNext: boolean }>();
const emit = defineEmits<{ next: []; back: []; close: [] }>();

const rect = ref<{ top: number; left: number; width: number; height: number } | null>(null);
const current = computed(() => props.steps[props.step]);
const PAD = 8;
const TIP_W = 320;

function measure() {
  const el = document.querySelector(current.value.target) as HTMLElement | null;
  if (!el) { rect.value = null; return; }
  const r = el.getBoundingClientRect();
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height };
}

async function focusTarget() {
  await nextTick();
  const el = document.querySelector(current.value.target) as HTMLElement | null;
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // measure now and again once the smooth scroll settles
  measure();
  setTimeout(measure, 350);
  setTimeout(measure, 700);
}

watch(() => props.step, focusTarget);
onMounted(() => {
  focusTarget();
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  window.removeEventListener('scroll', measure, true);
});

const spotlight = computed(() => {
  if (!rect.value) return null;
  const r = rect.value;
  return { top: `${r.top - PAD}px`, left: `${r.left - PAD}px`, width: `${r.width + PAD * 2}px`, height: `${r.height + PAD * 2}px` };
});

const tip = computed(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(TIP_W, vw - 32);
  if (!rect.value) return { top: `${vh / 2 - 100}px`, left: `${vw / 2 - w / 2}px`, width: `${w}px` };
  const r = rect.value;
  const below = r.top + r.height + PAD + 14;
  const placeBelow = below + 220 < vh || r.top < 240;
  const top = placeBelow ? below : Math.max(16, r.top - PAD - 14 - 200);
  const left = Math.min(Math.max(16, r.left), vw - w - 16);
  return { top: `${top}px`, left: `${left}px`, width: `${w}px` };
});
</script>

<template>
  <!-- pointer-events-none on the layer so the page underneath stays fully usable; only the tooltip is interactive -->
  <div class="pointer-events-none fixed inset-0 z-[60]" role="dialog" :aria-label="current.title">
    <!-- cut-out: the shadow darkens everything except the target -->
    <div v-if="spotlight" class="pointer-events-none fixed rounded-lg border border-white transition-all duration-200"
      :style="{ ...spotlight, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.78)' }"></div>
    <div v-else class="pointer-events-none fixed inset-0 bg-black/78"></div>

    <div class="card pointer-events-auto fixed p-5 shadow-2xl transition-all duration-200" :style="tip">
      <div class="flex items-start justify-between gap-3">
        <div class="text-xs text-dim">Step {{ step + 1 }} of {{ steps.length }}</div>
        <button type="button" class="btn-text -mr-1 -mt-1 px-1 text-lg leading-none" aria-label="Close walkthrough" @click="emit('close')">×</button>
      </div>
      <h3 class="mt-1 font-semibold">{{ current.title }}</h3>
      <p class="mt-1 text-sm text-muted">{{ current.body }}</p>
      <p v-if="!canNext && current.blocked" class="mt-2 text-xs text-white">{{ current.blocked }}</p>
      <div class="mt-4 flex items-center justify-between">
        <button type="button" class="btn-text text-xs" :disabled="step === 0" @click="emit('back')">Back</button>
        <div class="flex gap-3">
          <button type="button" class="btn-text text-xs" @click="emit('close')">Skip</button>
          <button type="button" class="btn-primary px-3 py-1.5 text-xs" :disabled="!canNext" @click="emit('next')">
            {{ step === steps.length - 1 ? 'Done' : 'Next' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
