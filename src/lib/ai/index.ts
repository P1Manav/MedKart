// src/lib/ai/index.ts
import { GeminiReader } from './gemini-reader';
import { MockReader } from './mock-reader';
import type { PrescriptionReader } from './types';

export * from './types';
export * from './gemini-reader';
export * from './mock-reader';
export * from './fuzzy-matcher';

/**
 * getPrescriptionReader
 *
 * Strict factory for obtaining prescription readers.
 * Spec P0-3:
 * - MockReader is NEVER reachable in production under any condition.
 * - In non-production, MockReader is returned if NODE_ENV === 'test' or AI_READER === 'mock'.
 * - In all other cases (including production without a key), returns GeminiReader,
 *   which safely routes to manual entry with 0 fabricated lines.
 */
export function getPrescriptionReader(): PrescriptionReader {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isMockExplicit = process.env.AI_READER === 'mock';

  if (!isProduction && (isTest || isMockExplicit)) {
    return new MockReader('valid');
  }

  return new GeminiReader();
}
