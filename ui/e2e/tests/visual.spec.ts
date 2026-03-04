// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, Page } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';

// Inject Tauri IPC mock so the frontend renders without the Rust backend.
test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
});

/** Create an identity via the onboarding wizard. */
async function createIdentity(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for onboarding page to render (has_identity returns false initially)
  await page.waitForSelector('.page.onboarding', { timeout: 10000 });
  // Step 1: Welcome
  await page.click('.welcome-step .step-actions button');
  // Step 2: Create Identity
  await page.waitForSelector('.create-identity-step', { timeout: 5000 });
  await page.fill('#display-name', 'Test User');
  await page.click('.create-identity-step button[type="submit"]');
  // Step 3: Add Fields — skip
  await page.waitForSelector('.add-fields-step', { timeout: 5000 });
  await page.click('.add-fields-step .text-btn');
  // Step 4: Preview Card — next
  await page.waitForSelector('.preview-card-step', { timeout: 5000 });
  await page.click('.preview-card-step .step-actions button:not(.secondary)');
  // Step 5: Security — next
  await page.waitForSelector('.security-step', { timeout: 5000 });
  await page.click('.security-step .step-actions button:not(.secondary)');
  // Step 6: Backup Prompt — skip
  await page.waitForSelector('.backup-prompt-step', { timeout: 5000 });
  await page.click('.backup-prompt-step .text-btn');
  // Step 7: Ready — complete
  await page.waitForSelector('.ready-step', { timeout: 5000 });
  await page.click('.ready-step .step-actions button');
  // Wait for the page to reload after onboarding completes
  await page.waitForSelector('.page.home', { timeout: 15000 });
}

/** Add test fields via the Add Field dialog. */
async function addFields(page: Page): Promise<void> {
  // Click "Add field" button
  await page.click('.icon-btn');
  await page.waitForSelector('[role="dialog"]');
  await page.selectOption('#add-field-type', 'email');
  await page.fill('#add-field-label', 'Email');
  await page.fill('#add-field-value', 'test@example.com');
  // Click the "Add" button in dialog (last button in dialog-actions)
  await page.click('[role="dialog"] .dialog-actions button:last-child');
  // Wait for dialog to close after adding the field
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });

  // Add phone field
  await page.click('.icon-btn');
  await page.waitForSelector('[role="dialog"]');
  await page.selectOption('#add-field-type', 'phone');
  await page.fill('#add-field-label', 'Phone');
  await page.fill('#add-field-value', '+1234567890');
  await page.click('[role="dialog"] .dialog-actions button:last-child');
  // Wait for dialog to close after adding the field
  await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
}

/** Navigate using the bottom nav. */
async function navigateTo(page: Page, label: string): Promise<void> {
  await page.click(`nav.bottom-nav button[aria-label*="${label}"]`);
}

/** Apply dark theme via CSS variables. */
async function setDarkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('selected-theme', 'catppuccin-mocha');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.setProperty('--bg-primary', '#1e1e2e');
    document.documentElement.style.setProperty('--bg-secondary', '#181825');
    document.documentElement.style.setProperty('--bg-tertiary', '#313244');
    document.documentElement.style.setProperty('--text-primary', '#cdd6f4');
    document.documentElement.style.setProperty('--text-secondary', '#a6adc8');
    document.documentElement.style.setProperty('--accent', '#89b4fa');
    document.documentElement.style.setProperty('--accent-dark', '#74c7ec');
    document.documentElement.style.setProperty('--border', '#45475a');
  });
}

/** Set locale to German and reload. */
async function setGermanLocale(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('selected-locale', 'de');
    document.documentElement.lang = 'de';
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('Visual Regression @visual', () => {
  test('onboarding page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.page.onboarding', { timeout: 10000 });
    await expect(page).toHaveScreenshot('onboarding-page.png');
  });

  test('main app - empty state', async ({ page }) => {
    await createIdentity(page);
    await expect(page).toHaveScreenshot('main-app-empty.png');
  });

  test('main app - with fields', async ({ page }) => {
    await createIdentity(page);
    await addFields(page);
    await expect(page).toHaveScreenshot('main-app-with-fields.png');
  });

  test('exchange page', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Exchange');
    await page.waitForSelector('.page.exchange', { timeout: 10000 });
    await expect(page).toHaveScreenshot('exchange-page.png');
  });

  test('contacts tab - empty', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });
    await expect(page).toHaveScreenshot('contacts-empty.png');
  });

  test('settings page', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });
    await expect(page).toHaveScreenshot('settings-page.png');
  });

  test('backup export dialog', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings');
    await page.click('button[aria-label="Export a backup of your identity"]');
    await page.waitForSelector('[role="dialog"]');
    await expect(page).toHaveScreenshot('backup-export-dialog.png');
  });

  test('password strength - weak', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings');
    await page.click('button[aria-label="Export a backup of your identity"]');
    await page.waitForSelector('[role="dialog"]');
    await page.fill('#backup-password', '12345678');
    // Wait for password strength indicator to render
    await page.waitForSelector('#password-strength', { state: 'visible', timeout: 5000 });
    await expect(page).toHaveScreenshot('password-strength-weak.png');
  });

  test('password strength - strong', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings');
    await page.click('button[aria-label="Export a backup of your identity"]');
    await page.waitForSelector('[role="dialog"]');
    await page.fill('#backup-password', 'Str0ng-P@ssw0rd!');
    // Wait for password strength indicator to render
    await page.waitForSelector('#password-strength', { state: 'visible', timeout: 5000 });
    await expect(page).toHaveScreenshot('password-strength-strong.png');
  });
});

test.describe('Dark Theme Variants @visual', () => {
  test('onboarding page - dark', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.page.onboarding', { timeout: 10000 });
    await setDarkTheme(page);
    await expect(page).toHaveScreenshot('onboarding-page-dark.png');
  });

  test('main app - dark', async ({ page }) => {
    await createIdentity(page);
    await addFields(page);
    await setDarkTheme(page);
    await expect(page).toHaveScreenshot('main-app-dark.png');
  });

  test('settings page - dark', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings');
    await setDarkTheme(page);
    await expect(page).toHaveScreenshot('settings-page-dark.png');
  });

  test('contacts tab - dark', async ({ page }) => {
    await createIdentity(page);
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts');
    await setDarkTheme(page);
    await expect(page).toHaveScreenshot('contacts-empty-dark.png');
  });
});

test.describe('German Locale Variants @visual', () => {
  test('onboarding page - German', async ({ page }) => {
    await page.goto('/');
    await setGermanLocale(page);
    await page.waitForSelector('.page.onboarding', { timeout: 10000 });
    await expect(page).toHaveScreenshot('onboarding-page-de.png');
  });

  test('main app - German', async ({ page }) => {
    await createIdentity(page);
    await addFields(page);
    await setGermanLocale(page);
    // Identity persists in sessionStorage across reload
    await page.waitForSelector('.page.home', { timeout: 10000 });
    await expect(page).toHaveScreenshot('main-app-de.png');
  });

  test('settings page - German', async ({ page }) => {
    await createIdentity(page);
    await setGermanLocale(page);
    await page.waitForSelector('.page.home', { timeout: 10000 });
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings');
    await expect(page).toHaveScreenshot('settings-page-de.png');
  });

  test('contacts tab - German', async ({ page }) => {
    await createIdentity(page);
    await setGermanLocale(page);
    await page.waitForSelector('.page.home', { timeout: 10000 });
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts');
    await expect(page).toHaveScreenshot('contacts-empty-de.png');
  });
});
