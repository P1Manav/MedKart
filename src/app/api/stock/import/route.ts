// src/app/api/stock/import/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';

const StockRowSchema = z.object({
  store_id: z.string().min(1, 'store_id is required'),
  product_id: z.string().min(1, 'product_id is required'),
  quantity: z.coerce.number().int().min(0, 'quantity must be a non-negative integer'),
});

export async function POST(req: Request) {
  try {
    await requireAuth(['OPS']);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const commit = formData.get('commit') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or missing data rows.' }, { status: 400 });
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const storeIdx = headers.indexOf('store_id');
    const prodIdx = headers.indexOf('product_id');
    const qtyIdx = headers.indexOf('quantity');

    if (storeIdx === -1 || prodIdx === -1 || qtyIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must contain headers: store_id, product_id, quantity' },
        { status: 400 }
      );
    }

    const validRows: Array<{ store_id: string; product_id: string; quantity: number }> = [];
    const errors: Array<{ rowNumber: number; raw: string; error: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map((c) => c.trim());

      const rowData = {
        store_id: cols[storeIdx],
        product_id: cols[prodIdx],
        quantity: cols[qtyIdx],
      };

      const result = StockRowSchema.safeParse(rowData);
      if (result.success) {
        validRows.push(result.data);
      } else {
        errors.push({
          rowNumber: i + 1,
          raw: line,
          error: result.error.issues.map((iss) => iss.message).join('; '),
        });
      }
    }

    if (commit && errors.length === 0) {
      // All-or-nothing commit option
      await db.$transaction(
        validRows.map((r) =>
          db.storeStock.upsert({
            where: {
              storeId_productId: {
                storeId: r.store_id,
                productId: r.product_id,
              },
            },
            update: { quantity: r.quantity, lastUpdated: new Date() },
            create: {
              storeId: r.store_id,
              productId: r.product_id,
              quantity: r.quantity,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        committed: true,
        totalRows: lines.length - 1,
        validCount: validRows.length,
        errorCount: 0,
        errors: [],
      });
    }

    return NextResponse.json({
      success: errors.length === 0,
      committed: false,
      totalRows: lines.length - 1,
      validCount: validRows.length,
      errorCount: errors.length,
      errors,
      preview: validRows.slice(0, 10),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stock import failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
