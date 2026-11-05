// src/lib/validators/order-input.ts
import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from './upload';

// Kolkata & Howrah metropolitan coordinates bounding box
// Typical bounds: Lat 22.3 to 22.8, Lng 88.1 to 88.6 (expanded slightly to 22.0 - 23.0 and 88.0 - 89.0 for suburbs)
export const MIN_KOLKATA_LAT = 22.0;
export const MAX_KOLKATA_LAT = 23.0;
export const MIN_KOLKATA_LNG = 88.0;
export const MAX_KOLKATA_LNG = 89.0;

export const CartItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than 0'),
});

export const CreateOrderInputSchema = z.object({
  addressText: z
    .string()
    .min(5, 'Delivery address must be at least 5 characters')
    .max(300, 'Delivery address must not exceed 300 characters')
    .default('Salt Lake, Kolkata'),
  addressLat: z
    .coerce
    .number({ message: 'Valid numeric latitude is required' })
    .refine((val) => !isNaN(val), 'Latitude must be a valid number')
    .refine(
      (val) => val >= MIN_KOLKATA_LAT && val <= MAX_KOLKATA_LAT,
      `Latitude must be within Kolkata/Howrah metro area (${MIN_KOLKATA_LAT} - ${MAX_KOLKATA_LAT})`
    )
    .default(22.5875),
  addressLng: z
    .coerce
    .number({ message: 'Valid numeric longitude is required' })
    .refine((val) => !isNaN(val), 'Longitude must be a valid number')
    .refine(
      (val) => val >= MIN_KOLKATA_LNG && val <= MAX_KOLKATA_LNG,
      `Longitude must be within Kolkata/Howrah metro area (${MIN_KOLKATA_LNG} - ${MAX_KOLKATA_LNG})`
    )
    .default(88.4190),
  paymentMethod: z
    .enum(['MOCK_UPI', 'COD', 'DIRECT_UPI'], {
      message: 'Payment method must be MOCK_UPI, COD, or DIRECT_UPI',
    })
    .default('COD'),
  familyProfileId: z.string().min(1).nullable().optional(),
  cartItems: z.array(CartItemSchema).optional().default([]),
});

export const PrescriptionFileSchema = z.object({
  size: z
    .number()
    .positive('Uploaded file cannot be empty')
    .max(MAX_UPLOAD_BYTES, 'Prescription image size must not exceed 8 MB'),
  type: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val as typeof ALLOWED_MIME_TYPES[number]), {
    message: 'Allowed file formats are JPEG, PNG, and WebP',
  }),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
