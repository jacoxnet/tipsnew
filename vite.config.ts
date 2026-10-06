/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // relative base so the build works under any sub-path (e.g. GitHub Pages /<repo>/)
  base: './',
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
