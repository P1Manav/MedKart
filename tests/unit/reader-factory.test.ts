// tests/unit/reader-factory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPrescriptionReader } from '@/lib/ai';
import { GeminiReader } from '@/lib/ai/gemini-reader';
import { MockReader } from '@/lib/ai/mock-reader';

describe('AI Reader Factory (P0-3 Production Safeguard)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('never returns MockReader when NODE_ENV is production, even if GEMINI_API_KEY is missing', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_READER;

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(GeminiReader);
    expect(reader).not.toBeInstanceOf(MockReader);
  });

  it('never returns MockReader in production even if AI_READER=mock is explicitly set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.AI_READER = 'mock';
    delete process.env.GEMINI_API_KEY;

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(GeminiReader);
    expect(reader).not.toBeInstanceOf(MockReader);
  });

  it('GeminiReader with no API key in production routes safely to manual entry with 0 fabricated lines', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;

    const reader = new GeminiReader();
    const result = await reader.read(Buffer.from('fake_image_bytes'));

    expect(result.success).toBe(false);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('permits MockReader only in test environment or non-production with AI_READER=mock', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    process.env.AI_READER = 'mock';

    const reader = getPrescriptionReader();
    expect(reader).toBeInstanceOf(MockReader);
  });
});
