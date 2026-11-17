import { defineConfig } from '@playwright/test';

// Every browser runs headless, with no window and no sound.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4473',
    browserName: 'chromium',
    launchOptions: { args: ['--mute-audio'] },
  },
  webServer: {
    command: 'npm run serve --workspace app',
    url: 'http://127.0.0.1:4473/app/',
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
