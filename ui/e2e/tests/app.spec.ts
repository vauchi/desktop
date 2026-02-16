// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';
import {
  setupTestUser,
  addTestFields,
  generateQRCode,
  completeExchange,
  verifyContactExists,
  navigateTo,
  createBackup,
  TEST_USER,
} from '../fixtures/test-helpers';

// Inject Tauri IPC mock so the frontend renders without the Rust backend.
test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
});

test.describe('Identity Management', () => {
  test('should create new identity', async ({ page }) => {
    await page.goto('/');

    // Should show setup page for new user
    await expect(page.locator('.page.setup')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#name')).toBeVisible();

    // Create identity
    await page.fill('#name', TEST_USER.displayName);
    await page.click('button[type="submit"]');

    // Should redirect to main app (home page)
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });
  });

  test('should display user identity information', async ({ page }) => {
    await setupTestUser(page);

    // Check greeting contains display name
    await expect(page.locator('.page.home h1')).toContainText(TEST_USER.displayName);
    // Check public ID is displayed
    await expect(page.locator('.page.home .public-id')).toBeVisible();
  });

  test('should add fields to identity', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);

    // Verify fields were added
    for (const field of TEST_USER.initialFields) {
      const fieldElement = page.locator('.field-item').filter({ hasText: field.label });
      await expect(fieldElement).toBeVisible();
      await expect(fieldElement.locator('.field-value')).toContainText(field.value);
    }
  });

  test('should update existing field', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);

    // Click edit button on the Email field
    const emailField = page.locator('.field-item').filter({ hasText: 'Email' });
    await emailField.locator('.edit-btn').click();
    await page.waitForSelector('[role="dialog"]');

    // Set new value and trigger SolidJS's onInput handler
    await page.evaluate(() => {
      const input = document.getElementById('edit-field-value') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(input, 'updated@example.com');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Verify the input value was set correctly before clicking save
    const inputVal = await page.locator('#edit-field-value').inputValue();
    expect(inputVal).toBe('updated@example.com');

    await page.click('button[aria-label="Save changes"]');

    // Wait for dialog to close, then reload to force fresh fetch from mock state
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('.page.home', { timeout: 10000 });

    // Verify the field shows the updated value after reload
    const emailField2 = page.locator('.field-item').first();
    await expect(emailField2.locator('.field-value')).toContainText('updated@example.com', { timeout: 5000 });
  });

  test('should remove field from identity', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);

    const fieldCountBefore = await page.locator('.field-item').count();

    // Handle the confirm() dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button on the Phone field
    const phoneField = page.locator('.field-item').filter({ hasText: 'Phone' });
    await phoneField.locator('.delete-btn').click();

    // Wait for field to be removed
    await page.waitForTimeout(500);
    const fieldCountAfter = await page.locator('.field-item').count();
    expect(fieldCountAfter).toBe(fieldCountBefore - 1);
  });
});

test.describe('Contact Exchange', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
  });

  test('should generate QR code for exchange', async ({ page }) => {
    const qrData = await generateQRCode(page);

    expect(qrData).toBeTruthy();
    expect(qrData.length).toBeGreaterThan(0);

    // Verify QR section is displayed
    await expect(page.locator('.qr-container')).toBeVisible();
  });

  test('should complete contact exchange', async ({ page }) => {
    // Get exchange data
    const qrData = await generateQRCode(page);

    // Complete exchange using the data
    await completeExchange(page, qrData);

    // Verify contact was added by navigating to contacts
    await verifyContactExists(page, 'New Contact');
  });

  test('should show exchange page elements', async ({ page }) => {
    await navigateTo(page, 'Exchange');
    await page.waitForSelector('.page.exchange', { timeout: 10000 });

    // Check QR section and scan section are present
    await expect(page.locator('.qr-section')).toBeVisible();
    await expect(page.locator('.scan-section')).toBeVisible();
    await expect(page.locator('.qr-container')).toBeVisible();
  });
});

