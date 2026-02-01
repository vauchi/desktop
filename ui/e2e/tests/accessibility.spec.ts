// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupTestUser, addTestFields } from '../fixtures/test-helpers';

test.describe('Accessibility @a11y', () => {
  test('setup page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="setup-page"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  });

  test('home page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await addTestFields(page);
    await expect(page.locator('[data-testid="main-app"]')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  });

  test('contacts page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="contacts-tab"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  });

  test('settings page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="settings-tab"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    ).toEqual([]);
  });

  test('exchange page has no critical a11y violations', async ({ page }) => {
    await setupTestUser(page);
    await page.click('[data-testid="exchange-tab"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
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
    await expect(page.locator('[data-testid="main-app"]')).toBeVisible();

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
    await expect(page.locator('[data-testid="main-app"]')).toBeVisible();

    const reduceMotion = await page.evaluate(() =>
      document.documentElement.getAttribute('data-reduce-motion')
    );
    expect(reduceMotion).toBe('true');
  });
});
