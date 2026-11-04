// src/app/api/stock/import/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { validateStockCsv } from '@/lib/validators/stock-csv';

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
    const validation = validateStockCsv(text);

    if (commit && validation.valid) {
      // All-or-nothing commit option
      await db.$transaction(
        validation.validRows.map((r) =>
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
        totalRows: validation.totalRows,
        validCount: validation.validRows.length,
        errorCount: 0,
        errors: [],
      });
    }

    return NextResponse.json({
      success: validation.valid,
      committed: false,
      totalRows: validation.totalRows,
      validCount: validation.validRows.length,
      errorCount: validation.errors.length,
      errors: validation.errors,
      preview: validation.validRows.slice(0, 10),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stock import failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

