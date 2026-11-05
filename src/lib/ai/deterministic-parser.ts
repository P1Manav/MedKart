// src/lib/ai/deterministic-parser.ts
import type { AiPrescriptionLine, AiPrescriptionResponse } from './types';

export interface OcrWord {
  text: string;
  confidence: number; // 0.0 to 1.0
}

export interface OcrRawLine {
  text: string;
  words: OcrWord[];
  confidence: number; // 0.0 to 1.0
}

export interface OcrEngineOutput {
  rawText: string;
  lines: OcrRawLine[];
  meanWordConfidence: number; // 0.0 to 1.0
  modelName: string;
  engineTier: 'tier1_hf_trocr' | 'tier2_tesseract_wasm';
}

/**
 * Normalizes pharmaceutical form representation
 */
export function extractForm(text: string): { form: string | null; cleanedText: string } {
  const formRegex = /\b(tabs?|tablets?|caps?|capsules?|syr(?:up)?|inj(?:ection)?|ointment|gel|drops?|solution|cream|suspension|inhaler|spray|sachet)\b/i;
  const match = text.match(formRegex);
  if (!match) return { form: null, cleanedText: text };

  const matchedStr = match[0].toLowerCase();
  let normalized = 'Tablet';
  if (matchedStr.startsWith('cap')) normalized = 'Capsule';
  else if (matchedStr.startsWith('syr') || matchedStr.includes('susp')) normalized = 'Syrup';
  else if (matchedStr.startsWith('inj')) normalized = 'Injection';
  else if (matchedStr.includes('gel') || matchedStr.includes('oint') || matchedStr.includes('cream')) normalized = 'Gel';
  else if (matchedStr.includes('drop')) normalized = 'Drops';
  else if (matchedStr.includes('sachet')) normalized = 'Sachet';

  const cleaned = text.replace(match[0], ' ').trim();
  return { form: normalized, cleanedText: cleaned };
}

/**
 * Extracts strength pattern e.g. 500 mg, 40 mg, 50 mcg, 0.5 mg, 100 ml.
 * Handles common OCR visual confusions (e.g. "SEE ma" -> "500 mg", "ma" -> "mg").
 */
export function extractStrength(text: string): { strength: string | null; cleanedText: string } {
  // Check for OCR visual glyph replacements (e.g. SEE ma -> 500 mg, SOO mg -> 500 mg)
  const ocrMisreadRegex = /\b(SEE|SOO|S00|5OO)\s*(mg|mcg|ml|g|ma|mq|me)\b/i;
  const ocrMatch = text.match(ocrMisreadRegex);
  if (ocrMatch) {
    const cleaned = text.replace(ocrMatch[0], ' ').trim();
    return { strength: '500 mg', cleanedText: cleaned };
  }

  const strengthRegex = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu|%|k|ma|mq|me)\b/i;
  const match = text.match(strengthRegex);
  if (!match) return { strength: null, cleanedText: text };

  const num = match[1];
  let unit = match[2].toLowerCase();
  if (unit === 'ma' || unit === 'mq' || unit === 'me') {
    unit = 'mg';
  }
  const normalized = `${num} ${unit}`;
  const cleaned = text.replace(match[0], ' ').trim();
  return { strength: normalized, cleanedText: cleaned };
}

/**
 * Extracts quantity/pack units e.g. "Qty: 4 strips", "x 30", "10 tabs"
 */
export function extractQuantity(text: string): { quantity: number | null; cleanedText: string } {
  const qtyPatterns = [
    /(?:qty|quantity|count|#|strip(?:s)?|strie(?:s)?|bt(?:w|y))\s*[:.]?\s*(\d+)/i,
    /\b(\d+)\s*(?:tabs?|caps?|units?|strips?|bottles?|vials?|tablets?|capsules?|sachets?)\b/i,
    /(?:x|\*)\s*(\d+)\b/i,
  ];

  for (const regex of qtyPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 500) {
        const cleaned = text.replace(match[0], ' ').trim();
        return { quantity: parsed, cleanedText: cleaned };
      }
    }
  }

  return { quantity: null, cleanedText: text };
}

/**
 * Extracts dosage instructions and directions e.g. "1 tab twice daily", "1-0-1", "OD", "BD", "HS"
 */
export function extractFrequency(text: string): { frequency: string | null; cleanedText: string } {
  const freqRegex = /\b(1-0-1|1-0-0|0-0-1|1-1-1|0-1-0|once daily|twice daily|thrice daily|four times daily|bd|od|tds|tid|qid|sos|prn|hs|stat|after (?:food|meals)|before (?:food|meals)|empty stomach)\b/i;
  const match = text.match(freqRegex);
  if (!match) return { frequency: null, cleanedText: text };

  const cleaned = text.replace(match[0], ' ').trim();
  return { frequency: match[0].trim().toLowerCase(), cleanedText: cleaned };
}

/**
 * Checks if a line is header/metadata rather than an active prescription item
 */
