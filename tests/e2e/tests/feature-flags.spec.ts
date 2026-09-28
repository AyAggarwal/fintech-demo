import { expect, test } from '@playwright/test';
import { signInAs } from './support.js';

test('an administrator toggles a flag and the audit event is shown', async ({ page }) => {
  await signInAs(page, 'admin');
  await expect(page.getByTestId('identity-role')).toHaveText('Administrator');

  await page.getByRole('link', { name: 'Feature flags' }).click();
  await expect(page.getByTestId('flags-readonly-notice')).toHaveCount(0);
  await expect(page.getByTestId('flag-state-ops.bulk-actions')).toHaveText('DISABLED');

  await page.getByTestId('flag-toggle-ops.bulk-actions').click();
  await expect(page.getByRole('dialog')).toContainText('Enable ops.bulk-actions');
  await page.getByTestId('action-confirm').click();

  await expect(page.getByTestId('action-success')).toContainText('ops.bulk-actions');
  await expect(page.getByTestId('flag-state-ops.bulk-actions')).toHaveText('ENABLED');
  const trail = page.getByTestId('entity-audit-trail');
  await expect(trail.getByTestId('audit-event')).toHaveCount(1);
  await expect(trail).toContainText('Feature flag enabled · ops.bulk-actions');

  await page.reload();
  await expect(page.getByTestId('flag-state-ops.bulk-actions')).toHaveText('ENABLED');
});
