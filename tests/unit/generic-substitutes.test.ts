// tests/unit/generic-substitutes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getOrderHandler } from '@/app/api/orders/[id]/route';
import * as rbac from '@/lib/auth/rbac';
import db from '@/lib/db';

describe('Real Generic Substitute Suggestions (P0-5, Fix #5)', () => {
  const mockPharmacist = {
    userId: 'pharm_1',
    phone: '9830044444',
    role: 'PHARMACIST' as const,
    name: 'Sunita Pharmacist',
    pharmacistRegNo: 'WB-PHARM-2024-54321',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns real matched GenericSubstitute with accurate price difference for brand product', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockPharmacist);

    const mockBrandOrder = {
      id: 'ord_brand_test',
      displayId: 'RX-50230',
      customerId: 'cust_1',
      status: 'SUBMITTED',
      lines: [
        {
          id: 'line_brand_1',
          productId: 'prod_rosuvastatin_brand',
          rawText: 'Rosuvastatin Brand 10mg',
          aiDrugName: 'Rosuvastatin',
          aiStrength: '10 mg',
          aiConfidence: 0.95,
          lineStatus: 'PENDING',
          quantity: 1,
          unitPrice: 180,
          needsReview: true,
          rejectReason: null,
          pharmacistId: null,
          pharmacistRegNo: null,
          customerConsentGeneric: false,
          product: {
            id: 'prod_rosuvastatin_brand',
            name: 'Rosuvastatin (Brand)',
            strength: '10 mg',
            form: 'Tablet',
            schedule: 'H',
            price: 180,
            packSize: 'Strip of 10',
            genericOriginals: [
              {
                id: 'gen_sub_1',
                genericProduct: {
                  id: 'prod_rosuvastatin_generic',
                  name: 'Rosuvastatin (Generic)',
                  strength: '10 mg',
                  form: 'Tablet',
                  price: 65,
                  packSize: 'Strip of 10',
                },
              },
            ],
          },
        },
      ],
      auditEvents: [],
      customer: { id: 'cust_1', name: 'Patient A', phone: '9830011111' },
      store: null,
      familyProfile: null,
    };

    vi.spyOn(db.order, 'findUnique').mockResolvedValue(
      mockBrandOrder as unknown as Awaited<ReturnType<typeof db.order.findUnique>>
    );

    const req = new Request('http://localhost/api/orders/ord_brand_test');
    const res = await getOrderHandler(req, { params: Promise.resolve({ id: 'ord_brand_test' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    const line = body.order.lines[0];
    const genericSub = line.product.genericOriginals[0]?.genericProduct;

    expect(genericSub).toBeDefined();
    expect(genericSub.name).toBe('Rosuvastatin (Generic)');
    expect(genericSub.price).toBe(65);
    expect(line.product.price - genericSub.price).toBe(115);
  });

  it('returns empty genericOriginals array for product with no seeded generic substitute', async () => {
    vi.spyOn(rbac, 'requireAuth').mockResolvedValue(mockPharmacist);

    const mockStandardOrder = {
      id: 'ord_standard_test',
      displayId: 'RX-50231',
      customerId: 'cust_1',
      status: 'SUBMITTED',
      lines: [
        {
          id: 'line_standard_1',
          productId: 'prod_metformin_500',
          rawText: 'Metformin 500mg',
          aiDrugName: 'Metformin',
          aiStrength: '500 mg',
          aiConfidence: 0.98,
          lineStatus: 'PENDING',
          quantity: 2,
          unitPrice: 30,
          needsReview: false,
          rejectReason: null,
          pharmacistId: null,
          pharmacistRegNo: null,
          customerConsentGeneric: false,
          product: {
            id: 'prod_metformin_500',
            name: 'Metformin 500 mg',
            strength: '500 mg',
            form: 'Tablet',
            schedule: 'H',
            price: 30,
            packSize: 'Strip of 15',
            genericOriginals: [], // No generic substitute seeded
          },
        },
      ],
      auditEvents: [],
      customer: { id: 'cust_1', name: 'Patient B', phone: '9830022222' },
      store: null,
      familyProfile: null,
    };

    vi.spyOn(db.order, 'findUnique').mockResolvedValue(
      mockStandardOrder as unknown as Awaited<ReturnType<typeof db.order.findUnique>>
    );

    const req = new Request('http://localhost/api/orders/ord_standard_test');
    const res = await getOrderHandler(req, { params: Promise.resolve({ id: 'ord_standard_test' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    const line = body.order.lines[0];
    expect(line.product.genericOriginals).toEqual([]);
  });
});
