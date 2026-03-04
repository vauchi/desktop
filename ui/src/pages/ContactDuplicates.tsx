// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface DuplicatePairInfo {
  id1: string;
  name1: string;
  id2: string;
  name2: string;
  similarity: number;
}

interface ContactDuplicatesProps {
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
  onMerge?: (primaryId: string, secondaryId: string) => void;
}

async function fetchDuplicates(): Promise<DuplicatePairInfo[]> {
  return await invoke('find_duplicates');
}

function formatSimilarity(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function ContactDuplicates(props: ContactDuplicatesProps) {
  const [duplicates, { refetch }] = createResource(fetchDuplicates);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [dismissingPair, setDismissingPair] = createSignal<string | null>(null);

  const dismissDuplicate = async (id1: string, id2: string) => {
    const pairKey = `${id1}-${id2}`;
    setDismissingPair(pairKey);
    try {
      await invoke('dismiss_duplicate', { contactIdA: id1, contactIdB: id2 });
      setError('');
      setSuccess(t('contacts.duplicates.dismissed') || 'Duplicate suggestion dismissed');
      refetch();
    } catch (e) {
      setError(String(e));
      setSuccess('');
    } finally {
      setDismissingPair(null);
    }
  };

  const handleMerge = (primaryId: string, secondaryId: string) => {
    if (props.onMerge) {
      props.onMerge(primaryId, secondaryId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div class="page contacts" role="main" aria-labelledby="duplicates-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label={t('contacts.duplicates.back_to_contacts') || 'Back to contacts'}
        >
          {t('action.back') || 'Back'}
        </button>
        <h1 id="duplicates-title">
          {t('contacts.duplicates.title') || 'Potential Duplicates'}
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

      <section aria-labelledby="duplicates-list-title">
        <h2 id="duplicates-list-title" class="visually-hidden">
          {t('contacts.duplicates.list_heading') || 'Duplicate contact pairs'}
        </h2>

        <Show when={duplicates.loading}>
          <p role="status" aria-live="polite" aria-busy="true">
            {t('contacts.duplicates.loading') || 'Scanning for duplicates...'}
          </p>
        </Show>

        <Show when={duplicates.error}>
          <p class="error" role="alert">
            {t('contacts.duplicates.error') || 'Failed to scan for duplicates.'}
          </p>
        </Show>

        <Show when={duplicates() && duplicates()!.length === 0}>
          <div class="empty-state" role="status">
            <p>{t('contacts.duplicates.none_found') || 'No potential duplicates found.'}</p>
            <p class="setting-description">
              {t('contacts.duplicates.none_description') ||
                'All your contacts appear to be unique.'}
            </p>
          </div>
        </Show>

        <Show when={duplicates() && duplicates()!.length > 0}>
          <p class="setting-description">
            {t('contacts.duplicates.description') ||
              'These contacts appear similar and may be duplicates. You can merge them or dismiss the suggestion.'}
          </p>
          <div class="delivery-records-list" role="list" aria-label={t('contacts.duplicates.list_label') || 'Duplicate contact pairs'}>
            <For each={duplicates()}>
              {(pair) => (
                <div
                  class="delivery-record-item"
                  role="listitem"
                  aria-label={`${pair.name1} and ${pair.name2}, ${formatSimilarity(pair.similarity)} similar`}
                >
                  <div class="record-header">
                    <span class="record-status accent">
                      {formatSimilarity(pair.similarity)}
                    </span>
                    <span class="setting-label">
                      {t('contacts.duplicates.similarity') || 'Similarity'}
                    </span>
                  </div>
                  <div class="record-details">
                    <div class="duplicate-contact-names">
                      <span class="setting-label" title={pair.id1}>{pair.name1}</span>
                      <span class="setting-description">&amp;</span>
                      <span class="setting-label" title={pair.id2}>{pair.name2}</span>
                    </div>
                  </div>
                  <div class="delivery-action-buttons">
                    <button
                      class="nav-btn"
                      onClick={() => handleMerge(pair.id1, pair.id2)}
                      onKeyDown={(e) => handleKeyDown(e, () => handleMerge(pair.id1, pair.id2))}
                      aria-label={`${t('contacts.duplicates.merge') || 'Merge'} ${pair.name1} ${t('contacts.duplicates.and') || 'and'} ${pair.name2}`}
                    >
                      {t('contacts.duplicates.merge') || 'Merge'}
                    </button>
                    <button
                      class="small"
                      onClick={() => dismissDuplicate(pair.id1, pair.id2)}
                      onKeyDown={(e) =>
                        handleKeyDown(e, () => dismissDuplicate(pair.id1, pair.id2))
                      }
                      disabled={dismissingPair() === `${pair.id1}-${pair.id2}`}
                      aria-label={`${t('contacts.duplicates.dismiss') || 'Dismiss'} ${pair.name1} ${t('contacts.duplicates.and') || 'and'} ${pair.name2}`}
                    >
                      {dismissingPair() === `${pair.id1}-${pair.id2}`
                        ? (t('contacts.duplicates.dismissing') || 'Dismissing...')
                        : (t('contacts.duplicates.dismiss') || 'Not Duplicates')}
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <nav class="bottom-nav" role="navigation" aria-label="Page navigation">
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label={t('contacts.title') || 'Contacts'}
        >
          {t('contacts.title') || 'Contacts'}
        </button>
      </nav>
    </div>
  );
}

export default ContactDuplicates;
