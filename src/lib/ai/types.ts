// src/lib/ai/types.ts
import { z } from 'zod';

export const AiPrescriptionLineSchema = z.object({
  raw_text: z.string().describe('Exact transcribed text from the prescription image'),
  drug_name: z.string().nullable().describe('Identified drug name or null if illegible'),
  strength: z.string().nullable().describe('Strength e.g. 500 mg, 40 mg, 50 mcg'),
  form: z.string().nullable().describe('Form e.g. Tablet, Syrup, Injection, Capsule'),
  quantity: z.number().int().positive().nullable().describe('Quantity of packs or units if indicated'),
  frequency_text: z.string().nullable().describe('Written dosage instructions e.g. 1 tab twice daily'),
  confidence: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0'),
});

export type AiPrescriptionLine = z.infer<typeof AiPrescriptionLineSchema>;

export const AiPrescriptionResponseSchema = z.object({
  image_legibility: z.enum(['clear', 'partial', 'unreadable']),
  prescriber_text: z.string().nullable().describe('Doctor or clinic name if legible'),
  date_text: z.string().nullable().describe('Date on prescription if legible'),
  lines: z.array(AiPrescriptionLineSchema),
});

export type AiPrescriptionResponse = z.infer<typeof AiPrescriptionResponseSchema>;

export interface ReadResult {
  success: boolean;
  modelName: string;
  latencyMs: number;
  data?: AiPrescriptionResponse;
  manualEntryNeeded: boolean;
  errorMessage?: string;
}

export interface PrescriptionReader {
  read(imageBytes: Buffer | Uint8Array, mimeType?: string): Promise<ReadResult>;
}
