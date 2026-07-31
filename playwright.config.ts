import { defineConfig, devices } from '@playwright/test';

const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const e2ePort = runtimeProcess?.env?.TORCH_E2E_PORT ?? '4173';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  // The full vertical-slice smoke flow intentionally opens every major menu;
  // software-rendered Phaser in CI can make that interaction path slower than
  // Playwright's 30-second default without indicating a functional failure.
  timeout: 60_000,
  // Phaser owns a real render loop; serial browser contexts avoid competing
  // canvases producing artificial long-task/frame-hitch noise in CI.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
