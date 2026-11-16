import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default defineConfig({
  ...viteConfig,
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/e2e/**'],
  },
});
