// tests/unit/deterministic-parser.test.ts
import { describe, it, expect } from 'vitest';
import {
  extractForm,
  extractStrength,
  extractQuantity,
  extractFrequency,
  cleanCandidateDrugName,
  extractPrescriber,
  extractPrescriptionDate,
  parseOcrOutputToPrescription,
  computeCombinedLineConfidence,
  type OcrEngineOutput,
} from '@/lib/ai/deterministic-parser';

describe('Deterministic OCR Parser (Non-Generative Perception & Extraction)', () => {
  it('extracts forms accurately without hallucination', () => {
    expect(extractForm('Tab. Metformin 500 mg').form).toBe('Tablet');
    expect(extractForm('Cap Omeprazole 20mg').form).toBe('Capsule');
    expect(extractForm('Syr Paracetamol 125mg').form).toBe('Syrup');
    expect(extractForm('Inj Meropenem 500 mg').form).toBe('Injection');
    expect(extractForm('Diclofenac Gel 30g').form).toBe('Gel');
    expect(extractForm('Metformin 500 mg').form).toBeNull();
  });

  it('extracts medical strengths with regex precision', () => {
    expect(extractStrength('Tab. Metformin 500 mg').strength).toBe('500 mg');
    expect(extractStrength('Telmisartan 40mg once daily').strength).toBe('40 mg');
    expect(extractStrength('Levothyroxine 50 mcg').strength).toBe('50 mcg');
    expect(extractStrength('Cough syrup 100 ml bottle').strength).toBe('100 ml');
    expect(extractStrength('Plain Paracetamol').strength).toBeNull();
  });

  it('extracts quantities accurately', () => {
    expect(extractQuantity('1 tab twice daily (Qty: 4 strips of 15)').quantity).toBe(4);
    expect(extractQuantity('Take 3 strips of 10').quantity).toBe(3);
    expect(extractQuantity('Metformin 500mg x 30').quantity).toBe(30);
    expect(extractQuantity('Metformin 500mg').quantity).toBeNull();
  });

  it('extracts frequency and dosage directions', () => {
    expect(extractFrequency('1 tab twice daily after meals').frequency).toBe('twice daily');
    expect(extractFrequency('1 tab 1-0-1').frequency).toBe('1-0-1');
    expect(extractFrequency('1 tab OD before breakfast').frequency).toBe('od');
    expect(extractFrequency('Take 1 tab empty stomach').frequency).toBe('empty stomach');
    expect(extractFrequency('Metformin 500mg').frequency).toBeNull();
  });

  it('cleans and isolates candidate drug names from raw OCR lines', () => {
    const raw = 'Tab. Metformin 500 mg (Qty: 4 strips)';
    const cleaned = cleanCandidateDrugName(
      extractQuantity(extractStrength(extractForm(raw).cleanedText).cleanedText).cleanedText
    );
    expect(cleaned).toBe('Metformin');
  });

  it('extracts prescriber details and date without generative guessing', () => {
    const lines = [
      { text: 'CARE CLINIC & DIAGNOSTICS', words: [], confidence: 0.9 },
      { text: 'Dr. S. Mukherjee, MBBS, MD', words: [], confidence: 0.95 },
      { text: 'Date: 14/10/2026', words: [], confidence: 0.88 },
      { text: 'Tab. Telmisartan 40 mg', words: [], confidence: 0.92 },
    ];

    expect(extractPrescriber(lines)).toContain('Dr. S. Mukherjee');
    expect(extractPrescriptionDate(lines)).toBe('14/10/2026');
  });

  it('combines OCR word confidence and fuzzy match score using documented formula', () => {
    // Formula: round(0.40 * C_ocr + 0.60 * S_fuzzy, 2)
    // Case 1: Perfect OCR (1.0) and Perfect Catalogue Match (compositeScore = 0 => S_fuzzy = 1.0)
    expect(computeCombinedLineConfidence(1.0, 0.0)).toBe(1.0);

    // Case 2: Good OCR (0.9) with minor spelling variation (compositeScore = 0.1 => S_fuzzy = 0.9)
    // 0.4 * 0.9 + 0.6 * 0.9 = 0.36 + 0.54 = 0.90
    expect(computeCombinedLineConfidence(0.9, 0.1)).toBe(0.9);

    // Case 3: Strength mismatch penalty (compositeScore = 0.35 => S_fuzzy = 0.65)
    // 0.4 * 0.8 + 0.6 * 0.65 = 0.32 + 0.39 = 0.71
    expect(computeCombinedLineConfidence(0.8, 0.35)).toBe(0.71);
  });

  it('computes image legibility based on real OCR engine confidence statistics', () => {
    // Clear image
    const clearOcr: OcrEngineOutput = {
      rawText: 'Tab. Metformin 500 mg 1 tab twice daily',
      lines: [
        {
          text: 'Tab. Metformin 500 mg',
          words: [
            { text: 'Tab.', confidence: 0.9 },
            { text: 'Metformin', confidence: 0.95 },
            { text: '500', confidence: 0.9 },
            { text: 'mg', confidence: 0.9 },
          ],
          confidence: 0.91,
        },
      ],
      meanWordConfidence: 0.91,
      modelName: 'trocr-handwritten',
      engineTier: 'tier1_hf_trocr',
    };
    const clearResult = parseOcrOutputToPrescription(clearOcr);
    expect(clearResult.image_legibility).toBe('clear');
    expect(clearResult.lines.length).toBe(1);
    expect(clearResult.lines[0].drug_name).toBe('Metformin');

    // Unreadable image
    const blurryOcr: OcrEngineOutput = {
      rawText: '... ?? ...',
      lines: [
        {
          text: '???',
          words: [{ text: '???', confidence: 0.15 }],
          confidence: 0.15,
        },
      ],
      meanWordConfidence: 0.2,
      modelName: 'tesseract-wasm-v5',
      engineTier: 'tier2_tesseract_wasm',
    };
    const blurryResult = parseOcrOutputToPrescription(blurryOcr);
    expect(blurryResult.image_legibility).toBe('unreadable');
    expect(blurryResult.lines.length).toBe(0);
  });
});
