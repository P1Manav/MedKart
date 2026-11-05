// src/lib/payments/upi-config.ts

export interface UpiPaymentConfig {
  enabled: boolean;
  payeeVpa: string | null;
  payeeName: string;
  maxAmountInr: number;
}

export function getUpiConfig(): UpiPaymentConfig {
  const payeeVpa = process.env.UPI_PAYEE_VPA?.trim() || null;
  const payeeName = process.env.UPI_PAYEE_NAME?.trim() || 'MedKart Demo';
  const maxAmountInr = Number(process.env.UPI_MAX_AMOUNT_INR) || 100;

  return {
    enabled: Boolean(payeeVpa && payeeVpa.length > 0),
    payeeVpa,
    payeeName,
    maxAmountInr,
  };
}

export function buildUpiUri(params: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  displayId: string;
}): string {
  const { payeeVpa, payeeName, amount, displayId } = params;
  return `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=Order%20${encodeURIComponent(displayId)}`;
}
