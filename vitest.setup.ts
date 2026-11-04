// vitest.setup.ts
// Test-only mock environment secrets for in-memory unit tests
process.env.SESSION_SECRET = 'vitest-test-session-secret-minimum-32-chars-long';
process.env.PRESCRIPTION_ENC_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CRON_SECRET = 'vitest-test-cron-secret-1234';
process.env.DEMO_MODE = 'true';
process.env.OTP_MOCK = 'true';
