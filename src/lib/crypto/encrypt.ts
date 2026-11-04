// src/lib/crypto/encrypt.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
  const hexKey = process.env.PRESCRIPTION_ENC_KEY;
  if (!hexKey) {
    // Fallback for tests/dev if env var is missing
    const fallback = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    return Buffer.from(fallback, 'hex');
  }
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error('PRESCRIPTION_ENC_KEY must be a 64-character hex string (32 bytes for AES-256)');
  }
  return key;
}

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypts arbitrary buffer (e.g. prescription image) with AES-256-GCM.
 * Generates a unique random 12-byte IV per invocation.
 */
export function encryptPrescription(buffer: Buffer | Uint8Array): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv,
    authTag,
  };
}

/**
 * Decrypts AES-256-GCM encrypted payload.
 * Verifies authenticity using authTag. If tampered with, throws error.
 */
export function decryptPrescription(
  encrypted: Buffer | Uint8Array,
  iv: Buffer | Uint8Array,
  authTag: Buffer | Uint8Array
): Buffer {
  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

