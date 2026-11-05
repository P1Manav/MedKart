// tests/unit/hf-ocr-reader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HfOcrReader } from '@/lib/ai/hf-ocr-reader';

describe('HfOcrReader 3-Tier Pipeline', () => {
  const originalEnv = { ...process.env };
  const dummyBuffer = Buffer.from('test_prescription_image_bytes');

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('Tier 1: Successfully calls Hugging Face Inference API when token is provided', async () => {
    process.env.HF_API_TOKEN = 'hf_mock_token_12345';
    process.env.HF_OCR_MODEL = 'microsoft/trocr-base-handwritten';

    // Mock fetch to simulate Hugging Face router response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ generated_text: 'Dr. S. Mukherjee\nTab. Metformin 500 mg\n1 tab twice daily' }],
    });
    vi.stubGlobal('fetch', mockFetch);

    const reader = new HfOcrReader();
    const result = await reader.read(dummyBuffer, 'image/png');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://router.huggingface.co/hf-inference/models/microsoft/trocr-base-handwritten',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer hf_mock_token_12345',
        }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.modelName).toBe('microsoft/trocr-base-handwritten');
    expect(result.data?.lines.length).toBeGreaterThan(0);
    expect(result.data?.lines[0].drug_name).toBe('Metformin');
    expect(result.data?.lines[0].strength).toBe('500 mg');
  });

  it('Tier 2: Gracefully falls back to Tesseract.js when Tier 1 fails (e.g. 503 loading, 429 quota, or network error)', async () => {
    process.env.HF_API_TOKEN = 'hf_mock_token_12345';

    // Mock fetch to simulate Tier 1 failure (HTTP 503 model is loading)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => 'Model is loading',
    });
    vi.stubGlobal('fetch', mockFetch);

    const reader = new HfOcrReader();

    // Spy on callTesseractOcr to verify Tier 2 engages
    const tesseractSpy = vi
      .spyOn(reader as unknown as { callTesseractOcr: (b: Buffer) => Promise<unknown> }, 'callTesseractOcr')
      .mockResolvedValue({
        image_legibility: 'clear',
        prescriber_text: 'Dr. A. Ghosh',
        date_text: '15/10/2026',
        lines: [
          {
            raw_text: 'Tab. Telmisartan 40 mg',
            drug_name: 'Telmisartan',
            strength: '40 mg',
            form: 'Tablet',
            quantity: 3,
            frequency_text: 'once daily',
            confidence: 0.89,
          },
        ],
      });

    const result = await reader.read(dummyBuffer, 'image/png');

    expect(mockFetch).toHaveBeenCalled();
    expect(tesseractSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.modelName).toBe('tesseract-wasm-v5');
    expect(result.data?.lines[0].drug_name).toBe('Telmisartan');
  });

  it('Tier 3: Routes to pharmacist manual review queue when both OCR engines return unreadable text', async () => {
    delete process.env.HF_API_TOKEN;

    const reader = new HfOcrReader();

    vi.spyOn(reader as unknown as { callTesseractOcr: (b: Buffer) => Promise<unknown> }, 'callTesseractOcr').mockResolvedValue({
      image_legibility: 'unreadable',
      prescriber_text: null,
      date_text: null,
      lines: [],
    });

    const result = await reader.read(dummyBuffer, 'image/png');

    expect(result.success).toBe(true);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.data?.image_legibility).toBe('unreadable');
    expect(result.data?.lines).toHaveLength(0);
    expect(result.errorMessage).toContain('pharmacist manual queue');
  });
});