test.describe('Contact Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestUser(page);

    // Add a contact via exchange
    const qrData = await generateQRCode(page);
    await completeExchange(page, qrData);
  });

  test('should display contact list', async ({ page }) => {
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    const contactItems = page.locator('.contact-item');
    await expect(contactItems).toHaveCount(1);
    await expect(contactItems.first()).toContainText('New Contact');
  });

  test('should search contacts', async ({ page }) => {
    // Add more contacts
    for (let i = 0; i < 2; i++) {
      const qrData = await generateQRCode(page);
      await completeExchange(page, qrData);
    }

    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // All contacts should be visible
    await expect(page.locator('.contact-item')).toHaveCount(3);

    // Search — type into search bar and wait for debounce
    await page.fill('.search-bar input', 'Contact');
    await page.waitForTimeout(600); // wait for 300ms debounce + render

    // Results should show contacts matching "Contact"
    const resultCount = await page.locator('.contact-item').count();
    expect(resultCount).toBeGreaterThanOrEqual(1);

    // Clear search by clearing the input (clear button may disappear reactively)
    await page.fill('.search-bar input', '');
    await page.waitForTimeout(500);
    await expect(page.locator('.contact-item')).toHaveCount(3);
  });

  test('should remove contact', async ({ page }) => {
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Click the contact to open detail dialog
    await page.locator('.contact-item').first().click();
    await page.waitForSelector('[role="dialog"]');

    // Click delete button
    await page.click('[role="dialog"] .danger');

    // Confirm deletion in the alertdialog
    await page.waitForSelector('[role="alertdialog"]');
    await page.click('[role="alertdialog"] .danger');

    // Verify contact is removed
    await page.waitForTimeout(500);
    await expect(page.locator('.contact-item')).toHaveCount(0);
  });
});

test.describe('Backup and Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
  });

  test('should create backup', async ({ page }) => {
    const password = 'test-password-123';
    const backupData = await createBackup(page, password);

    expect(backupData).toBeTruthy();
    expect(backupData.length).toBeGreaterThan(0);
  });

  test('should validate backup password length', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });
    await page.click('button[aria-label="Export a backup of your identity"]');
    await page.waitForSelector('[role="dialog"]');

    // Enter short password
    await page.fill('#backup-password', '12345678');
    await page.waitForTimeout(300);

    // Enter longer password
    await page.fill('#backup-password', 'Str0ng-P@ssw0rd!');
    await page.waitForTimeout(300);

    // Password strength indicator should be visible
    await expect(page.locator('#password-strength')).toBeVisible();
  });
});

test.describe('Settings and Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestUser(page);
  });

  test('should display settings page', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    // Check key sections are present
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('#identity-section-title')).toBeVisible();
    await expect(page.locator('#about-section-title')).toBeVisible();
  });

  test('should display application info', async ({ page }) => {
    await navigateTo(page, 'Settings');
    await page.waitForSelector('.page.settings', { timeout: 10000 });

    // Version info should be visible
    await expect(page.locator('text=1.0.0')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should meet basic accessibility standards', async ({ page }) => {
    await setupTestUser(page);

    // Check for proper heading structure
    const headingCount = await page.locator('h1, h2, h3').count();
    expect(headingCount).toBeGreaterThanOrEqual(1);

    // Check for buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Check keyboard navigation — Tab should move focus to an interactive element
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA']).toContain(focusedTag);
  });

  test('should support screen readers', async ({ page }) => {
    await setupTestUser(page);

    // Check for proper ARIA roles
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[role="navigation"]')).toBeVisible();

    // Check for aria-labels on interactive elements
    const labeledButtons = page.locator('button[aria-label]');
    const count = await labeledButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Navigation', () => {
  test('should navigate between all pages', async ({ page }) => {
    await setupTestUser(page);

    // Start on home
    await expect(page.locator('.page.home')).toBeVisible();

    // Navigate to contacts
    await navigateTo(page, 'Contacts');
    await expect(page.locator('.page.contacts')).toBeVisible({ timeout: 10000 });

    // Navigate to exchange
    await navigateTo(page, 'Exchange');
    await expect(page.locator('.page.exchange')).toBeVisible({ timeout: 10000 });

    // Navigate to settings
    await navigateTo(page, 'Settings');
    await expect(page.locator('.page.settings')).toBeVisible({ timeout: 10000 });

    // Navigate back to home
    await navigateTo(page, 'Home');
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });
  });
});
