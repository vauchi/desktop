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
  fields: [{ type: 'email', label: 'Email', value: 'contact@example.com' }],
};

// Helper functions using real CSS/ARIA selectors

export async function setupTestUser(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for either onboarding page or home page
  const onboardingPage = page.locator('.page.onboarding');
  const homePage = page.locator('.page.home');

  const first = await Promise.race([
    onboardingPage.waitFor({ timeout: 10000 }).then(() => 'onboarding'),
    homePage.waitFor({ timeout: 10000 }).then(() => 'home'),
  ]);

  if (first === 'onboarding') {
    // Step 1: Welcome — click the primary button
    await page.click('.welcome-step .step-actions button');
    // Step 2: Create Identity — fill name and submit
    await page.waitForSelector('.create-identity-step', { timeout: 5000 });
    await page.fill('#display-name', TEST_USER.displayName);
    await page.click('.create-identity-step button[type="submit"]');
    // Wait for identity creation + auto-advance (500ms delay)
    await page.waitForSelector('.add-fields-step', { timeout: 5000 });
    // Step 3: Add Fields — skip (text-btn class)
    await page.click('.add-fields-step .text-btn');
    // Step 4: Preview Card — next (non-secondary button in step-actions)
    await page.waitForSelector('.preview-card-step', { timeout: 5000 });
    await page.click('.preview-card-step .step-actions button:not(.secondary)');
    // Step 5: Security — next (non-secondary button in step-actions)
    await page.waitForSelector('.security-step', { timeout: 5000 });
    await page.click('.security-step .step-actions button:not(.secondary)');
    // Step 6: Backup Prompt — skip (text-btn class = "Remind me later")
    await page.waitForSelector('.backup-prompt-step', { timeout: 5000 });
    await page.click('.backup-prompt-step .text-btn');
    // Step 7: Ready — complete (only button in step-actions)
    await page.waitForSelector('.ready-step', { timeout: 5000 });
    await page.click('.ready-step .step-actions button');
    // App reloads after onComplete — wait for home page
    await page.waitForSelector('.page.home', { timeout: 15000 });
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
