// src/lib/ai/gemini-reader.ts
import { GoogleGenAI } from '@google/genai';
import {
  type PrescriptionReader,
  type ReadResult,
  AiPrescriptionResponseSchema,
  type AiPrescriptionResponse,
} from './types';

export const GEMINI_TIMEOUT_MS = 20000;

export class GeminiReader implements PrescriptionReader {
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async read(imageBytes: Buffer | Uint8Array, mimeType: string = 'image/jpeg'): Promise<ReadResult> {
    const start = Date.now();

    if (!this.ai) {
      return {
        success: false,
        modelName: this.modelName,
        latencyMs: Date.now() - start,
        manualEntryNeeded: true,
        errorMessage: 'Gemini API key is not configured. Routed to pharmacist manual queue.',
      };
    }

    try {
      const base64Data = Buffer.from(imageBytes).toString('base64');

      const prompt = `You are a medical transcription assistant reading a doctor's handwritten or printed prescription.
Your output must be strict JSON matching this structure:
{
  "image_legibility": "clear" | "partial" | "unreadable",
  "prescriber_text": string or null,
  "date_text": string or null,
  "lines": [
    {
      "raw_text": "Exact text written on this prescription line",
      "drug_name": "Standard drug / salt name" or null,
      "strength": "e.g. 500 mg, 40 mg, 50 mcg" or null,
      "form": "Tablet, Capsule, Syrup, Injection, etc." or null,
      "quantity": number or null,
      "frequency_text": "Dosage instructions as written" or null,
      "confidence": number between 0.0 and 1.0
    }
  ]
}

STRICT SAFETY RULES:
1. Transcribe ONLY what is written on the document. NEVER guess, infer, or hallucinate missing text.
2. If any word or number is illegible, return null for that field and set confidence lower.
3. If the entire image is blurry, cropped, or unreadable, set "image_legibility": "unreadable" and empty lines array.
4. Output JSON ONLY with no markdown ticks or extra text.`;

      let response: { text?: string } | undefined;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const generatePromise = this.ai.models.generateContent({
            model: this.modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1, // low temperature for precise transcription
            },
          });

          const timeoutPromise = new Promise<{ text?: string }>((_, reject) => {
            const timer = setTimeout(() => {
              reject(new Error(`Gemini API call timed out after ${GEMINI_TIMEOUT_MS}ms`));
            }, GEMINI_TIMEOUT_MS);
            if (typeof timer.unref === 'function') timer.unref();
          });

          response = await Promise.race([generatePromise, timeoutPromise]);
          break;
        } catch (err: unknown) {
          const errStr = String(err);
          const isRetryable =
            errStr.includes('429') ||
            errStr.includes('500') ||
            errStr.includes('503') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            errStr.includes('ECONNRESET');

          if (attempt === 1 && isRetryable) {
            console.warn(`[GeminiReader] Retryable error on attempt 1/2: ${errStr}. Retrying in 1000ms...`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw err;
        }
      }

      const latencyMs = Date.now() - start;
      const rawText = response?.text || '';

      if (!rawText.trim()) {
        return {
          success: false,
          modelName: this.modelName,
          latencyMs,
          manualEntryNeeded: true,
          errorMessage: 'Empty response received from AI model.',
        };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        return {
          success: false,
          modelName: this.modelName,
          latencyMs,
          manualEntryNeeded: true,
          errorMessage: 'AI model returned invalid JSON. Routed to pharmacist manual entry.',
        };
      }

      // Validate with Zod
      const parseResult = AiPrescriptionResponseSchema.safeParse(parsedJson);
      if (!parseResult.success) {
        return {
          success: false,
          modelName: this.modelName,
          latencyMs,
          manualEntryNeeded: true,
          errorMessage: `Response schema validation failed: ${parseResult.error.message}`,
        };
      }

      const data: AiPrescriptionResponse = parseResult.data;
      const manualEntryNeeded = data.image_legibility === 'unreadable' || data.lines.length === 0;

      // Log model name and latency only (DPDP & security rule)
      console.log(`[GeminiReader] model=${this.modelName} latency=${latencyMs}ms legibility=${data.image_legibility} lines=${data.lines.length}`);

      return {
        success: true,
        modelName: this.modelName,
        latencyMs,
        data,
        manualEntryNeeded,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GeminiReader] Error during transcription (latency=${latencyMs}ms):`, errorMsg);

      return {
        success: false,
        modelName: this.modelName,
        latencyMs,
        manualEntryNeeded: true,
        errorMessage: `AI service error: ${errorMsg}. Routed to pharmacist manual queue.`,
      };
    }
  }
}

