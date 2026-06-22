import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@env': new URL('./src/environments', import.meta.url).pathname,
      '@features': new URL('./src/app/features', import.meta.url).pathname,
      '@shared': new URL('./src/app/shared', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
  },
});
