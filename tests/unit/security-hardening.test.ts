// tests/unit/security-hardening.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateMagicBytes, stripExifGps } from '@/lib/validators/upload';
import { GET as healthHandler } from '@/app/api/health/route';
import { GET as productsHandler } from '@/app/api/products/route';
import { POST as handoverHandler } from '@/app/api/store/orders/[id]/handover/route';
import { POST as deliverHandler } from '@/app/api/store/orders/[id]/deliver/route';
import db from '@/lib/db';
import * as rbac from '@/lib/auth/rbac';
import * as sessionModule from '@/lib/auth/session';

describe('Security Hardening & Workflow Verification — Master Prompt v6', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Magic Byte File Validation (DPDP & OWASP)', () => {
    it('detects genuine PNG magic bytes (89 50 4E 47)', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const res = validateMagicBytes(pngBuffer);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe('image/png');
    });

    it('detects genuine JPEG magic bytes (FF D8 FF)', () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = validateMagicBytes(jpegBuffer);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe('image/jpeg');
    });

    it('detects genuine WebP magic bytes (RIFF ... WEBP)', () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const res = validateMagicBytes(webpBuffer);
      expect(res.valid).toBe(true);
      expect(res.detectedMime).toBe('image/webp');
    });

    it('rejects PDF or non-image documents (%PDF)', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
      const res = validateMagicBytes(pdfBuffer);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('do not match genuine image');
    });

    it('rejects executable scripts or disguised files', () => {
      const fakePng = Buffer.from('<?php echo "malicious"; ?>');
      const res = validateMagicBytes(fakePng);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('do not match genuine image');
    });
  });

  describe('EXIF & GPS Metadata Stripping', () => {
    it('strips APP1 (0xFFE1) EXIF segment from JPEG buffer', () => {
      // JPEG with SOI (FF D8), APP1 (FF E1, length 8, Exif), DQT (FF DB, length 4), SOS (FF DA)
      const fakeJpegWithExif = Buffer.from([
        0xff, 0xd8, // SOI
        0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 with Exif
        0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, // DQT
        0xff, 0xda, 0x00, 0x02, // SOS
      ]);

      const stripped = stripExifGps(fakeJpegWithExif);
      // Stripped buffer should NOT contain APP1 marker 0xff, 0xe1
      expect(stripped.indexOf(Buffer.from([0xff, 0xe1]))).toBe(-1);
      // Stripped buffer should still begin with SOI (FF D8)
      expect(stripped[0]).toBe(0xff);
      expect(stripped[1]).toBe(0xd8);
      // DQT and SOS remain intact
      expect(stripped.indexOf(Buffer.from([0xff, 0xdb]))).toBeGreaterThan(0);
    });
  });

  describe('Health Check API (/api/health)', () => {
    it('returns status UP (200) when database is reachable', async () => {
      vi.spyOn(db, '$queryRaw').mockResolvedValue([{ 1: 1 }] as never);

      const res = await healthHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('UP');
      expect(data.database.status).toBe('CONNECTED');
      expect(typeof data.uptimeSeconds).toBe('number');
    });

    it('returns status DOWN (503) when database is unreachable', async () => {
      vi.spyOn(db, '$queryRaw').mockRejectedValue(new Error('Connection terminated'));

      const res = await healthHandler();
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.status).toBe('DOWN');
      expect(data.database.status).toBe('DISCONNECTED');
    });
  });

  describe('Catalogue Protection: OTC Only Filter', () => {
    it('restricts results to OTC when otcOnly=true', async () => {
      vi.spyOn(sessionModule, 'getSession').mockResolvedValue(null);
      const findSpy = vi.spyOn(db.product, 'findMany').mockResolvedValue([]);
      vi.spyOn(db.scheduleRule, 'findMany').mockResolvedValue([]);

      const req = new Request('http://localhost:3000/api/products?otcOnly=true');
      const res = await productsHandler(req);
      expect(res.status).toBe(200);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schedule: 'OTC' }),
        })
      );
    });
  });

  describe('Store Handover Workflow: PACKED -> HANDED_OVER -> DELIVERED', () => {
    it('allows store staff to mark PACKED order as HANDED_OVER', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue({
        userId: 'staff_1',
        name: 'Staff Name',
        role: 'STORE_STAFF',
        storeId: 'store_salt_lake',
      } as never);

      vi.spyOn(db.order, 'findUnique').mockResolvedValue({
        id: 'ord_packed',
        displayId: 'RX-50230',
        status: 'PACKED',
        storeId: 'store_salt_lake',
        customerId: 'cust_1',
      } as never);

      const updateSpy = vi.fn().mockResolvedValue({});
      const auditSpy = vi.fn().mockResolvedValue({});
      const outboxSpy = vi.fn().mockResolvedValue({});

      vi.spyOn(db, '$transaction').mockImplementation((async (callback: (tx: unknown) => unknown) => {
        return callback({
          order: { update: updateSpy },
          orderAudit: { create: auditSpy },
          messageOutbox: { create: outboxSpy },
        });
      }) as never);

      const req = new Request('http://localhost:3000/api/store/orders/ord_packed/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerName: 'Shadowfax Courier', trackingId: 'SF-998877' }),
      });

      const res = await handoverHandler(req, { params: Promise.resolve({ id: 'ord_packed' }) });
      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'HANDED_OVER' } })
      );
    });

    it('allows delivery agent or customer to mark HANDED_OVER order as DELIVERED', async () => {
      vi.spyOn(rbac, 'requireAuth').mockResolvedValue({
        userId: 'cust_1',
        name: 'Debasish',
        role: 'CUSTOMER',
      } as never);

      vi.spyOn(db.order, 'findUnique').mockResolvedValue({
        id: 'ord_handed',
        displayId: 'RX-50230',
        status: 'HANDED_OVER',
        customerId: 'cust_1',
      } as never);

      const updateSpy = vi.fn().mockResolvedValue({});
      const auditSpy = vi.fn().mockResolvedValue({});
      const outboxSpy = vi.fn().mockResolvedValue({});

      vi.spyOn(db, '$transaction').mockImplementation((async (callback: (tx: unknown) => unknown) => {
        return callback({
          order: { update: updateSpy },
          orderAudit: { create: auditSpy },
          messageOutbox: { create: outboxSpy },
        });
      }) as never);

      const req = new Request('http://localhost:3000/api/store/orders/ord_handed/deliver', {
        method: 'POST',
      });

      const res = await deliverHandler(req, { params: Promise.resolve({ id: 'ord_handed' }) });
      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DELIVERED' } })
      );
    });
  });
});
