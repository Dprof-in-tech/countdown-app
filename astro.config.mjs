// @ts-check
import { defineConfig } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://countdown-app-olive-eight.vercel.app',
  // Static pages by default; /api/* routes opt in with `prerender = false`.
  output: 'static',
  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ['@napi-rs/canvas'] },
  },

  adapter: vercel({
    // Lambda has no system fonts — ship Inter with the function bundle.
    includeFiles: [
      './src/assets/fonts/InterDisplay-Bold.ttf',
      './src/assets/fonts/Inter-SemiBold.ttf',
      './src/assets/fonts/Inter-Medium.ttf',
      './src/assets/fonts/Inter-Regular.ttf',
    ],
  }),
});
