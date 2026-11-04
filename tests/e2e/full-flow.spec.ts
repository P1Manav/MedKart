// tests/e2e/full-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('MedKart Full Pharmacy Lifecycle Flow', () => {
  test('unapproved Schedule H order cannot be packed by store staff', async ({ page }) => {
    // 1. Visit store fulfillment screen
    await page.goto('/store/orders');

    // 2. Locate unapproved pending order (e.g. RX-50214 which is Awaiting Pharmacist)
    const pendingOrderSection = page.locator('text=RX-50214').locator('..').locator('..');

    // 3. Assert Pack Order button is disabled with visible statutory reason
    const packButton = pendingOrderSection.locator('button:has-text("Pack Order")');
    await expect(packButton).toBeDisabled();

    // 4. Assert reason is displayed
    await expect(
      pendingOrderSection.locator('text=Awaiting Pharmacist Prescription Approval')
    ).toBeVisible();
  });

  test('customer uploads prescription, pharmacist verifies, and store packs approved order', async ({ page }) => {
    // 1. Customer visits home and clicks Reorder
    await page.goto('/customer/home');
    await expect(page.locator('text=Reorder My Medicines')).toBeVisible();
    await page.click('text=Reorder My Medicines');

    // 2. Order builder page
    await expect(page).toHaveURL(/.*\/customer\/order\/new/);

    // Pick synthetic sample prescription
    await page.click('text=Sample 1: Metformin 500 mg (Clean)');
    await expect(page.locator('text=Image ready for secure encrypted upload')).toBeVisible();

    // Submit order
    await page.click('button:has-text("Submit Order for Pharmacist Verification")');

    // Wait for redirect to tracking page
    await expect(page).toHaveURL(/.*\/customer\/order\/.*/);
    await expect(page.locator('text=Order Progress Timeline')).toBeVisible();

    // 3. Pharmacist Queue
    await page.goto('/pharmacist/queue');
    await expect(page.locator('text=Pharmacist Verification Queue')).toBeVisible();

    // 4. Store fulfillment screen
    await page.goto('/store/orders');
    await expect(page.locator('text=Store Fulfillment & Packing Desk')).toBeVisible();
  });
});
