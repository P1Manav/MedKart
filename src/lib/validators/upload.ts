// src/lib/validators/upload.ts
// Prescription image upload validation (ASSUMPTION A6)

import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const PrescriptionUploadSchema = z.object({
  size: z.number().max(MAX_UPLOAD_BYTES, 'Prescription image size must not exceed 8 MB'),
  type: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val as typeof ALLOWED_MIME_TYPES[number]), {
    message: 'Allowed file formats are JPEG, PNG, and WebP',
  }),
});

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
