// tests/unit/i18n-parity.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, getLeafKeys(value as Record<string, unknown>, fullKey));
    } else if (typeof value === 'string') {
      result[fullKey] = value;
    }
  }
  return result;
}

describe('i18n Translation Parity (P0-11)', () => {
  const messagesDir = path.resolve(process.cwd(), 'messages');
  const enRaw = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf-8'));
  const hiRaw = JSON.parse(fs.readFileSync(path.join(messagesDir, 'hi.json'), 'utf-8'));
  const bnRaw = JSON.parse(fs.readFileSync(path.join(messagesDir, 'bn.json'), 'utf-8'));

  const enLeaves = getLeafKeys(enRaw);
  const hiLeaves = getLeafKeys(hiRaw);
  const bnLeaves = getLeafKeys(bnRaw);

  const enKeySet = new Set(Object.keys(enLeaves));
  const hiKeySet = new Set(Object.keys(hiLeaves));
  const bnKeySet = new Set(Object.keys(bnLeaves));

  it('all keys in en.json exist in hi.json (no missing Hindi translations)', () => {
    const missingInHi = [...enKeySet].filter((k) => !hiKeySet.has(k));
    expect(missingInHi, `Keys in en.json missing in hi.json: ${missingInHi.join(', ')}`).toEqual([]);
  });

  it('all keys in en.json exist in bn.json (no missing Bengali translations)', () => {
    const missingInBn = [...enKeySet].filter((k) => !bnKeySet.has(k));
    expect(missingInBn, `Keys in en.json missing in bn.json: ${missingInBn.join(', ')}`).toEqual([]);
  });

  it('all keys in hi.json exist in en.json (no orphaned Hindi keys)', () => {
    const extraInHi = [...hiKeySet].filter((k) => !enKeySet.has(k));
    expect(extraInHi, `Keys in hi.json not in en.json: ${extraInHi.join(', ')}`).toEqual([]);
  });

  it('all keys in bn.json exist in en.json (no orphaned Bengali keys)', () => {
    const extraInBn = [...bnKeySet].filter((k) => !enKeySet.has(k));
    expect(extraInBn, `Keys in bn.json not in en.json: ${extraInBn.join(', ')}`).toEqual([]);
  });

  it('no translated string in en.json, hi.json, or bn.json is empty or whitespace only', () => {
    for (const [key, val] of Object.entries(enLeaves)) {
      expect(val.trim().length, `en.json key "${key}" is empty`).toBeGreaterThan(0);
    }
    for (const [key, val] of Object.entries(hiLeaves)) {
      expect(val.trim().length, `hi.json key "${key}" is empty`).toBeGreaterThan(0);
    }
    for (const [key, val] of Object.entries(bnLeaves)) {
      expect(val.trim().length, `bn.json key "${key}" is empty`).toBeGreaterThan(0);
    }
  });
});
