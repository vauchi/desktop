// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * ValidationBadge Component
 *
 * Displays a colored trust-level badge next to contact fields with
 * validate/revoke actions. Fetches validation status from core via
 * Tauri IPC and refreshes after mutations.
 *
 * Trust levels (from vauchi-core):
 *   high_confidence -> green  "Verified (N)"
 *   partial_confidence -> light green "Partial (N)"
 *   low_confidence -> yellow "Low (N)"
 *   unverified -> grey "Unverified"
 */

import { createSignal, createEffect, Show } from 'solid-js';
import { t } from '../services/i18nService';
import {
  getFieldValidationStatus,
  validateField,
  revokeFieldValidation,
  type ValidationStatus,
} from '../services/validationService';

export interface ValidationBadgeProps {
  contactId: string;
  fieldId: string;
  fieldValue: string;
}

/**
 * Map trust_level string from backend to a CSS color class suffix.
 * Falls back to "grey" for unknown values.
 */
function trustLevelColorClass(trustLevel: string): string {
  switch (trustLevel) {
    case 'high_confidence':
      return 'green';
    case 'partial_confidence':
      return 'light-green';
    case 'low_confidence':
      return 'yellow';
    case 'unverified':
      return 'grey';
    default:
      return 'grey';
  }
}

/**
 * Build the badge label text from a ValidationStatus.
 * Uses the count when > 0, otherwise falls back to the trust_level label.
 */
function badgeLabel(status: ValidationStatus): string {
  if (status.count > 0) {
    return `\u2713 ${status.count}`;
  }
  return status.trust_level;
}

function ValidationBadge(props: ValidationBadgeProps) {
  const [status, setStatus] = createSignal<ValidationStatus | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const fetchStatus = async () => {
    try {
      const result = await getFieldValidationStatus(
        props.contactId,
        props.fieldId,
        props.fieldValue
      );
      setStatus(result);
      setError('');
    } catch {
      // Status unavailable — leave as null (will not render badge)
    }
  };

  // Fetch validation status on mount and when props change
  createEffect(() => {
    // Access reactive props to track them
    const _contactId = props.contactId;
    const _fieldId = props.fieldId;
    const _fieldValue = props.fieldValue;
    void _contactId;
    void _fieldId;
    void _fieldValue;
    fetchStatus();
  });

  const handleValidate = async (e: Event) => {
    e.stopPropagation();
    setLoading(true);
    setError('');
    try {
      await validateField(props.contactId, props.fieldId, props.fieldValue);
      await fetchStatus();
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  const handleRevoke = async (e: Event) => {
    e.stopPropagation();
    setLoading(true);
    setError('');
    try {
      await revokeFieldValidation(props.contactId, props.fieldId);
      await fetchStatus();
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  return (
    <div class="validation-badge-container" onClick={(e) => e.stopPropagation()}>
      <Show when={status()}>
        {(s) => (
          <>
            <span
              class={`validation-badge trust-${s().color || trustLevelColorClass(s().trust_level)}`}
              title={s().display_text}
              aria-label={`Trust level: ${s().trust_level}. ${s().display_text}`}
            >
              {badgeLabel(s())}
            </span>
            <Show
              when={s().validated_by_me}
              fallback={
                <button
                  class="validate-btn small"
                  onClick={handleValidate}
                  disabled={loading()}
                  aria-label={`${t('contacts.validate')} this field`}
                >
                  {loading() ? '...' : t('contacts.validate')}
                </button>
              }
            >
              <button
                class="revoke-btn small"
                onClick={handleRevoke}
                disabled={loading()}
                aria-label={`${t('contacts.revoke')} validation for this field`}
              >
                {loading() ? '...' : t('contacts.revoke')}
              </button>
            </Show>
          </>
        )}
      </Show>
      <Show when={error()}>
        <span class="validation-error" role="alert">
          {error()}
        </span>
      </Show>
    </div>
  );
}

export default ValidationBadge;
