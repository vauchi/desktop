/**
 * Internationalization Service
 *
 * Manages localization for the desktop app.
 */

import { invoke } from '@tauri-apps/api/core';

export interface LocaleInfo {
  code: string;
  name: string;
  english_name: string;
  is_rtl: boolean;
}

const LOCALE_STORAGE_KEY = 'selected-locale';

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
 * Set the current locale.
 */
export function setLocale(code: string): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, code);
  // Update document direction for RTL languages
  document.documentElement.dir = code === 'ar' || code === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = code;
}

/**
 * Get a localized string.
 */
export async function t(key: string): Promise<string> {
  const localeCode = getSelectedLocale();
  return await invoke<string>('get_localized_string', { localeCode, key });
}

/**
 * Get a localized string with arguments.
 */
export async function tArgs(key: string, args: Record<string, string>): Promise<string> {
  const localeCode = getSelectedLocale();
  return await invoke<string>('get_localized_string_with_args', { localeCode, key, args });
}

/**
 * Initialize locale from saved preference or browser default.
 */
export function initializeLocale(): void {
  const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (savedLocale) {
    setLocale(savedLocale);
  } else {
    // Try to detect browser locale
    const browserLocale = navigator.language.split('-')[0];
    const supportedLocales = ['en', 'de', 'fr', 'es'];
    const locale = supportedLocales.includes(browserLocale) ? browserLocale : 'en';
    setLocale(locale);
  }
}
