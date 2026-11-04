// src/domain/routing.ts
// Store routing based on haversine distance and real inventory coverage

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StoreStockItem {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  active: boolean;
  stock: Record<string, number>; // productId -> quantity
}

export interface OrderItemRequirement {
  productId: string;
  quantity: number;
}

export interface StoreCoverageResult {
  storeId: string;
  storeName: string;
  distanceKm: number;
  coveredLines: number;
  totalLines: number;
  isFullCoverage: boolean;
  missingItems: Array<{
    productId: string;
    requested: number;
    available: number;
  }>;
}

export interface RoutingDecision {
  assignedStoreId: string;
  assignedStoreName: string;
  isFullCoverage: boolean;
  distanceKm: number;
  allLinesCovered: boolean;
  missingLines: Array<{
    productId: string;
    requested: number;
    availableAtAssigned: number;
    alternativeStoreId?: string;
    alternativeStoreName?: string;
    alternativeDistanceKm?: number;
  }>;
}

/**
 * Calculates the great-circle distance between two geographic points in kilometers
 * using the Haversine formula (ASSUMPTION A8).
 */
export function haversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // 2 decimal places
}

/**
 * Evaluate inventory coverage for a specific store.
 */
export function evaluateStoreCoverage(
  customerLoc: GeoPoint,
  store: StoreStockItem,
  requirements: OrderItemRequirement[]
): StoreCoverageResult {
  const distanceKm = haversineDistanceKm(customerLoc, { lat: store.lat, lng: store.lng });
  const missingItems: StoreCoverageResult['missingItems'] = [];
  let coveredCount = 0;

  for (const req of requirements) {
    const available = store.stock[req.productId] || 0;
    if (available >= req.quantity) {
      coveredCount++;
    } else {
      missingItems.push({
        productId: req.productId,
        requested: req.quantity,
        available,
      });
    }
  }

  return {
    storeId: store.storeId,
    storeName: store.storeName,
    distanceKm,
    coveredLines: coveredCount,
    totalLines: requirements.length,
    isFullCoverage: missingItems.length === 0,
    missingItems,
  };
}

/**
 * Routing logic:
 * 1. Filter active stores.
 * 2. Evaluate coverage for each store.
 * 3. Find stores with full coverage, sort by distance ascending -> pick nearest full-coverage store.
 * 4. Fallback: If no store has full coverage, pick the store with maximum covered lines,
 *    breaking ties with distance -> flag missing lines and search next-nearest store for missing items.
 */
export function routeOrderToStore(
  customerLoc: GeoPoint,
  stores: StoreStockItem[],
  requirements: OrderItemRequirement[]
): RoutingDecision {
  const activeStores = stores.filter((s) => s.active);

  if (activeStores.length === 0) {
    throw new Error('No active pharmacy stores available for routing.');
  }

  const evaluations = activeStores.map((store) =>
    evaluateStoreCoverage(customerLoc, store, requirements)
  );

  // Stores that have 100% stock
  const fullCoverageStores = evaluations
    .filter((e) => e.isFullCoverage)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (fullCoverageStores.length > 0) {
    const best = fullCoverageStores[0];
    return {
      assignedStoreId: best.storeId,
      assignedStoreName: best.storeName,
      isFullCoverage: true,
      distanceKm: best.distanceKm,
      allLinesCovered: true,
      missingLines: [],
    };
  }

  // Fallback: sort by covered lines desc, then distance asc
  const partialStores = [...evaluations].sort((a, b) => {
    if (b.coveredLines !== a.coveredLines) {
      return b.coveredLines - a.coveredLines;
    }
    return a.distanceKm - b.distanceKm;
  });

  const bestPartial = partialStores[0];

  // For each missing item, find next nearest store that has it
  const missingWithAlternatives = bestPartial.missingItems.map((missing) => {
    const altStoresWithStock = stores
      .filter((s) => s.active && s.storeId !== bestPartial.storeId)
      .filter((s) => (s.stock[missing.productId] || 0) >= missing.requested)
      .map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        distanceKm: haversineDistanceKm(customerLoc, { lat: s.lat, lng: s.lng }),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearestAlt = altStoresWithStock[0];

    return {
      productId: missing.productId,
      requested: missing.requested,
      availableAtAssigned: missing.available,
      alternativeStoreId: nearestAlt?.storeId,
      alternativeStoreName: nearestAlt?.storeName,
      alternativeDistanceKm: nearestAlt?.distanceKm,
    };
  });

  return {
    assignedStoreId: bestPartial.storeId,
    assignedStoreName: bestPartial.storeName,
    isFullCoverage: false,
    distanceKm: bestPartial.distanceKm,
    allLinesCovered: false,
    missingLines: missingWithAlternatives,
  };
}
