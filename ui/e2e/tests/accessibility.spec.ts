// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tauriMockScript } from '../fixtures/tauri-mock';
import { setupTestUser, addTestFields, navigateTo } from '../fixtures/test-helpers';

// Inject Tauri IPC mock so the frontend renders without the Rust backend.
test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
});

test.describe('Accessibility @a11y', () => {
  test('setup page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page.setup')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical')
    ).toEqual([]);
  });

  test('home page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await expect(page.locator('.page.home')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical')
    ).toEqual([]);
  });

  test('contacts page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await navigateTo(page, 'Contacts');
    await expect(page.locator('.page.contacts')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical')
    ).toEqual([]);
  });

  test('settings page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await navigateTo(page, 'Settings');
    await expect(page.locator('.page.settings')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical')
    ).toEqual([]);
  });

  test('exchange page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await navigateTo(page, 'Exchange');
    await expect(page.locator('.page.exchange')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical')
    ).toEqual([]);
  });

  test('high contrast mode applies correctly', async ({ page }) => {
    await setupTestUser(page);

    // Enable high contrast
    await page.evaluate(() => {
      localStorage.setItem('a11y-high-contrast', 'true');
      document.documentElement.setAttribute('data-high-contrast', 'true');
    });

    await page.reload();
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });

    const highContrast = await page.evaluate(() =>
      document.documentElement.getAttribute('data-high-contrast')
    );
    expect(highContrast).toBe('true');
  });

  test('reduce motion applies correctly', async ({ page }) => {
    await setupTestUser(page);

    // Enable reduce motion
    await page.evaluate(() => {
      localStorage.setItem('a11y-reduce-motion', 'true');
      document.documentElement.setAttribute('data-reduce-motion', 'true');
    });

    await page.reload();
    await expect(page.locator('.page.home')).toBeVisible({ timeout: 10000 });

    const reduceMotion = await page.evaluate(() =>
      document.documentElement.getAttribute('data-reduce-motion')
    );
    expect(reduceMotion).toBe('true');
  });
});
