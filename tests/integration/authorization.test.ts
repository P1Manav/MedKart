// tests/integration/authorization.test.ts
import { describe, it, expect } from 'vitest';
import {
  assertCustomerAccess,
  assertStoreStaffAccess,
  AuthorizationError,
} from '@/lib/auth/rbac';
import type { SessionPayload } from '@/lib/auth/session';

describe('Role-Based Access Control & Object-Level Guards', () => {
  const customerA: SessionPayload = {
    userId: 'user_customer_A',
    phone: '9830011111',
    role: 'CUSTOMER',
    name: 'Debasish Ghosh',
  };

  const _customerB: SessionPayload = {
    userId: 'user_customer_B',
    phone: '9830022222',
    role: 'CUSTOMER',
    name: 'Rina Sen',
  };

  const pharmacist: SessionPayload = {
    userId: 'user_pharmacist',
    phone: '9830044444',
    role: 'PHARMACIST',
    name: 'Sunita Banerjee',
    pharmacistRegNo: 'WB-PHARM-2024-4102',
  };

  const storeStaffSaltLake: SessionPayload = {
    userId: 'user_staff_sl',
    phone: '9830066661',
    role: 'STORE_STAFF',
    name: 'Bikash Das',
    storeId: 'store_saltlake',
  };

  const opsUser: SessionPayload = {
    userId: 'user_ops',
    phone: '9830099999',
    role: 'OPS',
    name: 'Anirban Sen',
  };

  describe('Customer Object-Level Isolation', () => {
    it('allows customer to access their own order', () => {
      expect(() => {
        assertCustomerAccess(customerA, 'user_customer_A');
      }).not.toThrow();
    });

    it('strictly forbids customer A from accessing customer B’s order', () => {
      expect(() => {
        assertCustomerAccess(customerA, 'user_customer_B');
      }).toThrow(AuthorizationError);
    });

    it('allows pharmacist and ops to access customer orders for verification', () => {
      expect(() => {
        assertCustomerAccess(pharmacist, 'user_customer_A');
      }).not.toThrow();

      expect(() => {
        assertCustomerAccess(opsUser, 'user_customer_A');
      }).not.toThrow();
    });
  });

  describe('Store Staff Object-Level Isolation', () => {
    it('allows store staff to access orders assigned to their store', () => {
      expect(() => {
        assertStoreStaffAccess(storeStaffSaltLake, 'store_saltlake');
      }).not.toThrow();
    });

    it('forbids store staff from accessing orders assigned to other stores', () => {
      expect(() => {
        assertStoreStaffAccess(storeStaffSaltLake, 'store_behala');
      }).toThrow(AuthorizationError);
    });

    it('allows ops and pharmacist privileges', () => {
      expect(() => {
        assertStoreStaffAccess(opsUser, 'store_behala');
      }).not.toThrow();

      expect(() => {
        assertStoreStaffAccess(pharmacist, 'store_behala');
      }).not.toThrow();
    });
  });
});
