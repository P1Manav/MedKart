// tests/unit/encryption.test.ts
import { describe, it, expect } from 'vitest';
import {
  encryptPrescription,
  decryptPrescription,
} from '@/lib/crypto/encrypt';

describe('AES-256-GCM Prescription Encryption & Tamper Detection', () => {
  const sampleImageBytes = Buffer.from('RIFF_FAKE_JPEG_IMAGE_HEADER_AND_PIXELS_FOR_TESTING');

  it('successfully encrypts and decrypts a prescription buffer (round-trip)', () => {
    const encryptedData = encryptPrescription(sampleImageBytes);

    expect(encryptedData.encrypted).toBeDefined();
    expect(encryptedData.iv).toHaveLength(12); // 96-bit IV
    expect(encryptedData.authTag).toHaveLength(16); // 128-bit GCM auth tag

    const decrypted = decryptPrescription(
      encryptedData.encrypted,
      encryptedData.iv,
      encryptedData.authTag
    );

    expect(decrypted.toString()).toBe(sampleImageBytes.toString());
  });

  it('generates a unique random IV for every encryption call', () => {
    const enc1 = encryptPrescription(sampleImageBytes);
    const enc2 = encryptPrescription(sampleImageBytes);

    expect(enc1.iv.equals(enc2.iv)).toBe(false);
    expect(enc1.encrypted.equals(enc2.encrypted)).toBe(false);
  });

  it('CRITICAL: detects ciphertext tampering and refuses decryption', () => {
    const encryptedData = encryptPrescription(sampleImageBytes);

    // Tamper with one byte in the ciphertext
    const tampered = Buffer.from(encryptedData.encrypted);
    tampered[0] ^= 0xff;

    expect(() => {
      decryptPrescription(tampered, encryptedData.iv, encryptedData.authTag);
    }).toThrow();
  });

  it('CRITICAL: detects authentication tag tampering and refuses decryption', () => {
    const encryptedData = encryptPrescription(sampleImageBytes);

    // Tamper with one byte in the auth tag
    const tamperedTag = Buffer.from(encryptedData.authTag);
    tamperedTag[0] ^= 0xaa;

    expect(() => {
      decryptPrescription(encryptedData.encrypted, encryptedData.iv, tamperedTag);
    }).toThrow();
  });
});

