// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../services/i18nService';
import { checkAhaMoment } from '../../services/ahaService';

interface CreateIdentityStepProps {
  onNext: () => void;
  onBack: () => void;
  onIdentityCreated: (name: string) => void;
}

function CreateIdentityStep(props: CreateIdentityStepProps) {
  const [name, setName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [created, setCreated] = createSignal(false);

  const handleCreate = async () => {
    const trimmedName = name().trim();
    if (!trimmedName) {
      setError(t('error.validation') || 'Please enter a display name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await invoke('create_identity', { name: trimmedName });
      // Check for aha moment but don't block on it
      checkAhaMoment('card_creation_complete').catch(() => {});
      setCreated(true);
      props.onIdentityCreated(trimmedName);
      // Auto-advance after a brief moment
      setTimeout(() => {
        props.onNext();
      }, 500);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="onboarding-step create-identity-step">
      <h2>{t('onboarding.identity.title') || 'Create Your Identity'}</h2>
      <p class="step-description">
        {t('onboarding.identity.description') || 'Choose a display name for your contact card. This is what others will see when you exchange cards.'}
      </p>

      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!created()) {
            handleCreate();
          }
        }}
        aria-describedby="identity-form-description"
      >
        <p id="identity-form-description" class="sr-only">
          {t('onboarding.identity.form_description') || 'Enter your display name to create your identity card.'}
        </p>

        <label for="display-name">
          {t('settings.display_name') || 'Display Name'}
        </label>
        <input
          id="display-name"
          type="text"
          placeholder={t('setup.enter_name') || 'Enter your name'}
          value={name()}
          onInput={(e) => setName(e.target.value)}
          disabled={loading() || created()}
          aria-describedby={error() ? 'name-error' : undefined}
          aria-invalid={error() ? 'true' : undefined}
          aria-required="true"
          autofocus
        />

        {error() && (
          <p id="name-error" class="error" role="alert" aria-live="polite">
            {error()}
          </p>
        )}

        {created() && (
          <p class="success" role="status" aria-live="polite">
            {t('onboarding.identity.created') || 'Identity created successfully!'}
          </p>
        )}

        <div class="step-actions step-actions-split">
          <button
            type="button"
            class="secondary"
            onClick={() => props.onBack()}
            disabled={loading()}
          >
            {t('onboarding.back') || 'Back'}
          </button>
          <button
            type="submit"
            disabled={loading() || created()}
            aria-busy={loading()}
          >
            {loading()
              ? (t('setup.creating') || 'Creating...')
              : created()
                ? (t('onboarding.identity.done') || 'Done!')
                : (t('onboarding.identity.create') || 'Create Identity')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateIdentityStep;
