// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect, Page } from '@playwright/test';
import {
  setupTestUser,
  addTestFields,
  generateQRCode,
  completeExchange,
  TEST_USER,
} from '../fixtures/test-helpers';

/**
 * Set the theme for visual testing by applying CSS variables directly.
 */
async function setTestTheme(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await page.evaluate((themeMode) => {
    localStorage.setItem('selected-theme', themeMode === 'dark' ? 'dark-default' : 'light-default');
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'dark') {
      document.documentElement.style.setProperty('--bg-primary', '#1a1a2e');
      document.documentElement.style.setProperty('--bg-secondary', '#16213e');
      document.documentElement.style.setProperty('--bg-tertiary', '#0f3460');
      document.documentElement.style.setProperty('--text-primary', '#e0e0e0');
      document.documentElement.style.setProperty('--text-secondary', '#a0a0a0');
      document.documentElement.style.setProperty('--accent', '#00d4aa');
      document.documentElement.style.setProperty('--accent-dark', '#00a882');
      document.documentElement.style.setProperty('--border', '#2a2a4a');
    }
  }, mode);
}

/**
 * Set the locale for visual testing by updating localStorage and reloading strings.
 */
async function setTestLocale(page: Page, code: string): Promise<void> {
  await page.evaluate((localeCode) => {
    localStorage.setItem('selected-locale', localeCode);
    document.documentElement.lang = localeCode;
  }, code);
  // Reload to apply the new locale strings
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('Visual Regression @visual', () => {
  test('setup page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="setup-page"]')).toBeVisible();
    await expect(page).toHaveScreenshot('setup-page.png');
  });

  test('main app - empty state', async ({ page }) => {
    await setupTestUser(page);
    await expect(page.locator('[data-testid="main-app"]')).toBeVisible();
    await expect(page).toHaveScreenshot('main-app-empty.png');
  });

  test('main app - with fields', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await expect(page.locator('[data-testid="main-app"]')).toBeVisible();
    await expect(page).toHaveScreenshot('main-app-with-fields.png');
  });

  test('contact exchange tab', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await page.click('[data-testid="exchange-tab"]');
    await expect(page.locator('[data-testid="exchange-progress"]')).toBeVisible();
    await expect(page).toHaveScreenshot('exchange-tab.png');
  });

  test('QR code display', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await page.click('[data-testid="exchange-tab"]');
    await page.click('[data-testid="generate-qr-btn"]');
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
    await expect(page).toHaveScreenshot('qr-code-display.png', {
      maxDiffPixelRatio: 0.05, // QR codes may have minor rendering differences
    });
  });

  test('contacts tab - empty', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="contacts-tab"]');
    await expect(page).toHaveScreenshot('contacts-empty.png');
  });

  test('contacts tab - with contacts', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    const qrData = await generateQRCode(page);
    await completeExchange(page, qrData);
    await page.click('[data-testid="contacts-tab"]');
    await expect(page.locator('[data-testid="contact-card"]')).toBeVisible();
    await expect(page).toHaveScreenshot('contacts-with-data.png');
  });

  test('settings page', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await expect(page).toHaveScreenshot('settings-page.png');
  });

  test('backup export dialog', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="backup-export-btn"]');
    await expect(page.locator('[data-testid="backup-password-input"]')).toBeVisible();
    await expect(page).toHaveScreenshot('backup-export-dialog.png');
  });

  test('relay settings', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="relay-settings-btn"]');
    await expect(page.locator('[data-testid="relay-url-input"]')).toBeVisible();
    await expect(page).toHaveScreenshot('relay-settings.png');
  });

  test('about page', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="about-btn"]');
    await expect(page.locator('[data-testid="app-version"]')).toBeVisible();
    await expect(page).toHaveScreenshot('about-page.png');
  });

  test('password strength - weak', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="backup-export-btn"]');
    await page.fill('[data-testid="backup-password-input"]', '123');
    await expect(page.locator('[data-testid="password-strength"]')).toContainText('Weak');
    await expect(page).toHaveScreenshot('password-strength-weak.png');
  });

  test('password strength - strong', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await page.click('[data-testid="backup-export-btn"]');
    await page.fill('[data-testid="backup-password-input"]', 'Str0ng-P@ssw0rd!');
    await expect(page.locator('[data-testid="password-strength"]')).toContainText('Strong');
    await expect(page).toHaveScreenshot('password-strength-strong.png');
  });

  test('error toast - offline', async ({ page }) => {
    await setupTestUser(page);
    await page.context().setOffline(true);
    await page.click('[data-testid="sync-btn"]');
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible();
    await expect(page).toHaveScreenshot('error-toast-offline.png');
    await page.context().setOffline(false);
  });
});

test.describe('Dark Theme Variants @visual', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestUser(page);
    await setTestTheme(page, 'dark');
  });

  test('setup page - dark', async ({ page }) => {
    // Reset identity to show setup page
    await page.evaluate(() => localStorage.clear());
    await setTestTheme(page, 'dark');
    await page.reload();
    await expect(page.locator('[data-testid="setup-page"]')).toBeVisible();
    await expect(page).toHaveScreenshot('setup-page-dark.png');
  });

  test('main app - dark', async ({ page }) => {
    await addTestFields(page);
    await expect(page).toHaveScreenshot('main-app-dark.png');
  });

  test('settings page - dark', async ({ page }) => {
    await page.click('[data-testid="settings-tab"]');
    await expect(page).toHaveScreenshot('settings-page-dark.png');
  });

  test('contacts tab - dark', async ({ page }) => {
    await page.click('[data-testid="contacts-tab"]');
    await expect(page).toHaveScreenshot('contacts-empty-dark.png');
  });
});

test.describe('German Locale Variants @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setTestLocale(page, 'de');
  });

  test('setup page - German', async ({ page }) => {
    await expect(page.locator('[data-testid="setup-page"]')).toBeVisible();
    await expect(page).toHaveScreenshot('setup-page-de.png');
  });

  test('main app - German', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await expect(page).toHaveScreenshot('main-app-de.png');
  });

  test('settings page - German', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');
    await expect(page).toHaveScreenshot('settings-page-de.png');
  });

  test('contacts tab - German', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="contacts-tab"]');
    await expect(page).toHaveScreenshot('contacts-empty-de.png');
  });
});
