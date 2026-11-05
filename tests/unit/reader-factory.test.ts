// tests/unit/reader-factory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPrescriptionReader } from '@/lib/ai';
import { HfOcrReader } from '@/lib/ai/hf-ocr-reader';
import { MockReader } from '@/lib/ai/mock-reader';

describe('AI Reader Factory (P0-3 Production Safeguard)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('never returns MockReader when NODE_ENV is production, even if HF_API_TOKEN is missing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.HF_API_TOKEN;
    delete process.env.AI_READER;

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(HfOcrReader);
    expect(reader).not.toBeInstanceOf(MockReader);
  });

  it('never returns MockReader in production even if AI_READER=mock is explicitly set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.AI_READER = 'mock';
    delete process.env.HF_API_TOKEN;

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(HfOcrReader);
    expect(reader).not.toBeInstanceOf(MockReader);
  });

  it('permits MockReader only in test environment or non-production with AI_READER=mock', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.AI_READER = 'mock';

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(MockReader);
  });
});
