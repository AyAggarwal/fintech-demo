import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DemoIdentityKey } from '@fintech-demo/contracts';

export async function signInAs(page: Page, identity: DemoIdentityKey): Promise<void> {
  await page.goto('/');
  await page.getByTestId(`sign-in-${identity}`).click();
  await expect(page.getByTestId('identity-card')).toBeVisible();
  await expect(page.getByTestId('demo-notice')).toHaveText('Synthetic data · Demo identity · No live transactions');
}

export async function openRefund(page: Page, reference: string): Promise<void> {
  await page.goto('/refunds');
  await page.getByTestId('refunds-table').getByRole('row', { name: new RegExp(`^${reference} `) }).click();
  await expect(page.getByTestId('refund-reference')).toHaveText(reference);
}
