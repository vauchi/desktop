// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import {
  setupTestUser,
  addTestFields,
  generateQRCode,
  completeExchange,
  TEST_USER,
} from '../fixtures/test-helpers';

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
