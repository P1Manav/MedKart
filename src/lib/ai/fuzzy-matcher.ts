// src/lib/ai/fuzzy-matcher.ts
import Fuse from 'fuse.js';
import type { AiPrescriptionLine } from './types';
import type { ScheduleType } from '@prisma/client';

export interface CatalogueProduct {
  id: string;
  name: string;
  strength: string;
  form: string;
  price: number;
  schedule: ScheduleType;
  packSize: string;
}

export interface MatchCandidate {
  product: CatalogueProduct;
  score: number; // 0 (perfect match) to 1 (poor match)
  nameMatchScore: number;
  strengthMismatch: boolean;
  formMismatch: boolean;
}

export interface MatchLineResult {
  rawText: string;
  matchedProduct: CatalogueProduct | null;
  confidence: number;
  topCandidates: MatchCandidate[];
  needsReview: boolean;
  isBlockedNotSoldOnline: boolean;
  reason?: string;
}

export const MATCH_CONFIG = {
  // Fuse.js threshold: 0.0 is perfect match, 1.0 matches anything
  ACCEPTABLE_NAME_THRESHOLD: 0.45,
  MAX_CANDIDATES: 3,
};

/**
 * Normalizes strength strings for comparison (e.g. "500mg" -> "500 mg", "50mcg" -> "50 mcg")
 */
export function normalizeStrength(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, '').replace(/(\d+)([a-z]+)/, '$1 $2').trim();
}

/**
 * Normalizes pharmaceutical form for comparison (e.g. "tab", "tablet", "tabs" -> "tablet")
 */
export function normalizeForm(str: string | null | undefined): string {
  if (!str) return '';
  const s = str.toLowerCase().trim();
  if (s.startsWith('tab')) return 'tablet';
  if (s.startsWith('cap')) return 'capsule';
  if (s.startsWith('syr') || s.includes('liquid') || s.includes('susp')) return 'syrup';
  if (s.startsWith('inj') || s.includes('vial') || s.includes('amp')) return 'injection';
  if (s.includes('gel') || s.includes('oint')) return 'gel';
  return s;
}

/**
 * Match a single AI-transcribed line to the product catalogue.
 */
export function matchPrescriptionLine(
  aiLine: AiPrescriptionLine,
  catalogue: CatalogueProduct[]
): MatchLineResult {
  if (!aiLine.drug_name || aiLine.confidence < 0.2) {
    return {
      rawText: aiLine.raw_text,
      matchedProduct: null,
      confidence: aiLine.confidence || 0,
      topCandidates: [],
      needsReview: true,
      isBlockedNotSoldOnline: false,
      reason: 'Drug name is illegible or confidence is too low.',
    };
  }

  const fuse = new Fuse(catalogue, {
    keys: ['name'],
    includeScore: true,
    threshold: MATCH_CONFIG.ACCEPTABLE_NAME_THRESHOLD,
    ignoreLocation: true,
  });

  const searchResults = fuse.search(aiLine.drug_name);

  if (searchResults.length === 0) {
    return {
      rawText: aiLine.raw_text,
      matchedProduct: null,
      confidence: 0,
      topCandidates: [],
      needsReview: true,
      isBlockedNotSoldOnline: false,
      reason: 'No matching medicine found in store catalogue.',
    };
  }

  const normalizedAiStrength = normalizeStrength(aiLine.strength);
  const normalizedAiForm = normalizeForm(aiLine.form);

  const candidates: MatchCandidate[] = searchResults
    .slice(0, MATCH_CONFIG.MAX_CANDIDATES)
    .map((res) => {
      const prod = res.item;
      const nameScore = res.score ?? 1;

      const normProdStrength = normalizeStrength(prod.strength);
      const strengthMismatch =
        normalizedAiStrength !== '' &&
        normProdStrength !== '' &&
        normalizedAiStrength !== normProdStrength;

      const normProdForm = normalizeForm(prod.form);
      const formMismatch =
        normalizedAiForm !== '' &&
        normProdForm !== '' &&
        normalizedAiForm !== normProdForm;

      // Penalize combined score if strength or form mismatches
      let compositeScore = nameScore;
      if (strengthMismatch) compositeScore += 0.35;
      if (formMismatch) compositeScore += 0.2;

      return {
        product: prod,
        score: Math.min(1.0, compositeScore),
        nameMatchScore: nameScore,
        strengthMismatch,
        formMismatch,
      };
    })
    .sort((a, b) => a.score - b.score);

  const bestCandidate = candidates[0];

  // RULE §6.2: "A strength or form mismatch MUST drop the line to needs_review regardless of name score."
  const hasMismatch = bestCandidate.strengthMismatch || bestCandidate.formMismatch;
  const isConfidenceLow = (aiLine.confidence || 0) < 0.8 || bestCandidate.score > 0.3;
  const needsReview = hasMismatch || isConfidenceLow;

  // RULE §5.2: "If the AI draft detects such an item on a prescription, the line is auto-flagged BLOCKED_NOT_SOLD_ONLINE"
  const isBlocked =
    bestCandidate.product.schedule === 'X' || bestCandidate.product.schedule === 'NARCOTIC';

  let reason: string | undefined = undefined;
  if (isBlocked) {
    reason = 'This medicine belongs to Schedule X/Narcotic and cannot be dispensed online under statutory rules.';
  } else if (bestCandidate.strengthMismatch) {
    reason = `Strength mismatch: prescription says "${aiLine.strength}", catalogue item is "${bestCandidate.product.strength}".`;
  } else if (bestCandidate.formMismatch) {
    reason = `Form mismatch: prescription says "${aiLine.form}", catalogue item is "${bestCandidate.product.form}".`;
  } else if (isConfidenceLow) {
    reason = 'AI draft has moderate confidence; pharmacist review required.';
  }

  return {
    rawText: aiLine.raw_text,
    matchedProduct: bestCandidate.product,
    confidence: Math.round((1 - bestCandidate.score) * 100) / 100,
    topCandidates: candidates,
    needsReview,
    isBlockedNotSoldOnline: isBlocked,
    reason,
  };
}
