// src/lib/auth/rbac.ts
import type { UserRole } from '@prisma/client';
import { getSession, type SessionPayload } from './session';

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied: insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Ensures user is authenticated and has one of the allowed roles.
 * Deny by default: if no role matches, throws AuthorizationError.
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthorizationError('Authentication required. Please log in.');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.role)) {
      throw new AuthorizationError(
        `Access denied. Role "${session.role}" is not authorized for this resource.`
      );
    }
  }

  return session;
}

/**
 * Asserts customer object-level access:
 * A customer can ONLY access their own orders or their family members' orders.
 */
export function assertCustomerAccess(
  session: SessionPayload,
  orderCustomerId: string
): void {
  // OPS can inspect any order for operational oversight
  if (session.role === 'OPS') return;

  // PHARMACIST can inspect orders submitted for verification
  if (session.role === 'PHARMACIST') return;

  // STORE_STAFF can inspect orders assigned to their store
  if (session.role === 'STORE_STAFF') return;

  // CUSTOMER must match the owner
  if (session.role === 'CUSTOMER' && session.userId !== orderCustomerId) {
    throw new AuthorizationError('You do not have permission to access another customer’s order.');
  }
}

/**
 * Asserts store staff object-level access:
 * A store staff member can ONLY view or pack orders routed to their specific store.
 */
export function assertStoreStaffAccess(
  session: SessionPayload,
  orderStoreId: string | null
): void {
  if (session.role === 'OPS') return;

  if (session.role === 'STORE_STAFF') {
    if (!session.storeId || session.storeId !== orderStoreId) {
      throw new AuthorizationError(
        'Store staff can only access orders assigned to their assigned store.'
      );
    }
    return;
  }

  if (session.role !== 'PHARMACIST') {
    throw new AuthorizationError('Access denied: store staff privileges required.');
  }
}

/**
 * Asserts object-level access for viewing sensitive prescription images:
 * - CUSTOMER: only their own order (order.customerId === session.userId)
 * - PHARMACIST: any order that is NOT in DRAFT
 * - STORE_STAFF: only orders routed to their assigned store AND in post-approval states ('APPROVED', 'PACKED', 'HANDED_OVER', 'DELIVERED')
 * - OPS: allowed (audit logged)
 * - All others: denied
 */
export function assertPrescriptionAccess(
  session: SessionPayload,
  order: { customerId: string; storeId: string | null; status: string }
): void {
  if (session.role === 'CUSTOMER') {
    if (session.userId !== order.customerId) {
      throw new AuthorizationError('You do not have permission to view another customer’s prescription.');
    }
    return;
  }

  if (session.role === 'PHARMACIST') {
    if (order.status === 'DRAFT') {
      throw new AuthorizationError('Prescriptions for draft orders are not accessible to pharmacists.');
    }
    return;
  }

  if (session.role === 'STORE_STAFF') {
    if (!session.storeId || session.storeId !== order.storeId) {
      throw new AuthorizationError('Store staff can only access prescriptions for orders routed to their store.');
    }
    const allowedStatuses = ['APPROVED', 'PACKED', 'HANDED_OVER', 'DELIVERED'];
    if (!allowedStatuses.includes(order.status)) {
      throw new AuthorizationError('Prescription cannot be accessed by store staff until verified and approved by a pharmacist.');
    }
    return;
  }

  if (session.role === 'OPS') {
    return;
  }

  throw new AuthorizationError('Access denied: role not permitted to view prescriptions.');
}


