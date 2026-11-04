// tests/unit/fuzzy-matcher.test.ts
import { describe, it, expect } from 'vitest';
import {
  matchPrescriptionLine,
  normalizeStrength,
  normalizeForm,
  type CatalogueProduct,
} from '@/lib/ai/fuzzy-matcher';

describe('Fuzzy Catalogue Matcher', () => {
  const catalogue: CatalogueProduct[] = [
    {
      id: 'prod_metformin_500',
      name: 'Metformin',
      strength: '500 mg',
      form: 'Tablet',
      price: 30,
      schedule: 'H',
      packSize: 'strip of 15',
    },
    {
      id: 'prod_metformin_850',
      name: 'Metformin',
      strength: '850 mg',
      form: 'Tablet',
      price: 45,
      schedule: 'H',
      packSize: 'strip of 15',
    },
    {
      id: 'prod_telmisartan_40',
      name: 'Telmisartan',
      strength: '40 mg',
      form: 'Tablet',
      price: 95,
      schedule: 'H',
      packSize: 'strip of 10',
    },
    {
      id: 'prod_paracetamol_650',
      name: 'Paracetamol',
      strength: '650 mg',
      form: 'Tablet',
      price: 32,
      schedule: 'OTC',
      packSize: 'strip of 15',
    },
    {
      id: 'prod_methylphenidate_10',
      name: 'Methylphenidate',
      strength: '10 mg',
      form: 'Tablet',
      price: 110,
      schedule: 'X',
      packSize: 'strip of 10',
    },
  ];

  it('matches medicine name and strength with high confidence', () => {
    const result = matchPrescriptionLine(
      {
        raw_text: 'Tab Metformin 500mg BD',
        drug_name: 'Metformin',
        strength: '500 mg',
        form: 'Tablet',
        quantity: 2,
        frequency_text: 'twice daily',
        confidence: 0.95,
      },
      catalogue
    );

    expect(result.matchedProduct?.id).toBe('prod_metformin_500');
    expect(result.needsReview).toBe(false);
    expect(result.isBlockedNotSoldOnline).toBe(false);
  });

  it('CRITICAL: forces needsReview = true when strength mismatches, despite 100% name match', () => {
    // Prescription says Metformin 1000 mg, but catalogue only has 500 mg and 850 mg
    const result = matchPrescriptionLine(
      {
        raw_text: 'Tab Metformin 1000mg OD',
        drug_name: 'Metformin',
        strength: '1000 mg', // Mismatch!
        form: 'Tablet',
        quantity: 1,
        frequency_text: 'once daily',
        confidence: 0.98,
      },
      catalogue
    );

    expect(result.needsReview).toBe(true);
    expect(result.reason).toContain('Strength mismatch');
  });

  it('CRITICAL: auto-flags Schedule X and Narcotic items as BLOCKED_NOT_SOLD_ONLINE', () => {
    const result = matchPrescriptionLine(
      {
        raw_text: 'Tab Methylphenidate 10 mg morning',
        drug_name: 'Methylphenidate',
        strength: '10 mg',
        form: 'Tablet',
        quantity: 1,
        frequency_text: '1 tab in morning',
        confidence: 0.92,
      },
      catalogue
    );

    expect(result.isBlockedNotSoldOnline).toBe(true);
    expect(result.matchedProduct?.schedule).toBe('X');
    expect(result.reason).toContain('cannot be dispensed online');
  });

  it('handles low confidence or illegible names gracefully', () => {
    const result = matchPrescriptionLine(
      {
        raw_text: '??? unknown scribble',
        drug_name: null,
        strength: null,
        form: null,
        quantity: null,
        frequency_text: null,
        confidence: 0.1,
      },
      catalogue
    );

    expect(result.matchedProduct).toBeNull();
    expect(result.needsReview).toBe(true);
    expect(result.reason).toContain('illegible');
  });

  it('correctly normalizes strength and form variations', () => {
    expect(normalizeStrength('500mg')).toBe('500 mg');
    expect(normalizeStrength('50 mcg')).toBe('50 mcg');
    expect(normalizeForm('Tab.')).toBe('tablet');
    expect(normalizeForm('Capsules')).toBe('capsule');
  });
});

