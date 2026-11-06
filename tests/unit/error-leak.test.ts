// tests/unit/error-leak.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApiError } from '@/lib/api-error';
import { z } from 'zod';
import { AuthorizationError } from '@/lib/auth/rbac';

// Mock DB
vi.mock('@/lib/db', () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
    scheduleRule: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// Mock logger to prevent cluttering test output
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  redactString: vi.fn((s: string) => s),
}));

describe('Task 4: Error Handling & Information Leak Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleApiError centralized sanitization', () => {
    it('never leaks stack traces, SQL syntax, or DB errors in 500 responses', async () => {
      const sensitiveErrors = [
        new Error('SELECT * FROM "User" WHERE id = \'xyz\' failed: syntax error at or near "SELECT"'),
        new Error('PrismaClientInitializationError: Can\'t reach database server at postgres://user:secret123@neon.tech'),
        new Error('FATAL: password authentication failed for user "medkart_admin"'),
        new Error('Unhandled exception: NullReferenceException at Line 42 in /app/secret-logic.ts'),
      ];

      for (const rawErr of sensitiveErrors) {
        const response = handleApiError(rawErr, 'test/route');
        expect(response.status).toBe(500);

        const body = await response.json();
        expect(body).toHaveProperty('error', 'Something went wrong');
        expect(body).toHaveProperty('errorId');
        expect(body.errorId).toMatch(/^err_\d+_[a-f0-9]+$/);
        expect(body).not.toHaveProperty('stack');

        const rawStringified = JSON.stringify(body);
        expect(rawStringified).not.toContain('SELECT');
        expect(rawStringified).not.toContain('password');
        expect(rawStringified).not.toContain('secret123');
        expect(rawStringified).not.toContain('postgres://');
        expect(rawStringified).not.toContain('NullReferenceException');
        expect(rawStringified).not.toContain('/app/secret-logic.ts');
      }
    });

    it('safely formats Zod validation errors without leaking internal code structure', async () => {
      const schema = z.object({
        email: z.string().email('Invalid email address'),
        age: z.number().min(18, 'Must be at least 18'),
      });

      try {
        schema.parse({ email: 'not-an-email', age: 12 });
      } catch (err) {
        const response = handleApiError(err, 'test/validation');
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toBeDefined();
        expect(body.fieldErrors).toBeDefined();
        expect(body.fieldErrors['email']).toContain('Invalid email address');
        expect(body.fieldErrors['age']).toContain('Must be at least 18');
        expect(body).not.toHaveProperty('stack');
      }
    });

    it('maps authentication errors to 401 and authorization errors to 403', async () => {
      const authRequired = new AuthorizationError('Authentication required. Please log in.');
      const res401 = handleApiError(authRequired, 'test/auth');
      expect(res401.status).toBe(401);
      const body401 = await res401.json();
      expect(body401.error).toContain('Unauthorized');

      const roleForbidden = new AuthorizationError('Access denied: store staff privileges required.');
      const res403 = handleApiError(roleForbidden, 'test/rbac');
      expect(res403.status).toBe(403);
      const body403 = await res403.json();
      expect(body403.error).toContain('Access denied');
    });
  });

  describe('Public Route Handlers Under Database Failures', () => {
    it('/api/products sanitizes error when database crashes', async () => {
      const db = (await import('@/lib/db')).default;
      vi.mocked(db.product.findMany).mockRejectedValueOnce(
        new Error('SQLSTATE 42P01: relation "Product" does not exist (SELECT * FROM "Product")')
      );

      const { GET } = await import('@/app/api/products/route');
      const req = new Request('http://localhost:3000/api/products');
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Something went wrong');
      expect(data).toHaveProperty('errorId');
      expect(JSON.stringify(data)).not.toContain('SQLSTATE');
      expect(JSON.stringify(data)).not.toContain('relation');
      expect(JSON.stringify(data)).not.toContain('SELECT');
    });

    it('/api/payments/config sanitizes error when config resolution throws', async () => {
      const upiMod = await import('@/lib/payments/upi-config');
      const spy = vi.spyOn(upiMod, 'getUpiConfig').mockImplementationOnce(() => {
        throw new Error('Secret decryption key failure in /etc/crypto/master.key');
      });

      const { GET } = await import('@/app/api/payments/config/route');
      const res = await GET();

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Something went wrong');
      expect(data).toHaveProperty('errorId');
      expect(JSON.stringify(data)).not.toContain('/etc/crypto/master.key');

      spy.mockRestore();
    });
  });
});
