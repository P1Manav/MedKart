// tests/unit/ai-failure-paths.test.ts
import { describe, it, expect } from 'vitest';
import { MockReader } from '@/lib/ai/mock-reader';

describe('AI Failure Paths & Uncertainty Routing (Honest AI)', () => {
  const dummyBuffer = Buffer.from('synthetic_rx_image_bytes');

  it('handles valid legible prescription image', async () => {
    const reader = new MockReader('valid');
    const result = await reader.read(dummyBuffer);

    expect(result.success).toBe(true);
    expect(result.manualEntryNeeded).toBe(false);
    expect(result.data?.image_legibility).toBe('clear');
    expect(result.data?.lines.length).toBeGreaterThan(0);
  });

  it('routes blurry/unreadable image to pharmacist manual entry queue', async () => {
    const reader = new MockReader('unreadable');
    const result = await reader.read(dummyBuffer);

    expect(result.success).toBe(true);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.data?.image_legibility).toBe('unreadable');
    expect(result.data?.lines).toHaveLength(0);
    expect(result.errorMessage).toContain('blurry or illegible');
  });

  it('routes invalid JSON output to pharmacist manual entry queue', async () => {
    const reader = new MockReader('invalid_json');
    const result = await reader.read(dummyBuffer);

    expect(result.success).toBe(false);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.errorMessage).toContain('invalid JSON');
  });

  it('routes request timeout to pharmacist manual entry queue', async () => {
    const reader = new MockReader('timeout');
    const result = await reader.read(dummyBuffer);

    expect(result.success).toBe(false);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.errorMessage).toContain('timed out');
  });

  it('routes quota exhaustion (HTTP 429) to pharmacist manual entry queue', async () => {
    const reader = new MockReader('quota_exhausted');
    const result = await reader.read(dummyBuffer);

    expect(result.success).toBe(false);
    expect(result.manualEntryNeeded).toBe(true);
    expect(result.errorMessage).toContain('quota exceeded');
  });
});