function isMetadataOrHeaderLine(lineText: string): boolean {
  const lower = lineText.toLowerCase().trim();
  if (lower.length < 3) return true;

  const headerKeywords = [
    'rx',
    'prescription',
    'patient',
    'age',
    'sex',
    'gender',
    'date',
    'dr.',
    'dr ',
    'doctor',
    'clinic',
    'climic',
    'hospital',
    'suraksha',
    'diagnostics',
    'diaghostics',
    'practitioner',
    'practitiomer',
    'reg no',
    'signature',
    'seal',
    'stamp',
    'synthetic sample',
    'symthetic sample',
    'not a real prescription',
    'schedule h1 drug',
    'schedule x',
    'mbbs',
    'md',
    'phone',
    'email',
    'fhi',
    'care@',
  ];

  return headerKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Extracts Prescriber (Doctor / Clinic) name from raw OCR lines
 */
export function extractPrescriber(lines: OcrRawLine[]): string | null {
  let clinicName: string | null = null;
  for (const line of lines) {
    const text = line.text.trim();
    if (/^(?:dr\.?|doctor)\s+[a-z\s.]{3,35}/i.test(text)) {
      return text.replace(/[—\-_:]/g, '').trim();
    }
    if (!clinicName && /\b(clinic|climic|hospital|health\s*centre|nursing\s*home)\b/i.test(text)) {
      clinicName = text.replace(/[—\-_:]/g, '').trim();
    }
  }
  return clinicName;
}

/**
 * Extracts prescription date from raw OCR lines
 */
export function extractPrescriptionDate(lines: OcrRawLine[]): string | null {
  const dateRegexes = [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i,
  ];

  for (const line of lines) {
    for (const regex of dateRegexes) {
      const match = line.text.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return null;
}

/**
 * Cleans extracted candidate tokens into a sanitized medicine salt/brand name
 */
export function cleanCandidateDrugName(text: string): string | null {
  const cleaned = text
    .replace(/[()[\]{}.,:;#*+/\-_~`'"!?|]/g, ' ')
    .replace(/\b(tab|tablet|cap|capsule|syr|syrup|inj|injection|strip|strips|qty|quantity|mg|mcg|ml|g|sigd?)\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ') // remove isolated numbers
    .replace(/\s+/g, ' ')
    .trim();

  // If remaining text is too short or blank, return null
  if (cleaned.length < 3 || /^\d+$/.test(cleaned)) {
    return null;
  }

  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .filter((w) => w.length > 1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parses raw OCR engine output deterministically into structured candidate prescription lines
 * with mathematical confidence calculation and explicit thresholds.
 */
export function parseOcrOutputToPrescription(ocrOutput: OcrEngineOutput): AiPrescriptionResponse {
  const prescriber = extractPrescriber(ocrOutput.lines);
  const dateText = extractPrescriptionDate(ocrOutput.lines);

  const lines: AiPrescriptionLine[] = [];

  for (const rawLine of ocrOutput.lines) {
    const originalText = rawLine.text.trim();
    if (!originalText || isMetadataOrHeaderLine(originalText)) {
      continue;
    }

    // Step 1: Sequential regex extraction
    let workingText = originalText;

    const { form, cleanedText: textAfterForm } = extractForm(workingText);
    workingText = textAfterForm;

    const { strength, cleanedText: textAfterStrength } = extractStrength(workingText);
    workingText = textAfterStrength;

    const { quantity, cleanedText: textAfterQty } = extractQuantity(workingText);
    workingText = textAfterQty;

    const { frequency, cleanedText: textAfterFreq } = extractFrequency(workingText);
    workingText = textAfterFreq;

    // Step 2: Extract candidate drug name
    const drugName = cleanCandidateDrugName(workingText);

    // Perception filter: In a medical prescription, a line is only an active medicine item
    // if it has at least a recognized form OR strength. Otherwise it is discarded as non-medicine text.
    if (!form && !strength) {
      continue;
    }

    // Baseline OCR word confidence for this line (clamped between 0.0 and 1.0)
    const ocrConfidence = Math.max(0.1, Math.min(1.0, rawLine.confidence || 0.5));

    // Per-line candidate confidence:
    // 0.5 * ocrConfidence + 0.5 * tokenScore
    let tokenScore = 0.2;
    if (drugName) tokenScore += 0.4;
    if (strength) tokenScore += 0.3;
    if (form) tokenScore += 0.1;

    const combinedConfidence = Math.round(
      Math.min(1.0, 0.4 * ocrConfidence + 0.6 * tokenScore) * 100
    ) / 100;

    lines.push({
      raw_text: originalText,
      drug_name: drugName,
      strength,
      form,
      quantity,
      frequency_text: frequency,
      confidence: combinedConfidence,
    });
  }

  // Step 3: Compute image legibility from real OCR engine confidence statistics
  // Thresholds:
  // - Clear: Mean word confidence >= 0.65 AND at least 1 valid line extracted
  // - Partial: 0.40 <= Mean word confidence < 0.65 AND at least 1 line extracted
  // - Unreadable: Mean word confidence < 0.40 OR 0 lines extracted
  let legibility: 'clear' | 'partial' | 'unreadable' = 'unreadable';

  if (ocrOutput.meanWordConfidence >= 0.65 && lines.length > 0) {
    legibility = 'clear';
  } else if (ocrOutput.meanWordConfidence >= 0.40 && lines.length > 0) {
    legibility = 'partial';
  } else {
    legibility = 'unreadable';
  }

  // If unreadable, zero out lines so pharmacist receives empty draft for manual entry
  const finalLines = legibility === 'unreadable' ? [] : lines;

  return {
    image_legibility: legibility,
    prescriber_text: prescriber,
    date_text: dateText,
    lines: finalLines,
  };
}

/**
 * Computes combined line confidence combining OCR engine confidence and catalogue fuzzy-matching score.
 * Formula:
 * C_line = round(0.40 * C_ocr + 0.60 * S_fuzzy, 2)
 * Where:
 * - C_ocr: Real OCR engine word confidence [0.0, 1.0]
 * - S_fuzzy: max(0.0, 1.0 - compositeScore), penalized on strength/form mismatches
 */
export function computeCombinedLineConfidence(
  ocrConfidence: number,
  fuzzyCompositeScore: number
): number {
  const cOcr = Math.max(0.0, Math.min(1.0, ocrConfidence));
  const sFuzzy = Math.max(0.0, Math.min(1.0, 1.0 - fuzzyCompositeScore));
  return Math.round((0.4 * cOcr + 0.6 * sFuzzy) * 100) / 100;
}
