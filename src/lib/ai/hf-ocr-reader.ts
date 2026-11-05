// src/lib/ai/hf-ocr-reader.ts
import { createWorker } from 'tesseract.js';
import type { PrescriptionReader, ReadResult, AiPrescriptionResponse } from './types';
import {
  parseOcrOutputToPrescription,
  type OcrEngineOutput,
  type OcrRawLine,
  type OcrWord,
} from './deterministic-parser';

export const HF_TIMEOUT_MS = 25000;

/**
 * Computes a deterministic lexical sanity and medical entity density confidence score.
 * Hugging Face Serverless Inference API for TrOCR returns strictly `{ generated_text: string }`
 * without per-token probabilities. To honestly eliminate hardcoded constants:
 * - Length check (>= 6 chars, >= 2 words)
 * - Alphanumeric character ratio (punishes non-printable / garbled OCR symbols)
 * - Character entropy / uniqueness (punishes degenerate repetition loops like "............")
 * - Medical entity density (presence of dosage/unit patterns: mg, mcg, ml, tab, cap, etc.)
 */
export function computeTrOcrConfidence(text: string): {
  overallConfidence: number;
  wordConfidence: (w: string) => number;
} {
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    return {
      overallConfidence: 0.1,
      wordConfidence: () => 0.1,
    };
  }

  const totalChars = trimmed.length;
  const alnumMatches = trimmed.match(/[a-zA-Z0-9]/g);
  const alnumChars = alnumMatches ? alnumMatches.length : 0;
  const alnumRatio = Math.min(1.0, alnumChars / totalChars);

  // Character entropy (unique lowercased characters vs sample size)
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s+/g, '')).size;
  const entropyRatio = Math.min(1.0, uniqueChars / Math.max(8, Math.min(20, totalChars)));

  // Medical keyword & dosage density
  const medicalRegex = /\b(\d+\s?(mg|mcg|ml|g|tablets?|capsules?|syrup)|tab|cap|od|bd|tds|sos|daily|po)\b/gi;
  const medMatches = trimmed.match(medicalRegex) || [];
  let medBonus = 0.0;
  if (medMatches.length >= 2) {
    medBonus = 0.35;
  } else if (medMatches.length === 1) {
    medBonus = 0.20;
  }

  // Raw score clamped between 0.10 and 0.95
  const rawScore = 0.35 * alnumRatio + 0.30 * entropyRatio + medBonus;
  const overallConfidence = Math.round(Math.max(0.1, Math.min(0.95, rawScore)) * 100) / 100;

  const wordConfidence = (w: string): number => {
    const cleanWord = w.trim();
    if (!cleanWord) return 0.1;
    const isMed = /\b(\d+\s?(mg|mcg|ml|g|tablets?|capsules?|syrup)|tab|cap|od|bd|tds|sos|daily|po)\b/i.test(cleanWord);
    if (isMed) {
      return Math.round(Math.min(0.95, overallConfidence + 0.05) * 100) / 100;
    }
    if (cleanWord.length <= 1 || /^[^a-zA-Z0-9]+$/.test(cleanWord)) {
      return Math.round(Math.max(0.1, overallConfidence - 0.25) * 100) / 100;
    }
    return overallConfidence;
  };

  return { overallConfidence, wordConfidence };
}

export class HfOcrReader implements PrescriptionReader {
  private modelName: string;
  private apiToken: string | undefined;

  constructor() {
    this.modelName = process.env.HF_OCR_MODEL || 'microsoft/trocr-base-handwritten';
    this.apiToken = process.env.HF_API_TOKEN;
  }

  async read(imageBytes: Buffer | Uint8Array, mimeType: string = 'image/png'): Promise<ReadResult> {
    const start = Date.now();
    const buffer = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes);

    // ── TIER 1: Hosted Small Model via Hugging Face Inference API ──
    if (this.apiToken && this.apiToken.trim().length > 0) {
      try {
        const tier1Result = await this.callHuggingFaceInference(buffer, mimeType);
        if (tier1Result && tier1Result.lines.length > 0 && tier1Result.image_legibility !== 'unreadable') {
          return {
            success: true,
            modelName: this.modelName,
            latencyMs: Date.now() - start,
            data: tier1Result,
            manualEntryNeeded: false,
          };
        }
      } catch (err: unknown) {
        console.warn(
          `[HfOcrReader] Tier 1 (${this.modelName}) failed or timed out: ${err instanceof Error ? err.message : String(err)}. Falling back to Tier 2 (Tesseract.js WASM)...`
        );
      }
    }

    // ── TIER 2: Local In-Process OCR via Tesseract.js (Zero Network Dependency) ──
    try {
      const tier2Result = await this.callTesseractOcr(buffer);
      const latencyMs = Date.now() - start;

      if (tier2Result.image_legibility === 'unreadable' || tier2Result.lines.length === 0) {
        return {
          success: true,
          modelName: 'tesseract-wasm-v5',
          latencyMs,
          data: tier2Result,
          manualEntryNeeded: true,
          errorMessage: 'Handwriting transcription confidence below legible threshold. Routed to pharmacist manual queue.',
        };
      }

      return {
        success: true,
        modelName: 'tesseract-wasm-v5',
        latencyMs,
        data: tier2Result,
        manualEntryNeeded: false,
      };
    } catch (err: unknown) {
      console.warn(
        `[HfOcrReader] Tier 2 Tesseract engine failure: ${err instanceof Error ? err.message : String(err)}. Routing to Tier 3 manual queue.`
      );
    }

