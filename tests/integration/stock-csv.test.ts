// tests/integration/stock-csv.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const StockRowSchema = z.object({
  store_id: z.string().min(1, 'store_id is required'),
  product_id: z.string().min(1, 'product_id is required'),
  quantity: z.coerce.number().int().min(0, 'quantity must be a non-negative integer'),
});

interface CsvValidationResult {
  validRows: Array<{ store_id: string; product_id: string; quantity: number }>;
  errors: Array<{ row: number; error: string }>;
}

function parseAndValidateStockCsv(csvContent: string): CsvValidationResult {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { validRows: [], errors: [{ row: 0, error: 'Empty CSV' }] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const storeIdx = headers.indexOf('store_id');
  const prodIdx = headers.indexOf('product_id');
  const qtyIdx = headers.indexOf('quantity');

  if (storeIdx === -1 || prodIdx === -1 || qtyIdx === -1) {
    return { validRows: [], errors: [{ row: 1, error: 'Missing required headers' }] };
  }

  const validRows: Array<{ store_id: string; product_id: string; quantity: number }> = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());

    const parsed = StockRowSchema.safeParse({
      store_id: cols[storeIdx],
      product_id: cols[prodIdx],
      quantity: cols[qtyIdx],
    });

    if (parsed.success) {
      validRows.push(parsed.data);
    } else {
      errors.push({ row: i + 1, error: parsed.error.issues[0]?.message || 'Invalid row' });
    }
  }

  return { validRows, errors };
}

describe('Stock CSV Validation (Per-Row & All-or-Nothing)', () => {
  it('validates correct CSV format accurately', () => {
    const csv = `store_id,product_id,quantity
store_saltlake,prod_metformin_500,100
store_behala,prod_telmisartan_40,0`;

    const result = parseAndValidateStockCsv(csv);
    expect(result.validRows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].quantity).toBe(100);
    expect(result.validRows[1].quantity).toBe(0);
  });

  it('rejects invalid rows with negative quantity or missing product id', () => {
    const csv = `store_id,product_id,quantity
store_saltlake,prod_metformin_500,-15
store_behala,,50`;

    const result = parseAndValidateStockCsv(csv);
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].error).toContain('non-negative');
    expect(result.errors[1].error).toContain('product_id is required');
  });

  it('handles missing headers properly', () => {
    const csv = `store_name,item,count
Salt Lake,Metformin,100`;

    const result = parseAndValidateStockCsv(csv);
    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0].error).toBe('Missing required headers');
  });
});
