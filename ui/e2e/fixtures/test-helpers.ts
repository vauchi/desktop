// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, Page } from '@playwright/test';

// Test data
export const TEST_USER = {
  displayName: 'Test User',
  initialFields: [
    { type: 'email', label: 'Email', value: 'test@example.com' },
    { type: 'phone', label: 'Phone', value: '+1234567890' },
  ],
};

export const TEST_CONTACT = {
  displayName: 'Contact Test',
  fields: [
    { type: 'email', label: 'Email', value: 'contact@example.com' },
  ],
};

// Helper functions using real CSS/ARIA selectors

export async function setupTestUser(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for either setup page or home page
  const setupPage = page.locator('.page.setup');
  const homePage = page.locator('.page.home');

  const first = await Promise.race([
    setupPage.waitFor({ timeout: 10000 }).then(() => 'setup'),
    homePage.waitFor({ timeout: 10000 }).then(() => 'home'),
  ]);

  if (first === 'setup') {
    await page.fill('#name', TEST_USER.displayName);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.page.home', { timeout: 10000 });
  }
}

export async function addTestFields(page: Page): Promise<void> {
  for (const field of TEST_USER.initialFields) {
    // Click "Add field" button
    await page.click('.icon-btn');
    await page.waitForSelector('[role="dialog"]');
    await page.selectOption('#add-field-type', field.type);
    await page.fill('#add-field-label', field.label);
    await page.fill('#add-field-value', field.value);
    // Click the Add button in dialog (last button in dialog-actions)
    await page.click('[role="dialog"] .dialog-actions button:last-child');
    await page.waitForTimeout(500);
  }
}

export async function navigateTo(page: Page, label: string): Promise<void> {
  await page.click(`nav.bottom-nav button[aria-label*="${label}"]`);
}

export async function generateQRCode(page: Page): Promise<string> {
  await navigateTo(page, 'Exchange');
  await page.waitForSelector('.page.exchange', { timeout: 10000 });

  // Wait for QR container to appear
  await page.waitForSelector('.qr-container', { timeout: 10000 });

  // Get the exchange data from the copy input
  const qrData = await page.locator('.copy-input-group input').inputValue();
  expect(qrData).toBeTruthy();

  return qrData || '';
}

export async function completeExchange(page: Page, qrData: string): Promise<void> {
  await navigateTo(page, 'Exchange');
  await page.waitForSelector('.page.exchange', { timeout: 10000 });

  // Fill scan data input
  await page.fill('input[aria-label="Exchange data input"]', qrData);
  await page.click('button[aria-label="Complete the contact exchange"]');

  // Wait for success message
  await page.waitForSelector('.success', { timeout: 10000 });
}

export async function verifyContactExists(page: Page, displayName: string): Promise<void> {
  await navigateTo(page, 'Contacts');
  await page.waitForSelector('.page.contacts', { timeout: 10000 });

  const contactItem = page.locator('.contact-item').filter({ hasText: displayName });
  await expect(contactItem).toBeVisible({ timeout: 10000 });
}

export async function checkAppState(page: Page): Promise<{
  hasIdentity: boolean;
  contactCount: number;
}> {
  const hasIdentity = await page.locator('.page.home').isVisible();

  // Navigate to contacts to count them
  await navigateTo(page, 'Contacts');
  await page.waitForSelector('.page.contacts', { timeout: 10000 });
  const contactCount = await page.locator('.contact-item').count();

  // Navigate back to home
  await navigateTo(page, 'Home');
  await page.waitForSelector('.page.home', { timeout: 10000 });

  return { hasIdentity, contactCount };
}

export async function createBackup(page: Page, password: string): Promise<string> {
  await navigateTo(page, 'Settings');
  await page.waitForSelector('.page.settings', { timeout: 10000 });
  await page.click('button[aria-label="Export a backup of your identity"]');
  await page.waitForSelector('[role="dialog"]');
  await page.fill('#backup-password', password);
  await page.fill('#backup-confirm-password', password);
  await page.click('button[aria-label="Create encrypted backup"]');

  // Wait for backup result
  await page.waitForSelector('.backup-result', { timeout: 10000 });
  const backupData = await page.locator('.backup-result textarea').inputValue();

  expect(backupData).toBeTruthy();
  return backupData || '';
}
