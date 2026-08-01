import { test as base, expect } from '@playwright/test';

/**
 * Keep browser smoke tests honest about runtime failures. Phaser's development
 * frame monitor emits an intentional warning for measured hitches. Headless
 * Chromium also emits a driver-level ReadPixels warning while Phaser renders;
 * all other page errors and console errors/warnings should fail a passing flow.
 */
export const test = base.extend<{ browserDiagnostics: void }>({
  browserDiagnostics: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.stack ?? error.message}`);
      });
      page.on('console', (message) => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        const text = message.text();
        const isExpectedRendererWarning =
          text.includes('GL Driver Message') && text.includes('GPU stall due to ReadPixels');
        if (message.type() === 'warning' && (text.startsWith('[Torch perf]') || isExpectedRendererWarning)) {
          return;
        }
        (message.type() === 'error' ? errors : warnings).push(`${message.type()}: ${text}`);
      });

      await use();

      // Preserve the original assertion failure if the test already failed;
      // diagnostics are still attached for the report in that case.
      if (errors.length > 0 || warnings.length > 0) {
        await testInfo.attach('browser-diagnostics', {
          body: [...errors, ...warnings].join('\n'),
          contentType: 'text/plain',
        });
      }
      if ((errors.length > 0 || warnings.length > 0) && testInfo.status === 'passed') {
        throw new Error(`Unexpected browser errors or warnings:\n${[...errors, ...warnings].join('\n')}`);
      }
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from '@playwright/test';
