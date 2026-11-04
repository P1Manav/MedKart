// src/domain/order-state.ts
// Order state machine — single source of truth for all transitions

export const ORDER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ON_HOLD',
  'REJECTED',
  'APPROVED',
  'PACKED',
  'HANDED_OVER',
  'DELIVERED',
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
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'ON_HOLD', 'REJECTED', 'CANCELLED'],
  ON_HOLD: ['SUBMITTED', 'CANCELLED'],
  REJECTED: [],
  APPROVED: ['PACKED', 'CANCELLED'],
  PACKED: ['HANDED_OVER'],
  HANDED_OVER: ['DELIVERED'],
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
 * Returns all statuses reachable from the given status.
 */
export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Audit event shape for every state transition.
 */
export interface OrderAuditEvent {
  orderId: string;
  actorId: string;
  actorRole: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason?: string;
  timestamp: Date;
}

/**
 * Creates an audit event for a transition.
 */
export function createAuditEvent(
  orderId: string,
  actorId: string,
  actorRole: string,
  from: OrderStatus,
  to: OrderStatus,
  reason?: string
): OrderAuditEvent {
  return {
    orderId,
    actorId,
    actorRole,
    fromStatus: from,
    toStatus: to,
    reason,
    timestamp: new Date(),
  };
}

