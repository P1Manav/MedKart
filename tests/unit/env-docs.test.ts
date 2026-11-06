// tests/unit/env-docs.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateEnv } from '@/lib/env';
import { getDemoPhones, DEFAULT_DEMO_PHONES } from '@/lib/auth/otp-providers/mock';

describe('Environment Variables & Documentation Parity', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('every process.env.X referenced in src/ must appear in .env.example', () => {
    const rootDir = process.cwd();
    const srcDir = path.join(rootDir, 'src');

    function walkDir(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkDir(filePath, fileList);
        } else if (/\.(ts|tsx|js|mjs)$/.test(file)) {
          fileList.push(filePath);
        }
      }
      return fileList;
    }

    const srcFiles = walkDir(srcDir);
    const envVarsInSrc = new Set<string>();

    for (const filePath of srcFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
      for (const match of matches) {
        envVarsInSrc.add(match[1]);
      }
    }

    // Standard runtime, framework or build variables to ignore
    const ignoredVars = new Set([
      'NODE_ENV',
      'CI',
      'NEXT_RUNTIME',
      'VERCEL',
      'VERCEL_ENV',
      'VERCEL_URL',
      'npm_package_version',
    ]);

    const codeVars = Array.from(envVarsInSrc).filter((v) => !ignoredVars.has(v));

    const examplePath = path.join(rootDir, '.env.example');
    expect(fs.existsSync(examplePath)).toBe(true);

    const exampleContent = fs.readFileSync(examplePath, 'utf-8');
    const exampleVars = new Set(
      Array.from(exampleContent.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)).map((m) => m[1])
    );

    const missingInExample = codeVars.filter((v) => !exampleVars.has(v));
    expect(
      missingInExample,
      `Variables referenced in src/ but missing from .env.example: ${missingInExample.join(', ')}`
    ).toEqual([]);
  });

  it('validateEnv fails closed in production for missing DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'a'.repeat(32),
        PRESCRIPTION_ENC_KEY: 'a'.repeat(64),
        CRON_SECRET: 'a'.repeat(16),
        OTP_PEPPER: 'a'.repeat(16),
      })
    ).toThrow(/DATABASE_URL is required in production/);
  });

  it('validateEnv fails closed in production for short SESSION_SECRET', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost:5432/medkart',
        SESSION_SECRET: 'short',
        PRESCRIPTION_ENC_KEY: 'a'.repeat(64),
        CRON_SECRET: 'a'.repeat(16),
        OTP_PEPPER: 'a'.repeat(16),
      })
    ).toThrow(/SESSION_SECRET must be at least 32 characters/);
  });

  it('validateEnv fails closed in production for invalid PRESCRIPTION_ENC_KEY', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost:5432/medkart',
        SESSION_SECRET: 'a'.repeat(32),
        PRESCRIPTION_ENC_KEY: 'invalid-hex-key',
        CRON_SECRET: 'a'.repeat(16),
        OTP_PEPPER: 'a'.repeat(16),
      })
    ).toThrow(/PRESCRIPTION_ENC_KEY must be exactly 64 hex characters/);
  });

  it('validateEnv fails closed in production for missing OTP_PEPPER', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost:5432/medkart',
        SESSION_SECRET: 'a'.repeat(32),
        PRESCRIPTION_ENC_KEY: 'a'.repeat(64),
        CRON_SECRET: 'a'.repeat(16),
      })
    ).toThrow(/OTP_PEPPER must be at least 16 characters/);
  });

  it('validateEnv succeeds in production when all required variables are valid', () => {
    const valid = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost:5432/medkart',
      SESSION_SECRET: 'a'.repeat(32),
      PRESCRIPTION_ENC_KEY: 'a'.repeat(64),
      CRON_SECRET: 'a'.repeat(16),
      OTP_PEPPER: 'a'.repeat(16),
    });
    expect(valid.DATABASE_URL).toBe('postgresql://localhost:5432/medkart');
  });

  it('DEMO_PHONES returns empty array when DEMO_MODE !== true', () => {
    delete process.env.DEMO_MODE;
    expect(getDemoPhones()).toEqual([]);

    process.env.DEMO_MODE = 'false';
    expect(getDemoPhones()).toEqual([]);
  });

  it('DEMO_PHONES returns DEFAULT_DEMO_PHONES when DEMO_MODE === true and DEMO_PHONES unset', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.DEMO_PHONES;
    expect(getDemoPhones()).toEqual(DEFAULT_DEMO_PHONES);
  });

  it('DEMO_PHONES parses comma-separated allowlist when configured', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_PHONES = '9830011111, 9830099999, +919876543210';
    expect(getDemoPhones()).toEqual(['9830011111', '9830099999', '9876543210']);
  });
});
