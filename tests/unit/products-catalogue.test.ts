// tests/unit/products-catalogue.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/products/route';
import db from '@/lib/db';

interface CatalogueProductItem {
  id: string;
  name: string;
  strength: string;
  form: string;
  packSize: string;
  price: number;
  schedule: string;
  genericGroupId: string | null;
  canSellOnline: boolean;
  requiresPrescription: boolean;
}

vi.mock('@/lib/db', () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
    scheduleRule: {
      findMany: vi.fn(),
    },
  },
}));

describe('Products Catalogue API (Spec Screen 3 & §5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/products enriches products with schedule rule flags', async () => {
    const mockProducts = [
      {
        id: 'prod_1',
        name: 'Metformin 500 mg',
        strength: '500 mg',
        form: 'Tablet',
        packSize: 'Strip of 15',
        price: 30,
        schedule: 'H',
        genericGroupId: null,
      },
      {
        id: 'prod_2',
        name: 'Diazepam 5 mg',
        strength: '5 mg',
        form: 'Tablet',
        packSize: 'Strip of 10',
        price: 80,
        schedule: 'X',
        genericGroupId: null,
      },
    ];

    const mockRules = [
      { schedule: 'H', canSellOnline: true, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
      { schedule: 'X', canSellOnline: false, requiresPrescription: true, requiresPharmacistApproval: true, requiresRegisterEntry: false },
    ];

    vi.mocked(db.product.findMany).mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof db.product.findMany>>);
    vi.mocked(db.scheduleRule.findMany).mockResolvedValueOnce(mockRules as unknown as Awaited<ReturnType<typeof db.scheduleRule.findMany>>);

    const req = new Request('http://localhost/api/products');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.products).toHaveLength(2);

    // Metformin (Schedule H) is sellable online but requires prescription
    const metformin = data.products.find((p: CatalogueProductItem) => p.id === 'prod_1');
    expect(metformin.canSellOnline).toBe(true);
    expect(metformin.requiresPrescription).toBe(true);

    // Diazepam (Schedule X) is NOT sellable online
    const diazepam = data.products.find((p: CatalogueProductItem) => p.id === 'prod_2');
    expect(diazepam.canSellOnline).toBe(false);
  });
});
