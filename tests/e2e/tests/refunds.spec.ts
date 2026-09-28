import { expect, test } from '@playwright/test';
import { openRefund, signInAs } from './support.js';

test('an analyst approves a pending refund and the decision survives a refresh', async ({ page }) => {
  await signInAs(page, 'analyst');
  await expect(page.getByTestId('identity-role')).toHaveText('Operations analyst');

  await openRefund(page, 'RF-1001');
  await expect(page.getByTestId('refund-status')).toHaveText('PENDING');
  await expect(page.getByTestId('entity-audit-empty')).toBeVisible();

  await page.getByTestId('approve-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Approve RF-1001');
  await dialog.getByLabel('Reason (optional)').fill('Duplicate charge confirmed with merchant');
  await page.getByTestId('action-confirm').click();

  await expect(page.getByTestId('action-success')).toContainText('Recorded approved decision for RF-1001');
  await expect(page.getByTestId('refund-status')).toHaveText('APPROVED');
  const trail = page.getByTestId('entity-audit-trail');
  await expect(trail.getByTestId('audit-event')).toHaveCount(1);
  await expect(trail).toContainText('Refund approved · RF-1001');
  await expect(trail).toContainText('Duplicate charge confirmed with merchant');

  await page.reload();
  await expect(page.getByTestId('refund-reference')).toHaveText('RF-1001');
  await expect(page.getByTestId('refund-status')).toHaveText('APPROVED');
  await expect(page.getByTestId('entity-audit-trail').getByTestId('audit-event')).toHaveCount(1);
  await expect(page.getByTestId('approve-button')).toHaveCount(0);

  await page.getByRole('link', { name: 'Audit' }).click();
  await expect(page.getByTestId('audit-list').getByTestId('audit-event').first()).toContainText('Refund approved · RF-1001');
});