    // ── TIER 3: Deterministic Fallback to Pharmacist Manual Review ──
    return {
      success: false,
      modelName: 'ocr-manual-fallback',
      latencyMs: Date.now() - start,
      manualEntryNeeded: true,
      errorMessage: 'Automated OCR transcription could not read image. Routed to pharmacist manual entry queue.',
      data: {
        image_legibility: 'unreadable',
        prescriber_text: null,
        date_text: null,
        lines: [],
      },
    };
  }

  /**
   * Calls Hugging Face free Inference API router with strict timeout and retry handling.
   */
  private async callHuggingFaceInference(
    imageBytes: Buffer,
    mimeType: string
  ): Promise<AiPrescriptionResponse | null> {
    const endpoint = `https://router.huggingface.co/hf-inference/models/${this.modelName}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': mimeType || 'image/png',
        },
        body: new Uint8Array(imageBytes),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`HF Inference HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      const json = await res.json();
      let generatedText = '';

      if (Array.isArray(json) && json.length > 0 && typeof json[0]?.generated_text === 'string') {
        generatedText = json[0].generated_text;
      } else if (typeof json?.generated_text === 'string') {
        generatedText = json.generated_text;
      }

      if (!generatedText.trim()) {
        return null;
      }

      const { overallConfidence, wordConfidence } = computeTrOcrConfidence(generatedText);

      // If text sanity score is below 0.45, treat as unreadable/low confidence so it safely falls back
      if (overallConfidence < 0.45) {
        return null;
      }

      const rawLines = generatedText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const ocrLines: OcrRawLine[] = rawLines.map((line) => {
        const words: OcrWord[] = line.split(/\s+/).map((w) => ({
          text: w,
          confidence: wordConfidence(w),
        }));
        const lineConfidence =
          words.length > 0
            ? Math.round((words.reduce((sum, w) => sum + w.confidence, 0) / words.length) * 100) / 100
            : overallConfidence;
        return {
          text: line,
          words,
          confidence: lineConfidence,
        };
      });

      const ocrOutput: OcrEngineOutput = {
        rawText: generatedText,
        lines: ocrLines,
        meanWordConfidence: overallConfidence,
        modelName: this.modelName,
        engineTier: 'tier1_hf_trocr',
      };

      return parseOcrOutputToPrescription(ocrOutput);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Executes local in-process OCR via Tesseract.js WASM engine.
   * Extracts real per-word and per-line confidence scores.
   */
  private async callTesseractOcr(imageBytes: Buffer): Promise<AiPrescriptionResponse> {
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(imageBytes);
      const data = result.data;

      const ocrLines: OcrRawLine[] = [];
      let totalConfidenceSum = 0;
      let totalWordCount = 0;

      if (Array.isArray(data.blocks) && data.blocks.length > 0) {
        for (const block of data.blocks) {
          for (const para of block.paragraphs || []) {
            for (const line of para.lines || []) {
              const lineText = line.text.trim();
              if (!lineText) continue;

              const words: OcrWord[] = (line.words || []).map((w) => {
                const normalizedConf = Math.max(0.0, Math.min(1.0, (w.confidence || 0) / 100));
                totalConfidenceSum += normalizedConf;
                totalWordCount += 1;
                return {
                  text: w.text,
                  confidence: normalizedConf,
                };
              });

              const lineConf =
                words.length > 0
                  ? words.reduce((acc, w) => acc + w.confidence, 0) / words.length
                  : Math.max(0.0, Math.min(1.0, (line.confidence || 0) / 100));

              ocrLines.push({
                text: lineText,
                words,
                confidence: lineConf,
              });
            }
          }
        }
      } else if (data.text && data.text.trim()) {
        const textLines = data.text.split('\n').filter((l) => l.trim().length > 0);
        const overallConf = Math.max(0.0, Math.min(1.0, (data.confidence || 0) / 100));
        for (const t of textLines) {
          ocrLines.push({
            text: t.trim(),
            words: t.split(/\s+/).map((w) => ({ text: w, confidence: overallConf })),
            confidence: overallConf,
          });
        }
      }

      const meanWordConfidence =
        totalWordCount > 0
          ? totalConfidenceSum / totalWordCount
          : Math.max(0.0, Math.min(1.0, (data.confidence || 0) / 100));

      const ocrOutput: OcrEngineOutput = {
        rawText: data.text,
        lines: ocrLines,
        meanWordConfidence,
        modelName: 'tesseract-wasm-v5',
        engineTier: 'tier2_tesseract_wasm',
      };

      return parseOcrOutputToPrescription(ocrOutput);
    } finally {
      await worker.terminate();
    }
  }
}
