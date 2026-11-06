import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      CI: 'true',
      DEMO_MODE: 'true',
      OTP_MOCK: 'true',
      SMS_PROVIDER: 'mock',
      OTP_PEPPER: process.env.OTP_PEPPER || 'test-e2e-otp-pepper-at-least-32-chars-long!',
      SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-at-least-32-characters-long!',
      PRESCRIPTION_ENC_KEY: process.env.PRESCRIPTION_ENC_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CRON_SECRET: process.env.CRON_SECRET || 'test-cron-secret-at-least-16-chars!',
    },
  },
});
