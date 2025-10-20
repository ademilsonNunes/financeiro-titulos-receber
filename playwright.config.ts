import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  /* Max time one test can run for. */
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4300',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retry-with-video',
    trace: 'retain-on-failure'
  },
});