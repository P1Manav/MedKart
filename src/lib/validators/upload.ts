// src/lib/validators/upload.ts
// Prescription image upload validation & EXIF GPS stripping (Master Prompt v6)

import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB strictly enforced
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const PrescriptionUploadSchema = z.object({
  size: z
    .number()
    .positive('File cannot be empty')
    .max(MAX_UPLOAD_BYTES, 'Prescription file size must not exceed 5 MB'),
  type: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val as typeof ALLOWED_MIME_TYPES[number]), {
    message: 'Allowed file formats are JPEG, PNG, and WebP',
  }),
});

/**
 * Validates real magic bytes from the start of the file buffer to prevent MIME-spoofing attacks.
 */
export function validateMagicBytes(buffer: Buffer | Uint8Array): {
  valid: boolean;
  detectedMime?: string;
  error?: string;
} {
  if (!buffer || buffer.length < 4) {
    return { valid: false, error: 'File buffer is too small to determine format' };
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // WebP: RIFF (4 bytes) ... WEBP (bytes 8..11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'File contents do not match genuine image magic bytes (PNG, JPEG, WebP required)',
  };
}

/**
 * Strips EXIF metadata including GPS coordinates from JPEG image buffers for DPDP Act 2023 compliance.
 */
export function stripExifGps(buffer: Buffer): Buffer {
  // If not a JPEG file, return buffer unmodified
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }

  const chunks: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let offset = 2;

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];

    // SOS (Start of Scan) or EOI (End of Image) -> copy remainder
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (offset + 4 > buffer.length) break;
    const len = buffer.readUInt16BE(offset + 2);

    // APP1 marker (0xFFE1) typically contains EXIF and GPS tags
    if (marker === 0xe1) {
      // Skip APP1 segment to strip all EXIF/GPS
      offset += 2 + len;
      continue;
    }

    chunks.push(buffer.subarray(offset, offset + 2 + len));
    offset += 2 + len;
  }

  return Buffer.from(Buffer.concat(chunks));
}

/**
 * Sanitizes uploaded filename to prevent directory traversal or script injection.
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

export function validatePrescriptionFile(file: { size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  const result = PrescriptionUploadSchema.safeParse(file);
  if (!result.success) {
    return {
      valid: false,
      error: result.error.issues[0]?.message || 'Invalid prescription file',
    };
  }
  return { valid: true };
}
