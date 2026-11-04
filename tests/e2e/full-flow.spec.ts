// tests/e2e/full-flow.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * Helper to authenticate in Playwright via UI login flow with demo verification code
 */
async function loginAs(page: Page, phone: string) {
  await page.goto('/login');
  await page.fill('input[type="tel"]', phone);
  await page.click('button[type="submit"]');

  // The login screen displays demo code and auto-fills OTP input
  const otpInput = page.locator('input[maxLength="6"]');
  await expect(otpInput).toBeVisible();

  const submitBtn = page.locator('button[type="submit"]');
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Wait until navigation away from /login completes
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

test.describe('MedKart Full Pharmacy Lifecycle Flow', () => {
  test('unapproved Schedule H order cannot be packed by store staff', async ({ page }) => {
    // 1. Authenticate as Ops to view orders across stores
    await loginAs(page, '9830099999');

    // 2. Visit store fulfillment screen
    await page.goto('/store/orders');
    await expect(page.locator('text=Store Fulfillment & Packing Desk')).toBeVisible();

    // 3. Locate unapproved pending order (RX-50214 which is Awaiting Pharmacist)
    const orderCard = page.locator('div.divide-y > div').filter({ hasText: 'RX-50214' });
    await expect(orderCard).toBeVisible();

    // 4. Assert Pack Order button is disabled with visible statutory reason
    const packButton = orderCard.locator('button:has-text("Pack Order")');
    await expect(packButton).toBeDisabled();

    // 5. Assert reason is displayed
    await expect(
      orderCard.locator('text=Awaiting Pharmacist Prescription Approval')
    ).toBeVisible();
  });

  test('customer uploads prescription, pharmacist verifies, and store packs approved order', async ({ browser }) => {
    // 1. Log in as Customer (Debasish Ghosh) in isolated customer context
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    await loginAs(customerPage, '9830011111');
    await customerPage.goto('/customer/home');
    await expect(customerPage.locator('text=Reorder My Monthly Medicines')).toBeVisible();
    await customerPage.click('text=Reorder My Monthly Medicines');

    // 2. Order builder page
    await expect(customerPage).toHaveURL(/.*\/customer\/order\/new/);

    // Search catalogue and add Metformin to basket
    await customerPage.click('button:has-text("Search Catalogue & Cart")');
    const searchInput = customerPage.locator('input[placeholder*="Search medicines"]');
    await searchInput.fill('Metformin');
    const addToOrderBtn = customerPage.locator('button:has-text("Add to Order +")').first();
    await expect(addToOrderBtn).toBeVisible();
    await addToOrderBtn.click();

    // Switch back to prescription upload
    await customerPage.click('button:has-text("Prescription Upload")');

    // Pick synthetic sample prescription (Clean Metformin)
    await customerPage.click('text=Sample 1: Metformin 500 mg (Clean)');
    await expect(customerPage.locator('text=Image ready for secure encrypted upload')).toBeVisible();

    // Submit order for pharmacist verification
    await customerPage.click('button:has-text("Submit Order")');

    // Wait for redirect to tracking page: /customer/order/[orderId] (must NOT remain on /new)
    await customerPage.waitForURL(
      (url) => url.pathname.startsWith('/customer/order/') && !url.pathname.endsWith('/new'),
      { timeout: 20000 }
    );
    const trackingUrl = customerPage.url();
    const orderIdMatch = trackingUrl.match(/\/customer\/order\/([^/?#]+)/);
    expect(orderIdMatch).toBeTruthy();
    const orderId = orderIdMatch![1];

    // Read the generated displayId (e.g. RX-5022X)
    await expect(customerPage.locator('h1')).toBeVisible();
    const displayId = (await customerPage.locator('h1').textContent())?.trim();
    expect(displayId).toBeTruthy();
    expect(displayId).toMatch(/^RX-\d+/);

    await customerContext.close();

    // 3. Pharmacist logs in on a fresh desktop context and verifies prescription
    const pharmacistContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pharmacistPage = await pharmacistContext.newPage();

    await loginAs(pharmacistPage, '9830044444'); // Pharmacist Sunita Banerjee
    await pharmacistPage.goto(`/pharmacist/review/${orderId}`);
    await expect(pharmacistPage.locator('text=Prescription Date (Rx Issue Date)')).toBeVisible();

    // Verify and confirm prescription date checkbox
    const confirmCheckbox = pharmacistPage
      .locator('label')
      .filter({ hasText: 'within validity window' })
      .locator('input[type="checkbox"]');
    await confirmCheckbox.check();

    // Click Approve Order
    await pharmacistPage.click('button:has-text("Approved")');
    await expect(
      pharmacistPage.locator('text=Order approved and ready for store packing!')
    ).toBeVisible();

    await pharmacistContext.close();

    // 4. Store fulfillment: Store Staff / Ops logs in on fresh context and packs the approved order
    const storeContext = await browser.newContext();
    const storePage = await storeContext.newPage();

    await loginAs(storePage, '9830099999'); // Ops
    await storePage.goto('/store/orders');
    await expect(storePage.locator('text=Store Fulfillment & Packing Desk')).toBeVisible();

    // Locate the "Pack Order" button for the approved order using its displayId
    const approvedOrderCard = storePage.locator('div.divide-y > div').filter({ hasText: displayId! });
    await expect(approvedOrderCard).toBeVisible();
    const packOrderBtn = approvedOrderCard.locator('button:has-text("Pack Order (Enter Invoice)")');
    await packOrderBtn.click();

    // Enter GST invoice number in modal
    const invoiceInput = storePage.locator('input[placeholder*="INV-"]');
    await invoiceInput.fill('INV-SL-2026-9011');

    // Confirm & Mark Packed
    await storePage.click('button:has-text("Confirm & Mark Packed")');

    // Verify order is packed!
    await expect(storePage.locator('text=successfully packed!')).toBeVisible();

    await storeContext.close();
  });
});

