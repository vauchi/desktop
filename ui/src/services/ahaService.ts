// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Aha Moment Service
 *
 * Triggers milestone celebrations on key user actions.
 */

import { invoke } from '@tauri-apps/api/core';
import { getSelectedLocale } from './i18nService';

export interface AhaMoment {
  moment_type: string;
  title: string;
  message: string;
  has_animation: boolean;
}

/**
 * Check and trigger an aha moment with localized content.
 * Returns the moment if not yet seen, null otherwise.
 */
export async function checkAhaMoment(momentType: string): Promise<AhaMoment | null> {
  return await invoke<AhaMoment | null>('check_aha_moment_localized', {
    momentType,
    localeCode: getSelectedLocale(),
  });
}

/**
 * Check and trigger an aha moment with context (e.g., contact name).
 */
export async function checkAhaMomentWithContext(
  momentType: string,
  context: string
): Promise<AhaMoment | null> {
  return await invoke<AhaMoment | null>('check_aha_moment_with_context', {
    momentType,
    context,
  });
}
