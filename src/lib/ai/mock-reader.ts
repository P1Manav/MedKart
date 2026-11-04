// src/lib/ai/mock-reader.ts
import type { PrescriptionReader, ReadResult, AiPrescriptionResponse } from './types';

export type MockScenario = 'valid' | 'unreadable' | 'invalid_json' | 'timeout' | 'quota_exhausted';

export class MockReader implements PrescriptionReader {
  constructor(private scenario: MockScenario = 'valid') {}

  setScenario(scenario: MockScenario) {
    this.scenario = scenario;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async read(_imageBytes: Buffer | Uint8Array): Promise<ReadResult> {
    const start = Date.now();

    switch (this.scenario) {
      case 'valid': {
        const data: AiPrescriptionResponse = {
          image_legibility: 'clear',
          prescriber_text: 'Dr. Subir Mukherjee, MBBS, MD',
          date_text: '04-Nov-2026',
          lines: [
            {
              raw_text: 'Tab. Metformin 500 mg, twice daily x 30 days',
              drug_name: 'Metformin',
              strength: '500 mg',
              form: 'Tablet',
              quantity: 4,
              frequency_text: '1 tab twice daily',
              confidence: 0.96,
            },
            {
              raw_text: 'Tab. Telmisartan 40 mg, 1 tab OD',
              drug_name: 'Telmisartan',
              strength: '40 mg',
              form: 'Tablet',
              quantity: 3,
              frequency_text: '1 tab once daily',
              confidence: 0.94,
            },
          ],
        };

        return {
          success: true,
          modelName: 'mock-reader-v1',
          latencyMs: Date.now() - start + 20,
          data,
          manualEntryNeeded: false,
        };
      }

      case 'unreadable': {
        const data: AiPrescriptionResponse = {
          image_legibility: 'unreadable',
          prescriber_text: null,
          date_text: null,
          lines: [],
        };

        return {
          success: true,
          modelName: 'mock-reader-v1',
          latencyMs: Date.now() - start + 15,
          data,
          manualEntryNeeded: true,
          errorMessage: 'Prescription image is blurry or illegible. Manual entry required.',
        };
      }

      case 'invalid_json': {
        return {
          success: false,
          modelName: 'mock-reader-v1',
          latencyMs: Date.now() - start + 10,
          manualEntryNeeded: true,
          errorMessage: 'Failed to parse model response: invalid JSON format.',
        };
      }

      case 'timeout': {
        return {
          success: false,
          modelName: 'mock-reader-v1',
          latencyMs: 5000,
          manualEntryNeeded: true,
          errorMessage: 'Request to AI model timed out after 5000ms.',
        };
      }

      case 'quota_exhausted': {
        return {
          success: false,
          modelName: 'mock-reader-v1',
          latencyMs: Date.now() - start + 5,
          manualEntryNeeded: true,
          errorMessage: 'AI model quota exceeded (HTTP 429). Routed to pharmacist manual queue.',
        };
      }

      default:
        throw new Error(`Unknown MockReader scenario: ${this.scenario}`);
    }
  }
}
