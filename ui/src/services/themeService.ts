// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Theme Service
 *
 * Manages theme selection and application via CSS variables.
 */

import { invoke } from '@tauri-apps/api/core';

export interface ThemeColors {
  bg_primary: string;
  bg_secondary: string;
  bg_tertiary: string;
  text_primary: string;
  text_secondary: string;
  accent: string;
  accent_dark: string;
  success: string;
  error: string;
  warning: string;
  border: string;
}

export interface Theme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  author: string | null;
  colors: ThemeColors;
}

const THEME_STORAGE_KEY = 'selected-theme';

/**
 * Get all available themes.
 */
export async function getAvailableThemes(): Promise<Theme[]> {
  return await invoke<Theme[]>('get_available_themes');
}

/**
 * Get a specific theme by ID.
 */
export async function getTheme(themeId: string): Promise<Theme | null> {
  return await invoke<Theme | null>('get_theme', { themeId });
}

/**
 * Get the default theme ID based on system preference.
 */
export async function getDefaultThemeId(): Promise<string> {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return await invoke<string>('get_default_theme_id', { preferDark: prefersDark });
}

/**
 * Get the currently selected theme ID.
 */
export function getSelectedThemeId(): string | null {
  return localStorage.getItem(THEME_STORAGE_KEY);
}

/**
 * Apply a theme by setting CSS variables.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // Set CSS variables
  root.style.setProperty('--bg-primary', theme.colors.bg_primary);
  root.style.setProperty('--bg-secondary', theme.colors.bg_secondary);
  root.style.setProperty('--bg-tertiary', theme.colors.bg_tertiary);
  root.style.setProperty('--text-primary', theme.colors.text_primary);
  root.style.setProperty('--text-secondary', theme.colors.text_secondary);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--accent-dark', theme.colors.accent_dark);
  root.style.setProperty('--success', theme.colors.success);
  root.style.setProperty('--error', theme.colors.error);
  root.style.setProperty('--warning', theme.colors.warning);
  root.style.setProperty('--border', theme.colors.border);

  // Set theme mode attribute
  root.setAttribute('data-theme', theme.mode);

  // Save selection
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);
}

/**
 * Select and apply a theme.
 */
export async function selectTheme(themeId: string): Promise<void> {
  const theme = await getTheme(themeId);
  if (theme) {
    applyTheme(theme);
  }
}

/**
 * Initialize theme from saved preference or system default.
 */
export async function initializeTheme(): Promise<void> {
  const savedThemeId = getSelectedThemeId();
  if (savedThemeId) {
    await selectTheme(savedThemeId);
  } else {
    const defaultId = await getDefaultThemeId();
    await selectTheme(defaultId);
  }
}
