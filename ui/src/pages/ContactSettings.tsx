// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, onMount, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface ContactSettingsProps {
  onNavigate: (
    page:
      | 'home'
      | 'contacts'
      | 'exchange'
      | 'settings'
      | 'devices'
      | 'recovery'
      | 'help'
      | 'support'
      | 'delivery'
      | 'duress-settings'
      | 'emergency-wipe'
      | 'contact-duplicates'
      | 'contact-merge'
      | 'contact-settings'
  ) => void;
}

function ContactSettings(props: ContactSettingsProps) {
  const [contactLimit, setContactLimit] = createSignal(500);
  const [editingLimit, setEditingLimit] = createSignal(false);
  const [newLimit, setNewLimit] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(async () => {
    try {
      const limit: number = await invoke('get_contact_limit');
      setContactLimit(limit);
    } catch (e) {
      console.error('Failed to load contact limit:', e);
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  });

  const saveLimit = async () => {
    const parsed = parseInt(newLimit(), 10);
    if (isNaN(parsed) || parsed < 1) {
      setError(
        t('contacts.settings.invalid_limit') || 'Contact limit must be a positive number.'
      );
      return;
    }
    if (parsed > 100000) {
      setError(
        t('contacts.settings.limit_too_high') || 'Contact limit cannot exceed 100,000.'
      );
      return;
    }

    try {
      await invoke('set_contact_limit', { limit: parsed });
      setContactLimit(parsed);
      setEditingLimit(false);
      setError('');
      setSuccess(t('contacts.settings.limit_saved') || 'Contact limit updated.');
    } catch (e) {
      setError(String(e));
      setSuccess('');
    }
  };

  const startEditLimit = () => {
    setNewLimit(String(contactLimit()));
    setEditingLimit(true);
    setError('');
    setSuccess('');
  };

  const cancelEditLimit = () => {
    setEditingLimit(false);
    setError('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveLimit();
    } else if (e.key === 'Escape') {
      cancelEditLimit();
    }
  };

  return (
    <div class="page settings" role="main" aria-labelledby="contact-settings-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label={t('contacts.settings.back_to_settings') || 'Back to settings'}
        >
          {t('action.back') || 'Back'}
        </button>
        <h1 id="contact-settings-title">
          {t('contacts.settings.title') || 'Contact Settings'}
        </h1>
      </header>

      <Show when={error()}>
        <p class="error" role="alert" aria-live="assertive">
          {error()}
        </p>
      </Show>

      <Show when={success()}>
        <p class="success" role="status" aria-live="polite">
          {success()}
        </p>
      </Show>

      <Show when={isLoading()}>
        <p role="status" aria-live="polite" aria-busy="true">
          {t('contacts.settings.loading') || 'Loading settings...'}
        </p>
      </Show>

      <Show when={!isLoading()}>
        {/* Contact Limit Section */}
        <section aria-labelledby="contact-limit-title">
          <h2 id="contact-limit-title">
            {t('contacts.settings.limit_title') || 'Contact Limit'}
          </h2>
          <p class="setting-description">
            {t('contacts.settings.limit_description') ||
              'Maximum number of contacts allowed in your address book. This limit helps prevent excessive resource usage.'}
          </p>

          <Show when={!editingLimit()}>
            <div class="delivery-record-item">
              <div class="record-details">
                <span class="setting-label">
                  {t('contacts.settings.current_limit') || 'Current limit'}
                </span>
                <span class="count-value">{contactLimit().toLocaleString()}</span>
              </div>
              <button
                class="small"
                onClick={startEditLimit}
                aria-label={t('contacts.settings.edit_limit') || 'Edit contact limit'}
              >
                {t('action.edit') || 'Edit'}
              </button>
            </div>
          </Show>

          <Show when={editingLimit()}>
            <div class="delivery-record-item">
              <label for="contact-limit-input" class="setting-label">
                {t('contacts.settings.new_limit') || 'New limit'}
              </label>
              <input
                id="contact-limit-input"
                type="number"
                min="1"
                max="100000"
                value={newLimit()}
                onInput={(e) => setNewLimit(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                aria-label={t('contacts.settings.limit_input') || 'Enter new contact limit'}
                aria-describedby="limit-help"
              />
              <p id="limit-help" class="setting-description">
                {t('contacts.settings.limit_help') || 'Enter a number between 1 and 100,000.'}
              </p>
              <div class="delivery-action-buttons">
                <button
                  class="nav-btn"
                  onClick={saveLimit}
                  aria-label={t('action.save') || 'Save'}
                >
                  {t('action.save') || 'Save'}
                </button>
                <button
                  class="small"
                  onClick={cancelEditLimit}
                  aria-label={t('action.cancel') || 'Cancel'}
                >
                  {t('action.cancel') || 'Cancel'}
                </button>
              </div>
            </div>
          </Show>
        </section>

        {/* Duplicates Link */}
        <section aria-labelledby="duplicates-section-title">
          <h2 id="duplicates-section-title">
            {t('contacts.settings.duplicates_title') || 'Duplicate Management'}
          </h2>
          <p class="setting-description">
            {t('contacts.settings.duplicates_description') ||
              'Scan your contacts for potential duplicates and merge them.'}
          </p>
          <button
            class="nav-btn"
            onClick={() => props.onNavigate('contact-duplicates')}
            aria-label={
              t('contacts.settings.find_duplicates') || 'Find and manage duplicate contacts'
            }
          >
            {t('contacts.settings.find_duplicates') || 'Find Duplicates'}
          </button>
        </section>
      </Show>

      <nav class="bottom-nav" role="navigation" aria-label="Page navigation">
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label={t('contacts.title') || 'Contacts'}
        >
          {t('contacts.title') || 'Contacts'}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label={t('settings.title') || 'Settings'}
        >
          {t('settings.title') || 'Settings'}
        </button>
      </nav>
    </div>
  );
}

export default ContactSettings;
