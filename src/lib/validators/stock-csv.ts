// src/lib/validators/stock-csv.ts
// Daily stock CSV format and row-level validator (ASSUMPTION A9)

import { z } from 'zod';

export const StockRowSchema = z.object({
  store_id: z.string().min(1, 'store_id is required'),
  product_id: z.string().min(1, 'product_id is required'),
  quantity: z.coerce.number().int().min(0, 'quantity must be a non-negative integer'),
});

export type StockRow = z.infer<typeof StockRowSchema>;

export interface CsvValidationRowError {
  rowNumber: number;
  raw: string;
  error: string;
}

export interface CsvValidationResult {
  valid: boolean;
  validRows: StockRow[];
  errors: CsvValidationRowError[];
  totalRows: number;
}

/**
 * Validates daily stock CSV contents line by line.
 */
export function validateStockCsv(csvText: string): CsvValidationResult {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return {
      valid: false,
      validRows: [],
      errors: [{ rowNumber: 0, raw: '', error: 'CSV file is empty or missing data rows' }],
      totalRows: 0,
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const storeIdx = headers.indexOf('store_id');
  const prodIdx = headers.indexOf('product_id');
  const qtyIdx = headers.indexOf('quantity');

  if (storeIdx === -1 || prodIdx === -1 || qtyIdx === -1) {
    return {
      valid: false,
      validRows: [],
      errors: [
        {
          rowNumber: 1,
          raw: lines[0],
          error: 'Missing required headers: store_id, product_id, quantity',
        },
      ],
      totalRows: 0,
    };
  }

  const validRows: StockRow[] = [];
  const errors: CsvValidationRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = rawLine.split(',').map((c) => c.trim());
    const parsed = StockRowSchema.safeParse({
      store_id: cols[storeIdx],
      product_id: cols[prodIdx],
      quantity: cols[qtyIdx],
    });

    if (parsed.success) {
      validRows.push(parsed.data);
    } else {
      errors.push({
        rowNumber: i + 1,
        raw: rawLine,
        error: parsed.error.issues.map((iss) => iss.message).join('; '),
      });
    }
  }

  return {
    valid: errors.length === 0,
    validRows,
    errors,
    totalRows: lines.length - 1,
  };
}
