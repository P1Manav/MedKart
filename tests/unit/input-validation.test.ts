// tests/unit/input-validation.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as createOrderHandler } from '@/app/api/orders/route';
import {
  CreateOrderInputSchema,
  PrescriptionFileSchema,
} from '@/lib/validators/order-input';
import * as rbac from '@/lib/auth/rbac';

describe('Input Validation & Boundary Checking (P0-8, Fix #6)', () => {
  const mockCustomer = {
    userId: 'cust_valid_user',
    phone: '9830011111',
    role: 'CUSTOMER' as const,
    name: 'Debasish Ghosh',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CreateOrderInputSchema Zod unit checks', () => {
    it('validates a correct payload in Kolkata metro region', () => {
      const validPayload = {
        addressText: 'Salt Lake Sector 1, Block BD, Kolkata - 700064',
        addressLat: 22.5875,
        addressLng: 88.4190,
        paymentMethod: 'COD',
        familyProfileId: null,
        cartItems: [{ productId: 'prod_123', quantity: 2 }],
      };

      const result = CreateOrderInputSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects short address less than 5 characters', () => {
      const payload = {
        addressText: 'ABC',
        addressLat: 22.5875,
        addressLng: 88.4190,
        paymentMethod: 'COD',
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/at least 5 characters/i);
    });

    it('rejects latitude outside Kolkata/Howrah metro area', () => {
      // Mumbai latitude (~19.07)
      const payload = {
        addressText: 'Marine Drive, Mumbai',
        addressLat: 19.0760,
        addressLng: 88.4190,
        paymentMethod: 'COD',
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/Latitude must be within Kolkata\/Howrah/i);
    });

    it('rejects longitude outside Kolkata/Howrah metro area', () => {
      // Delhi longitude (~77.10)
      const payload = {
        addressText: 'Connaught Place, New Delhi',
        addressLat: 22.5875,
        addressLng: 77.1025,
        paymentMethod: 'COD',
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/Longitude must be within Kolkata\/Howrah/i);
    });

    it('rejects invalid payment method', () => {
      const payload = {
        addressText: 'Salt Lake, Kolkata',
        addressLat: 22.5875,
        addressLng: 88.4190,
        paymentMethod: 'BITCOIN',
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/Payment method must be/i);
    });

    it('rejects non-numeric NaN coordinate strings', () => {
      const payload = {
        addressText: 'Salt Lake, Kolkata',
        addressLat: 'not-a-number',
        addressLng: 88.4190,
        paymentMethod: 'COD',
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects negative or zero item quantities in cart', () => {
      const payload = {
        addressText: 'Salt Lake, Kolkata',
        addressLat: 22.5875,
        addressLng: 88.4190,
        paymentMethod: 'COD',
        cartItems: [{ productId: 'prod_1', quantity: 0 }],
      };
      const result = CreateOrderInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/greater than 0/i);
    });
  });

  describe('PrescriptionFileSchema Zod unit checks', () => {
    it('accepts valid JPEG, PNG, and WebP under 8 MB', () => {
      expect(PrescriptionFileSchema.safeParse({ size: 1024 * 1024, type: 'image/jpeg' }).success).toBe(true);
      expect(PrescriptionFileSchema.safeParse({ size: 2 * 1024 * 1024, type: 'image/png' }).success).toBe(true);
      expect(PrescriptionFileSchema.safeParse({ size: 3 * 1024 * 1024, type: 'image/webp' }).success).toBe(true);
    });

    it('rejects files larger than 8 MB', () => {
      const result = PrescriptionFileSchema.safeParse({ size: 9 * 1024 * 1024, type: 'image/jpeg' });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/not exceed 8 MB/i);
    });

    it('rejects disallowed MIME types (e.g. PDF, executable, text)', () => {
      expect(PrescriptionFileSchema.safeParse({ size: 1024, type: 'application/pdf' }).success).toBe(false);
      expect(PrescriptionFileSchema.safeParse({ size: 1024, type: 'text/plain' }).success).toBe(false);
      expect(PrescriptionFileSchema.safeParse({ size: 1024, type: 'application/octet-stream' }).success).toBe(false);
    });
  });

  describe('POST /api/orders endpoint level validation', () => {
    it('returns HTTP 400 with field-level errors when coordinates are out of bounds', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockCustomer);

      const formData = new FormData();
      formData.append('addressText', 'Out of Bounds Address');
      formData.append('addressLat', '10.0000'); // Way outside Kolkata
      formData.append('addressLng', '88.4190');
      formData.append('paymentMethod', 'COD');
      const file = new File(['fake image bytes'], 'rx.jpg', { type: 'image/jpeg' });
      formData.append('prescription', file);

      const req = new Request('http://localhost/api/orders', {
        method: 'POST',
        body: formData,
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.fieldErrors?.addressLat).toBeDefined();
    });

    it('returns HTTP 400 when uploaded file exceeds 8 MB', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockCustomer);

      const formData = new FormData();
      formData.append('addressText', 'Salt Lake Sector 1, Kolkata');
      formData.append('addressLat', '22.5875');
      formData.append('addressLng', '88.4190');
      formData.append('paymentMethod', 'COD');
      // Oversized 9 MB file buffer
      const largeBuffer = Buffer.alloc(9 * 1024 * 1024);
      const largeFile = new File([largeBuffer], 'huge.jpg', { type: 'image/jpeg' });
      formData.append('prescription', largeFile);

      const req = new Request('http://localhost/api/orders', {
        method: 'POST',
        body: formData,
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/8 MB/i);
    });

    it('returns HTTP 400 when uploaded file format is not allowed', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockCustomer);

      const formData = new FormData();
      formData.append('addressText', 'Salt Lake Sector 1, Kolkata');
      formData.append('addressLat', '22.5875');
      formData.append('addressLng', '88.4190');
      formData.append('paymentMethod', 'COD');
      const pdfFile = new File(['%PDF-1.4...'], 'prescription.pdf', { type: 'application/pdf' });
      formData.append('prescription', pdfFile);

      const req = new Request('http://localhost/api/orders', {
        method: 'POST',
        body: formData,
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Allowed file formats/i);
    });
  });
});
