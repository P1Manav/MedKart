// src/domain/order-state.ts
// Order state machine — single source of truth for all transitions

export const ORDER_STATUSES = [
  'DRAFT',
  'PAYMENT_PENDING_VERIFICATION',
  'SUBMITTED',
  'ON_HOLD',
  'REJECTED',
  'APPROVED',
  'PACKED',
  'HANDED_OVER',
  'DELIVERED',
  'REFUND_DUE',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LINE_STATUSES = [
  'PENDING',
  'APPROVED',
  'EDITED_APPROVED',
  'REJECTED',
  'BLOCKED_NOT_SOLD_ONLINE',
] as const;

export type LineStatus = (typeof LINE_STATUSES)[number];

/**
 * Transition table: from → allowed to statuses.
 * Any transition not listed here is illegal and will throw.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'PAYMENT_PENDING_VERIFICATION', 'CANCELLED'],
  PAYMENT_PENDING_VERIFICATION: ['SUBMITTED', 'CANCELLED', 'REFUND_DUE'],
  SUBMITTED: ['APPROVED', 'ON_HOLD', 'REJECTED', 'CANCELLED', 'REFUND_DUE'],
  ON_HOLD: ['SUBMITTED', 'CANCELLED', 'REFUND_DUE'],
  REJECTED: [],
  APPROVED: ['PACKED', 'CANCELLED', 'REFUND_DUE'],
  PACKED: ['HANDED_OVER'],
  HANDED_OVER: ['DELIVERED'],
  REFUND_DUE: ['CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus
  ) {
    super(`Illegal order transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

/**
 * Validates and returns the target status if the transition is legal.
 * Throws IllegalTransitionError otherwise.
 */
export function validateTransition(from: OrderStatus, to: OrderStatus): OrderStatus {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
  return to;
}

/**
 * Returns the list of valid next statuses for a given status.
 */
export function allowedTransitions(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status] ?? [];
}

/**
 * Creates an audit event payload for an order status transition.
 */
export function createAuditEvent(
  orderId: string,
  actorId: string,
  actorRole: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  reason?: string
) {
  return {
    orderId,
    actorId,
    actorRole,
    fromStatus,
    toStatus,
    reason: reason ?? null,
    timestamp: new Date(),
  };
}
