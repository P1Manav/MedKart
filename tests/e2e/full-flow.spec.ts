// tests/e2e/full-flow.spec.ts
import { test, expect, type Page } from '@playwright/test';

/**
 * Helper to authenticate in Playwright via UI login flow with demo verification code
 */
async function loginAs(page: Page, phone: string) {
  await page.goto('/login');
  const phoneInput = page.locator('[data-testid="phone-input"]');
  await expect(phoneInput).toBeVisible({ timeout: 10000 });
  await phoneInput.fill(phone);
  await page.click('[data-testid="get-otp-btn"]');

  // The login screen displays demo code and auto-fills OTP input
  const otpInput = page.locator('[data-testid="otp-input"]');
  await expect(otpInput).toBeVisible({ timeout: 10000 });

  // Wait for OTP input to be populated or read demo code from banner
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="otp-input"]') as HTMLInputElement | null;
    return el && el.value.length === 6;
  }, { timeout: 5000 }).catch(async () => {
    const codeEl = page.locator('[data-testid="demo-otp-code"]');
    if (await codeEl.isVisible()) {
      const text = await codeEl.textContent();
      if (text) await otpInput.fill(text.trim());
    }
  });

  const submitBtn = page.locator('[data-testid="verify-otp-btn"]');
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // Wait until navigation away from /login completes
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('MedKart Full Pharmacy Lifecycle Flow', () => {
  test('unapproved Schedule H order cannot be packed by store staff', async ({ page }) => {
    // 1. Authenticate as Ops to view orders across stores
    await loginAs(page, '9830099999');

    // 2. Visit store fulfillment screen
    await page.goto('/store/orders');
    await expect(page.locator('h1')).toBeVisible();

    // 3. Locate unapproved pending order (RX-50214 which is Awaiting Pharmacist)
    const orderCard = page.locator('[data-testid="order-card-RX-50214"]');
    await expect(orderCard).toBeVisible({ timeout: 15000 });

    // 4. Assert Pack Order button is disabled with visible statutory reason
    const packButton = page.locator('[data-testid="pack-order-btn-RX-50214"]');
    await expect(packButton).toBeDisabled();

    // 5. Assert reason is displayed
    await expect(
      orderCard.locator('text=Awaiting Pharmacist Prescription Approval')
    ).toBeVisible();
  });

  test('customer uploads prescription, pharmacist verifies, and store packs approved order', async ({ browser }) => {
    test.setTimeout(90000);
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
    await customerPage.locator('button').filter({ hasText: /prescription/i }).first().click();

    // Pick synthetic sample prescription (Clean Metformin)
    await customerPage.click('text=Sample 1: Metformin 500 mg (Clean)');
    await expect(customerPage.locator('text=Image ready for secure encrypted upload')).toBeVisible();

    // Select Cash on Delivery to proceed directly to order tracking without payment modal
    await customerPage.click('[data-testid="payment-cod"]');

    // Submit order for pharmacist verification
    await customerPage.click('[data-testid="submit-order-btn"]');

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

    // Pharmacist verifies and approves the prescription line item
    const approveLineBtn = pharmacistPage.locator('button:has-text("Approve Line")').first();
    if (await approveLineBtn.isVisible()) {
      await approveLineBtn.click();
      await expect(pharmacistPage.locator('text=Approved ✓').first()).toBeVisible({ timeout: 10000 });
    }

    // Click Approve Order
    await pharmacistPage.click('[data-testid="approve-order-header-btn"]');
    await expect(
      pharmacistPage.locator('text=Order approved and ready for store packing!')
    ).toBeVisible({ timeout: 15000 });

    await pharmacistContext.close();

    // 4. Store fulfillment: Salt Lake Store Staff logs in on fresh context and packs the approved order
    const storeContext = await browser.newContext();
    const storePage = await storeContext.newPage();

    await loginAs(storePage, '9830066661'); // Salt Lake Store Staff Bikash Mondal
    await storePage.goto('/store/orders');
    await expect(storePage.locator('h1')).toBeVisible();

    // Locate the "Pack Order" button for the approved order using its displayId
    const approvedOrderCard = storePage.locator(`[data-testid="order-card-${displayId}"]`);
    await expect(approvedOrderCard).toBeVisible();
    const packOrderBtn = storePage.locator(`[data-testid="pack-order-btn-${displayId}"]`);
    await packOrderBtn.click();

    // Enter GST invoice number in modal
    const invoiceInput = storePage.locator('[data-testid="invoice-number-input"]');
    await invoiceInput.fill('INV-SL-2026-9011');

    // Confirm & Mark Packed
    await storePage.click('[data-testid="confirm-pack-btn"]');

    // Verify order is packed!
    await expect(storePage.locator('text=successfully packed!')).toBeVisible();

    await storeContext.close();
  });
});

