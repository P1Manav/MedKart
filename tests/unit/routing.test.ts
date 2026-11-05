// tests/unit/routing.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  haversineDistanceKm,
  routeOrderToStore,
  type StoreStockItem,
  type OrderItemRequirement,
} from '@/domain/routing';

describe('Store Routing & Haversine Distance', () => {
  it('accurately computes distance between Kolkata locations', () => {
    // Salt Lake CF-32 (22.5867, 88.4172) to Behala Chowrasta (22.4988, 88.3190) is ~14 km
    const dist = haversineDistanceKm(
      { lat: 22.5867, lng: 88.4172 },
      { lat: 22.4988, lng: 88.3190 }
    );
    expect(dist).toBeGreaterThan(12);
    expect(dist).toBeLessThan(16);
  });

  const mockStores: StoreStockItem[] = [
    {
      storeId: 'store_saltlake',
      storeName: 'Salt Lake Store',
      lat: 22.5867,
      lng: 88.4172,
      active: true,
      stock: {
        prod_metformin: 50,
        prod_telmisartan: 30,
      },
    },
    {
      storeId: 'store_behala',
      storeName: 'Behala Store',
      lat: 22.4988,
      lng: 88.3190,
      active: true,
      stock: {
        prod_metformin: 20,
        prod_telmisartan: 0, // Behala is OUT of telmisartan!
      },
    },
    {
      storeId: 'store_howrah',
      storeName: 'Howrah Store',
      lat: 22.5892,
      lng: 88.3245,
      active: true,
      stock: {
        prod_metformin: 100,
        prod_telmisartan: 100,
      },
    },
  ];

  it('routes to nearest store when it has full stock', () => {
    // Customer near Salt Lake
    const customerLoc = { lat: 22.5870, lng: 88.4180 };
    const items: OrderItemRequirement[] = [
      { productId: 'prod_metformin', quantity: 2 },
    ];

    const decision = routeOrderToStore(customerLoc, mockStores, items);
    expect(decision.assignedStoreId).toBe('store_saltlake');
    expect(decision.isFullCoverage).toBe(true);
    expect(decision.missingLines).toHaveLength(0);
  });

  it('routes to alternative store when nearest has stock deficit (deliberate gap)', () => {
    // Customer near Behala ordering Telmisartan (which Behala has 0 of)
    const customerLoc = { lat: 22.4990, lng: 88.3180 }; // Very close to Behala
    const items: OrderItemRequirement[] = [
      { productId: 'prod_telmisartan', quantity: 2 },
    ];

    const decision = routeOrderToStore(customerLoc, mockStores, items);
    // Behala cannot cover this item, so full-coverage store (Howrah or Salt Lake) must be selected
    expect(decision.isFullCoverage).toBe(true);
    expect(decision.assignedStoreId).not.toBe('store_behala');
  });

  it('falls back to partial coverage store and flags missing lines with next-nearest alternative', () => {
    // Stores where no single store can fulfill all items
    const limitedStores: StoreStockItem[] = [
      {
        storeId: 'store_A',
        storeName: 'Store A',
        lat: 22.58,
        lng: 88.40,
        active: true,
        stock: { prod_1: 10, prod_2: 0 },
      },
      {
        storeId: 'store_B',
        storeName: 'Store B',
        lat: 22.50,
        lng: 88.30,
        active: true,
        stock: { prod_1: 0, prod_2: 10 },
      },
    ];

    const customerLoc = { lat: 22.58, lng: 88.40 };
    const items: OrderItemRequirement[] = [
      { productId: 'prod_1', quantity: 1 },
      { productId: 'prod_2', quantity: 1 },
    ];

    const decision = routeOrderToStore(customerLoc, limitedStores, items);
    expect(decision.isFullCoverage).toBe(false);
    expect(decision.assignedStoreId).toBe('store_A'); // Nearest partial
    expect(decision.missingLines).toHaveLength(1);
    expect(decision.missingLines[0].productId).toBe('prod_2');
    expect(decision.missingLines[0].alternativeStoreId).toBe('store_B');
  });

  it('throws an explicit error when no active stores exist (no silent fake routing)', () => {
    const customerLoc = { lat: 22.58, lng: 88.40 };
    const items: OrderItemRequirement[] = [{ productId: 'prod_1', quantity: 1 }];
    expect(() => routeOrderToStore(customerLoc, [], items)).toThrow(
      /No active pharmacy stores available for routing/i
    );
  });

  it('assigns storeId = null and sets routingIssue when order creation has no stocked stores', async () => {
    const { POST: createOrderHandler } = await import('@/app/api/orders/route');
    const rbac = await import('@/lib/auth/rbac');
    const db = (await import('@/lib/db')).default;
    const aiModule = await import('@/lib/ai');

    vi.spyOn(aiModule, 'getPrescriptionReader').mockReturnValue({
      read: vi.fn().mockResolvedValue({
        success: true,
        modelName: 'mock-reader',
        latencyMs: 1,
        manualEntryNeeded: false,
        data: {
          image_legibility: 'clear',
          prescriber_text: 'Dr. Test',
          date_text: '2026-11-04',
          lines: [],
        },
      }),
    });

    vi.spyOn(rbac, 'requireAuth').mockResolvedValue({
      userId: 'cust_routing_test',
      phone: '9830011111',
      role: 'CUSTOMER',
      name: 'Test Customer',
    });

    // Active product in cart
    vi.spyOn(db.product, 'findMany').mockResolvedValue([
      {
        id: 'prod_1',
        name: 'Metformin',
        strength: '500mg',
        form: 'Tablet',
        price: 30,
        schedule: 'H',
        packSize: '10',
        active: true,
        genericGroupId: null,
        createdAt: new Date(),
      },
    ]);

    // Zero active stores
    vi.spyOn(db.store, 'findMany').mockResolvedValue([]);
    vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([
      {
        schedule: 'H',
        canSellOnline: true,
        requiresPrescription: true,
        requiresPharmacistApproval: true,
        requiresRegisterEntry: false,
      },
    ]);
    vi.spyOn(db.messageOutbox, 'create').mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof db.messageOutbox.create>>
    );

    let createdOrderData: Record<string, unknown> | null = null;
    vi.spyOn(db.order, 'create').mockImplementation(((args: { data: Record<string, unknown> }) => {
      createdOrderData = args.data;
      return Promise.resolve({
        id: 'ord_routed_null',
        displayId: 'RX-99999',
        status: 'SUBMITTED',
        storeId: createdOrderData.storeId,
        routingIssue: createdOrderData.routingIssue,
        manualEntryNeeded: false,
        lines: [],
      });
    }) as unknown as typeof db.order.create);

    const formData = new FormData();
    formData.append('addressText', 'Salt Lake, Kolkata');
    formData.append('addressLat', '22.5875');
    formData.append('addressLng', '88.4190');
    formData.append('paymentMethod', 'COD');
    formData.append('cartItems', JSON.stringify([{ productId: 'prod_1', quantity: 1 }]));
    const realJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    formData.append('prescription', new File([realJpegBytes], 'rx.jpg', { type: 'image/jpeg' }));

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      body: formData,
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.storeId).toBeNull();
    expect(body.order.routingIssue).toMatch(/No active stores available/i);
    expect(createdOrderData!.storeId).toBeNull();
    expect(createdOrderData!.routingIssue).toMatch(/No active stores available/i);
  }, 15000);
});

