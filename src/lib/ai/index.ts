// src/lib/ai/index.ts
import { HfOcrReader } from './hf-ocr-reader';
import { MockReader } from './mock-reader';
import type { PrescriptionReader } from './types';

export * from './types';
export * from './hf-ocr-reader';
export * from './deterministic-parser';
export * from './mock-reader';
export * from './fuzzy-matcher';

/**
 * getPrescriptionReader
 *
 * Strict factory for obtaining prescription readers.
 * Spec P0-3 & v4 Honest OCR Pipeline:
 * - MockReader is NEVER reachable in production under any condition.
 * - In non-production, MockReader is returned if NODE_ENV === 'test' or AI_READER === 'mock'.
 * - In all other cases (including production without HF keys), returns HfOcrReader,
 *   which executes Tier 1 (hosted OCR model via HF Inference API), seamlessly falling back
 *   to Tier 2 (local in-process Tesseract.js WASM engine) and Tier 3 (pharmacist manual entry queue)
 *   with 0 fabricated lines.
 */
export function getPrescriptionReader(): PrescriptionReader {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const isMockExplicit = process.env.AI_READER === 'mock';

  if (!isProduction && (isTest || isMockExplicit)) {
    return new MockReader('valid');
  }

  return new HfOcrReader();
}
