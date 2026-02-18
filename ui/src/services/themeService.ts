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

// Constructable stylesheet for theme variables — avoids 'unsafe-inline' in CSP (#243)
let themeSheet: CSSStyleSheet | null = null;

function getThemeSheet(): CSSStyleSheet {
  if (!themeSheet) {
    themeSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, themeSheet];
  }
  return themeSheet;
}

/**
 * Apply a theme by injecting CSS variables via a constructable stylesheet.
 * Uses CSSStyleSheet.replaceSync() instead of element.style.setProperty()
 * so we don't need 'unsafe-inline' in the CSP style-src directive.
 */
export function applyTheme(theme: Theme): void {
  const sheet = getThemeSheet();
  sheet.replaceSync(`:root {
  --bg-primary: ${theme.colors.bg_primary};
  --bg-secondary: ${theme.colors.bg_secondary};
  --bg-tertiary: ${theme.colors.bg_tertiary};
  --text-primary: ${theme.colors.text_primary};
  --text-secondary: ${theme.colors.text_secondary};
  --accent: ${theme.colors.accent};
  --accent-dark: ${theme.colors.accent_dark};
  --success: ${theme.colors.success};
  --error: ${theme.colors.error};
  --warning: ${theme.colors.warning};
  --border: ${theme.colors.border};
}`);

  // Set theme mode attribute
  document.documentElement.setAttribute('data-theme', theme.mode);

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
