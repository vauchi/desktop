// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../services/i18nService';

interface BackupPromptStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface BackupResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

function BackupPromptStep(props: BackupPromptStepProps) {
  const [showBackupForm, setShowBackupForm] = createSignal(false);
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [passwordStrength, setPasswordStrength] = createSignal('');
  const [backupData, setBackupData] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [backupComplete, setBackupComplete] = createSignal(false);

  const checkStrength = async (pwd: string) => {
    if (!pwd) {
      setPasswordStrength('');
      return;
    }
    try {
      const strength = await invoke<string>('check_password_strength', { password: pwd });
      setPasswordStrength(strength);
    } catch {
      setPasswordStrength('weak');
    }
  };

  const handleCreateBackup = async () => {
    if (password() !== confirmPassword()) {
      setError(t('onboarding.backup.passwords_mismatch') || 'Passwords do not match');
      return;
    }

    if (!password()) {
      setError(t('onboarding.backup.password_required') || 'Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await invoke<BackupResult>('export_backup', { password: password() });
      if (result.success && result.data) {
        setBackupData(result.data);
        setBackupComplete(true);
      } else {
        setError(result.error || t('onboarding.backup.failed') || 'Backup failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupData());
    } catch {
      // Fallback: select text for manual copy
    }
  };

  return (
    <div class="onboarding-step backup-prompt-step">
      <h2>{t('onboarding.backup.title') || 'Backup Your Identity'}</h2>
      <p class="step-description">
        {t('onboarding.backup.description') || 'If you lose this device, your identity is gone forever. Creating a backup lets you restore it.'}
      </p>

      <Show when={!showBackupForm() && !backupComplete()}>
        <div class="backup-prompt-info">
          <div class="backup-warning" role="alert">
            <span class="warning-icon" aria-hidden="true">{'\u26A0\uFE0F'}</span>
            <p>
              {t('onboarding.backup.warning') || 'Without a backup, there is no way to recover your identity if your device is lost or damaged.'}
            </p>
          </div>

          <div class="step-actions step-actions-center">
            <button type="button" onClick={() => setShowBackupForm(true)}>
              {t('onboarding.backup.create_now') || 'Create Backup Now'}
            </button>
            <button type="button" class="text-btn" onClick={props.onSkip}>
              {t('onboarding.backup.remind_later') || 'Remind me later'}
            </button>
          </div>
        </div>
      </Show>

      <Show when={showBackupForm() && !backupComplete()}>
        <form
          class="form backup-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateBackup();
          }}
        >
          <label for="backup-password">
            {t('onboarding.backup.password_label') || 'Backup Password'}
          </label>
          <input
            id="backup-password"
            type="password"
            placeholder={t('onboarding.backup.password_placeholder') || 'Choose a strong password'}
            value={password()}
            onInput={(e) => {
              setPassword(e.target.value);
              checkStrength(e.target.value);
            }}
            disabled={loading()}
            aria-required="true"
            autofocus
          />

          <Show when={passwordStrength()}>
            <p class={`password-strength strength-${passwordStrength().replace(/_/g, '-')}`} aria-live="polite">
              {t(`onboarding.backup.strength_${passwordStrength()}`) || `Strength: ${passwordStrength()}`}
            </p>
          </Show>

          <label for="backup-confirm">
            {t('onboarding.backup.confirm_label') || 'Confirm Password'}
          </label>
          <input
            id="backup-confirm"
            type="password"
            placeholder={t('onboarding.backup.confirm_placeholder') || 'Repeat your password'}
            value={confirmPassword()}
            onInput={(e) => setConfirmPassword(e.target.value)}
            disabled={loading()}
            aria-required="true"
          />

          {error() && (
            <p class="error" role="alert" aria-live="polite">
              {error()}
            </p>
          )}

          <div class="step-actions step-actions-split">
            <button
              type="button"
              class="secondary"
              onClick={() => setShowBackupForm(false)}
              disabled={loading()}
            >
              {t('onboarding.cancel') || 'Cancel'}
            </button>
            <button type="submit" disabled={loading()} aria-busy={loading()}>
              {loading()
                ? (t('onboarding.backup.creating') || 'Creating backup...')
                : (t('onboarding.backup.create') || 'Create Backup')}
            </button>
          </div>
        </form>
      </Show>

      <Show when={backupComplete()}>
        <div class="backup-success" role="status" aria-live="polite">
          <div class="success-icon" aria-hidden="true">{'\u2705'}</div>
          <h3>{t('onboarding.backup.success_title') || 'Backup Created!'}</h3>
          <p>
            {t('onboarding.backup.success_desc') || 'Store this backup data in a safe place. You will need it along with your password to restore your identity.'}
          </p>

          <div class="backup-data-section">
            <textarea
              readonly
              value={backupData()}
              rows={4}
              aria-label={t('onboarding.backup.data_label') || 'Backup data'}
            />
            <button type="button" class="secondary" onClick={handleCopyBackup}>
              {t('onboarding.backup.copy') || 'Copy to Clipboard'}
            </button>
          </div>

          <div class="step-actions">
            <button type="button" onClick={props.onNext}>
              {t('onboarding.next') || 'Next'}
            </button>
          </div>
        </div>
      </Show>

      <Show when={!showBackupForm() && !backupComplete()}>
        <div class="step-actions step-actions-split backup-nav">
          <button type="button" class="secondary" onClick={props.onBack}>
            {t('onboarding.back') || 'Back'}
          </button>
        </div>
      </Show>
    </div>
  );
}

export default BackupPromptStep;
