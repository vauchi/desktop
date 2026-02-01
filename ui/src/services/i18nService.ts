// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Internationalization Service
 *
 * Manages localization for the desktop app.
 * Provides both async (Tauri IPC) and synchronous (pre-loaded) string lookup.
 */

import { invoke } from '@tauri-apps/api/core';

export interface LocaleInfo {
  code: string;
  name: string;
  english_name: string;
  is_rtl: boolean;
}

const LOCALE_STORAGE_KEY = 'selected-locale';

/** Pre-loaded string map for synchronous lookups. */
let strings: Record<string, string> = {};

/**
 * Get all available locales.
 */
export async function getAvailableLocales(): Promise<LocaleInfo[]> {
  return await invoke<LocaleInfo[]>('get_locales');
}

/**
 * Get the currently selected locale code.
 */
export function getSelectedLocale(): string {
  return localStorage.getItem(LOCALE_STORAGE_KEY) || 'en';
}

/**
 * Set the current locale and reload strings.
 */
export async function setLocale(code: string): Promise<void> {
  localStorage.setItem(LOCALE_STORAGE_KEY, code);
  // Update document direction for RTL languages
  document.documentElement.dir = code === 'ar' || code === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = code;
  await loadStrings(code);
}

/**
 * Load all strings for a locale into the synchronous cache.
 */
export async function loadStrings(localeCode?: string): Promise<void> {
  const code = localeCode || getSelectedLocale();
  strings = await invoke<Record<string, string>>('get_locale_strings', {
    localeCode: code,
  });
}

/**
 * Synchronous localized string lookup.
 * Requires loadStrings() to have been called first (done in initializeLocale).
 */
export function t(key: string): string {
  return strings[key] ?? `Missing: ${key}`;
}

/**
 * Synchronous localized string lookup with argument interpolation.
 */
export function tArgs(key: string, args: Record<string, string>): string {
  let result = t(key);
  for (const [name, value] of Object.entries(args)) {
    result = result.replace(`{${name}}`, value);
  }
  return result;
}

/**
 * Async get a localized string (Tauri IPC, for cases where cache isn't loaded).
 */
export async function tAsync(key: string): Promise<string> {
  const localeCode = getSelectedLocale();
  return await invoke<string>('get_localized_string', { localeCode, key });
}

/**
 * Async get a localized string with arguments.
 */
export async function tArgsAsync(
  key: string,
  args: Record<string, string>
): Promise<string> {
  const localeCode = getSelectedLocale();
  return await invoke<string>('get_localized_string_with_args', {
    localeCode,
    key,
    args,
  });
}

/**
 * Initialize locale from saved preference or browser default.
 * Loads all strings for synchronous access.
 */
export async function initializeLocale(): Promise<void> {
  const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  let locale: string;
  if (savedLocale) {
    locale = savedLocale;
  } else {
    // Try to detect browser locale
    const browserLocale = navigator.language.split('-')[0];
    const supportedLocales = ['en', 'de', 'fr', 'es'];
    locale = supportedLocales.includes(browserLocale) ? browserLocale : 'en';
  }
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.dir =
    locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  await loadStrings(locale);
}
