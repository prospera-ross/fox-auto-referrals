import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'browser.spec.mjs', workers: 1,
  use: { baseURL: 'http://localhost:8788', channel: 'chrome', headless: true },
  reporter: 'list'
});
