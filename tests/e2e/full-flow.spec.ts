// tests/e2e/full-flow.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * Helper to authenticate in Playwright via mock OTP API
 */
async function loginAs(page: Page, phone: string) {
  const reqRes = await page.request.post('/api/auth/otp/request', {
    data: { phone },
  });
  const reqData = await reqRes.json();
  const otp = reqData.mockOtp || '123456';

  const verRes = await page.request.post('/api/auth/otp/verify', {
    data: { phone, otp },
  });
  expect(verRes.ok()).toBe(true);
}

test.describe('MedKart Full Pharmacy Lifecycle Flow', () => {
  test('unapproved Schedule H order cannot be packed by store staff', async ({ page }) => {
    // 1. Authenticate as Ops to view orders across stores
    await loginAs(page, '9830099999');

    // 2. Visit store fulfillment screen
    await page.goto('/store/orders');
    await expect(page.locator('text=Store Fulfillment & Packing Desk')).toBeVisible();

    // 3. Locate unapproved pending order (RX-50214 which is Awaiting Pharmacist)
    const pendingOrderSection = page.locator('text=RX-50214').locator('..').locator('..');
    await expect(pendingOrderSection).toBeVisible();

    // 4. Assert Pack Order button is disabled with visible statutory reason
    const packButton = pendingOrderSection.locator('button:has-text("Pack Order")');
    await expect(packButton).toBeDisabled();

    // 5. Assert reason is displayed
    await expect(
      pendingOrderSection.locator('text=Awaiting Pharmacist Prescription Approval')
    ).toBeVisible();
  });

  test('customer uploads prescription, pharmacist verifies, and store packs approved order', async ({ page }) => {
    // 1. Log in as Customer (Debasish Ghosh)
    await loginAs(page, '9830011111');
    await page.goto('/customer/home');
    await expect(page.locator('text=Reorder My Monthly Medicines')).toBeVisible();
    await page.click('text=Reorder My Monthly Medicines');

    // 2. Order builder page
    await expect(page).toHaveURL(/.*\/customer\/order\/new/);

    // Pick synthetic sample prescription (Clean Metformin)
    await page.click('text=Sample 1: Metformin 500 mg (Clean)');
    await expect(page.locator('text=Image ready for secure encrypted upload')).toBeVisible();

    // Submit order for pharmacist verification
    await page.click('button:has-text("Submit Order")');

    // Wait for redirect to tracking page: /customer/order/[orderId]
    await expect(page).toHaveURL(/.*\/customer\/order\/[a-zA-Z0-9_-]+/);
    const trackingUrl = page.url();
    const orderIdMatch = trackingUrl.match(/\/customer\/order\/([^/?#]+)/);
    expect(orderIdMatch).toBeTruthy();
    const orderId = orderIdMatch![1];

    // 3. Pharmacist logs in and verifies prescription
    await loginAs(page, '9830044444'); // Pharmacist Sunita Banerjee
    await page.goto(`/pharmacist/review/${orderId}`);
    await expect(page.locator('text=Prescription Document')).toBeVisible();

    // Verify and confirm prescription date checkbox
    const confirmCheckbox = page.locator('input[type="checkbox"]');
    await confirmCheckbox.check();

    // Click Approve Order
    await page.click('button:has-text("Approved")');
    await expect(page.locator('text=Approved successfully')).toBeVisible();

    // 4. Store fulfillment: Store Staff / Ops logs in and packs the approved order
    await loginAs(page, '9830099999'); // Ops
    await page.goto('/store/orders');
    await expect(page.locator('text=Store Fulfillment & Packing Desk')).toBeVisible();

    // Locate the "Pack Order" button for approved orders
    const packOrderBtn = page.locator('button:has-text("Pack Order (Enter Invoice)")').first();
    await packOrderBtn.click();

    // Enter GST invoice number in modal
    const invoiceInput = page.locator('input[placeholder*="INV-"]');
    await invoiceInput.fill('INV-SL-2026-9011');

    // Confirm & Mark Packed
    await page.click('button:has-text("Confirm & Mark Packed")');

    // Verify order is packed!
    await expect(page.locator('text=successfully packed!')).toBeVisible();
  });
});
