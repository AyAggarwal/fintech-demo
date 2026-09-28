import { expect, test } from '@playwright/test';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@fintech-demo/contracts';
import { openRefund, signInAs } from './support.js';

test('a viewer sees read-only state and the API refuses its mutations', async ({ page }) => {
  await signInAs(page, 'viewer');
  await expect(page.getByTestId('identity-role')).toHaveText('Viewer');

  await openRefund(page, 'RF-1002');
  await expect(page.getByTestId('decision-denied')).toBeVisible();
  await expect(page.getByTestId('approve-button')).toHaveCount(0);

  const refundId = new URL(page.url()).searchParams.get('selected');
  expect(refundId).not.toBeNull();

  // Bypass the UI: the same browser session calling the API directly is still refused.
  const direct = await page.request.post(`/api/refunds/${refundId ?? ''}/decision`, {
    headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
    data: { decision: 'APPROVED' },
  });
  expect(direct.status()).toBe(403);
  expect(await direct.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

  await page.reload();
  await expect(page.getByTestId('refund-status')).toHaveText('PENDING');

  await page.getByRole('link', { name: 'Feature flags' }).click();
  await expect(page.getByTestId('flags-readonly-notice')).toBeVisible();
  await expect(page.getByTestId('flag-toggle-console.dark-mode')).toBeDisabled();
});
