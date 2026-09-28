import { expect, test } from '@playwright/test';
import { signInAs } from './support.js';

test('an analyst reviews a high-risk case and its decision persists with an audit event', async ({ page }) => {
  await signInAs(page, 'analyst');
  await page.getByRole('link', { name: 'KYC' }).click();

  await page.getByRole('button', { name: /KYC-2003/ }).click();
  await expect(page.getByTestId('kyc-reference')).toHaveText('KYC-2003');
  await expect(page.getByTestId('kyc-status')).toHaveText('PENDING');
  await expect(page.getByText('SIGNUP_VELOCITY')).toBeVisible();
  await expect(page.getByText('Recently registered entity; multiple sign-up attempts within one hour.')).toBeVisible();

  await page.getByTestId('reject-button').click();
  await page.getByRole('dialog').getByLabel('Reason (optional)').fill('Manual review of synthetic signals');
  await page.getByTestId('action-confirm').click();

  await expect(page.getByTestId('kyc-status')).toHaveText('REJECTED');
  await expect(page.getByTestId('entity-audit-trail')).toContainText('Manual review of synthetic signals');

  await page.reload();
  await expect(page.getByTestId('kyc-reference')).toHaveText('KYC-2003');
  await expect(page.getByTestId('kyc-status')).toHaveText('REJECTED');
  await expect(page.getByTestId('entity-audit-trail').getByTestId('audit-event')).toHaveCount(1);
});
