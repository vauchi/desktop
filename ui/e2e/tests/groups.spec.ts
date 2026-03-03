// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from '@playwright/test';
import { tauriMockScript } from '../fixtures/tauri-mock';
import { setupTestUser, completeExchange, navigateTo } from '../fixtures/test-helpers';

// CRIT-SP-12a: Contact group management

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: tauriMockScript() });
  await setupTestUser(page);
});

test.describe('Contact Groups Management', () => {
  test('should create a contact group', async ({ page }) => {
    // Navigate to Contacts page
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Click on Groups tab
    await page.click('button[aria-label="Groups tab"]');
    await page.waitForSelector('.groups-tab', { timeout: 5000 });

    // Click create group button
    await page.click('button[aria-label="Create new group"]');
    await page.waitForSelector('.create-group-modal', { timeout: 5000 });

    // Fill in group name
    await page.fill('input[placeholder="Group name"]', 'Family');

    // Submit
    await page.click('button[aria-label="Create group"]');

    // Verify group was created
    await expect(page.locator('text=Family')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.group-item:has-text("Family") .group-count')).toContainText(
      '0 contacts'
    );
  });

  test('should add contact to group', async ({ page }) => {
    // Setup: Create group and contact
    await completeExchange(page, 'Bob');

    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Create group
    await page.click('button[aria-label="Groups tab"]');
    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Work');
    await page.click('button[aria-label="Create group"]');
    await expect(page.locator('text=Work')).toBeVisible();

    // Open contact detail
    await page.click('.contacts-list .contact-item:first-child');
    await page.waitForSelector('.contact-detail', { timeout: 5000 });

    // Add to group
    await page.click('button[aria-label="Add to group"]');
    await page.click('text=Work');
    await expect(page.locator('.groups-assigned')).toContainText('Work');
  });

  test('should show contact in multiple groups', async ({ page }) => {
    // Setup: Create contact and two groups
    await completeExchange(page, 'Carol');

    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Create two groups
    await page.click('button[aria-label="Groups tab"]');
    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Friends');
    await page.click('button[aria-label="Create group"]');

    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Colleagues');
    await page.click('button[aria-label="Create group"]');

    // Open contact and add to both groups
    await page.click('.contacts-list .contact-item:first-child');
    await page.waitForSelector('.contact-detail', { timeout: 5000 });

    await page.click('button[aria-label="Add to group"]');
    await page.click('text=Friends');
    await page.click('button[aria-label="Add to group"]');
    await page.click('text=Colleagues');

    // Verify contact appears in both groups
    await page.click('button[aria-label="Groups tab"]');
    await page.click('.group-item:has-text("Friends")');
    await expect(page.locator('text=Carol')).toBeVisible();

    await page.click('.group-item:has-text("Colleagues")');
    await expect(page.locator('text=Carol')).toBeVisible();
  });

  test('should remove contact from group', async ({ page }) => {
    // Setup: Create group and add contact
    await completeExchange(page, 'Bob');

    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Create group and add Bob
    await page.click('button[aria-label="Groups tab"]');
    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Work');
    await page.click('button[aria-label="Create group"]');

    await page.click('.contacts-list .contact-item:first-child');
    await page.click('button[aria-label="Add to group"]');
    await page.click('text=Work');
    await expect(page.locator('.groups-assigned')).toContainText('Work');

    // Remove from group
    await page.click('.groups-assigned .group-tag:has-text("Work") button[aria-label="Remove from group"]');

    // Verify removed
    await expect(page.locator('.groups-assigned')).not.toContainText('Work');

    // Bob should still be in contacts
    await page.click('button[aria-label="Close"]');
    await expect(page.locator('text=Bob')).toBeVisible();
  });

  test('should delete a group', async ({ page }) => {
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Create group
    await page.click('button[aria-label="Groups tab"]');
    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Old Friends');
    await page.click('button[aria-label="Create group"]');
    await expect(page.locator('text=Old Friends')).toBeVisible();

    // Delete group
    await page.click('.group-item:has-text("Old Friends") button[aria-label="Delete group"]');
    await page.click('button[aria-label="Confirm delete"]');

    // Verify deleted
    await expect(page.locator('text=Old Friends')).not.toBeVisible();
  });

  test('should rename a group', async ({ page }) => {
    await navigateTo(page, 'Contacts');
    await page.waitForSelector('.page.contacts', { timeout: 10000 });

    // Create group
    await page.click('button[aria-label="Groups tab"]');
    await page.click('button[aria-label="Create new group"]');
    await page.fill('input[placeholder="Group name"]', 'Work');
    await page.click('button[aria-label="Create group"]');
    await expect(page.locator('text=Work')).toBeVisible();

    // Rename group
    await page.click('.group-item:has-text("Work") button[aria-label="Rename group"]');
    await page.fill('input[placeholder="Group name"]', 'Office');
    await page.click('button[aria-label="Confirm rename"]');

    // Verify renamed
    await expect(page.locator('text=Office')).toBeVisible();
    await expect(page.locator('text=Work')).not.toBeVisible();
  });
});
