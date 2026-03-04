// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, Show, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface FieldInfo {
  id: string;
  field_type: string;
  label: string;
  value: string;
}

interface ContactDetails {
  id: string;
  display_name: string;
  verified: boolean;
  recovery_trusted: boolean;
  fields: FieldInfo[];
}

interface ContactMergeProps {
  primaryId: string;
  secondaryId: string;
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
  onComplete?: () => void;
}

async function fetchContact(id: string): Promise<ContactDetails> {
  return await invoke('get_contact', { id });
}

function ContactMerge(props: ContactMergeProps) {
  const [primary] = createResource(() => props.primaryId, fetchContact);
  const [secondary] = createResource(() => props.secondaryId, fetchContact);
  const [error, setError] = createSignal('');
  const [merging, setMerging] = createSignal(false);
  const [merged, setMerged] = createSignal(false);
  const [swapped, setSwapped] = createSignal(false);

  const effectivePrimaryId = () => (swapped() ? props.secondaryId : props.primaryId);
  const effectiveSecondaryId = () => (swapped() ? props.primaryId : props.secondaryId);
  const effectivePrimary = () => (swapped() ? secondary() : primary());
  const effectiveSecondary = () => (swapped() ? primary() : secondary());

  const handleMerge = async () => {
    const pId = effectivePrimaryId();
    const sId = effectiveSecondaryId();

    if (
      !window.confirm(
        t('contacts.merge.confirm_message') ||
          `This will merge the secondary contact into the primary contact. The secondary contact will be deleted. This cannot be undone. Continue?`
      )
    ) {
      return;
    }

    setMerging(true);
    setError('');
    try {
      await invoke('merge_contacts', { primaryId: pId, secondaryId: sId });
      setMerged(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setMerging(false);
    }
  };

  const swapPrimary = () => {
    setSwapped(!swapped());
  };

  const handleKeyDown = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  /** Find fields that exist in secondary but not in primary (by type+label). */
  const uniqueSecondaryFields = () => {
    const p = effectivePrimary();
    const s = effectiveSecondary();
    if (!p || !s) return [];

    const primaryKeys = new Set(p.fields.map((f) => `${f.field_type}:${f.label}`));
    return s.fields.filter((f) => !primaryKeys.has(`${f.field_type}:${f.label}`));
  };

  /** Find fields that exist in both contacts (by type+label). */
  const sharedFields = () => {
    const p = effectivePrimary();
    const s = effectiveSecondary();
    if (!p || !s) return [];

    const primaryMap = new Map(p.fields.map((f) => [`${f.field_type}:${f.label}`, f]));
    return s.fields
      .filter((f) => primaryMap.has(`${f.field_type}:${f.label}`))
      .map((secField) => {
        const priField = primaryMap.get(`${secField.field_type}:${secField.label}`)!;
        return {
          label: secField.label,
          field_type: secField.field_type,
          primaryValue: priField.value,
          secondaryValue: secField.value,
          same: priField.value === secField.value,
        };
      });
  };

  return (
    <div class="page contacts" role="main" aria-labelledby="merge-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('contact-duplicates')}
          aria-label={t('contacts.merge.back_to_duplicates') || 'Back to duplicates'}
        >
          {t('action.back') || 'Back'}
        </button>
        <h1 id="merge-title">{t('contacts.merge.title') || 'Merge Contacts'}</h1>
      </header>

      <Show when={error()}>
        <p class="error" role="alert" aria-live="assertive">
          {error()}
        </p>
      </Show>

      <Show when={merged()}>
        <div class="success" role="status" aria-live="polite">
          <p>{t('contacts.merge.success') || 'Contacts merged successfully.'}</p>
          <button
            class="nav-btn"
            onClick={() => {
              if (props.onComplete) props.onComplete();
              props.onNavigate('contact-duplicates');
            }}
            aria-label={t('contacts.merge.back_to_duplicates') || 'Back to duplicates'}
          >
            {t('contacts.merge.back_to_duplicates') || 'Back to Duplicates'}
          </button>
          <button
            class="nav-btn"
            onClick={() => props.onNavigate('contacts')}
            aria-label={t('contacts.title') || 'Back to contacts'}
          >
            {t('contacts.title') || 'Contacts'}
          </button>
        </div>
      </Show>

      <Show when={!merged()}>
        <Show when={primary.loading || secondary.loading}>
          <p role="status" aria-live="polite" aria-busy="true">
            {t('contacts.merge.loading') || 'Loading contact details...'}
          </p>
        </Show>

        <Show when={effectivePrimary() && effectiveSecondary()}>
          <p class="setting-description">
            {t('contacts.merge.description') ||
              'The primary contact will be kept. Unique fields from the secondary contact will be added to it. The secondary contact will be deleted.'}
          </p>

          {/* Contact Comparison */}
          <section aria-labelledby="comparison-title">
            <h2 id="comparison-title">
              {t('contacts.merge.comparison') || 'Contact Comparison'}
            </h2>

            <div class="delivery-records-list">
              {/* Primary Contact */}
              <div
                class="delivery-record-item"
                role="group"
                aria-label={t('contacts.merge.primary') || 'Primary contact'}
              >
                <div class="record-header">
                  <span class="record-status success">
                    {t('contacts.merge.primary') || 'Primary (Keep)'}
                  </span>
                </div>
                <div class="record-details">
                  <span class="setting-label">{effectivePrimary()!.display_name}</span>
                  <span class="setting-description">
                    {effectivePrimary()!.fields.length}{' '}
                    {t('contacts.merge.fields') || 'fields'}
                    {effectivePrimary()!.verified
                      ? ` - ${t('contacts.merge.verified') || 'Verified'}`
                      : ''}
                  </span>
                </div>
                <div class="record-details">
                  <For each={effectivePrimary()!.fields}>
                    {(field) => (
                      <div class="record-details">
                        <span class="count-label">{field.label}</span>
                        <span class="count-value">{field.value}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Secondary Contact */}
              <div
                class="delivery-record-item"
                role="group"
                aria-label={t('contacts.merge.secondary') || 'Secondary contact'}
              >
                <div class="record-header">
                  <span class="record-status warning">
                    {t('contacts.merge.secondary') || 'Secondary (Delete)'}
                  </span>
                </div>
                <div class="record-details">
                  <span class="setting-label">{effectiveSecondary()!.display_name}</span>
                  <span class="setting-description">
                    {effectiveSecondary()!.fields.length}{' '}
                    {t('contacts.merge.fields') || 'fields'}
                    {effectiveSecondary()!.verified
                      ? ` - ${t('contacts.merge.verified') || 'Verified'}`
                      : ''}
                  </span>
                </div>
                <div class="record-details">
                  <For each={effectiveSecondary()!.fields}>
                    {(field) => (
                      <div class="record-details">
                        <span class="count-label">{field.label}</span>
                        <span class="count-value">{field.value}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            <button
              class="small"
              onClick={swapPrimary}
              onKeyDown={(e) => handleKeyDown(e, swapPrimary)}
              aria-label={t('contacts.merge.swap') || 'Swap primary and secondary'}
            >
              {t('contacts.merge.swap') || 'Swap Primary/Secondary'}
            </button>
          </section>

          {/* Shared Fields Comparison */}
          <Show when={sharedFields().length > 0}>
            <section aria-labelledby="shared-fields-title">
              <h2 id="shared-fields-title">
                {t('contacts.merge.shared_fields') || 'Shared Fields'}
              </h2>
              <p class="setting-description">
                {t('contacts.merge.shared_description') ||
                  'These fields exist in both contacts. The primary value will be kept.'}
              </p>
              <div class="delivery-records-list" role="list">
                <For each={sharedFields()}>
                  {(field) => (
                    <div class="delivery-record-item" role="listitem">
                      <div class="record-header">
                        <span class="setting-label">{field.label}</span>
                        <Show when={field.same}>
                          <span class="record-status success">
                            {t('contacts.merge.same') || 'Same'}
                          </span>
                        </Show>
                        <Show when={!field.same}>
                          <span class="record-status warning">
                            {t('contacts.merge.different') || 'Different'}
                          </span>
                        </Show>
                      </div>
                      <div class="record-details">
                        <span class="count-label">
                          {t('contacts.merge.primary') || 'Primary'}:
                        </span>
                        <span class="count-value">{field.primaryValue}</span>
                      </div>
                      <Show when={!field.same}>
                        <div class="record-details">
                          <span class="count-label">
                            {t('contacts.merge.secondary') || 'Secondary'}:
                          </span>
                          <span class="count-value">{field.secondaryValue}</span>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>

          {/* Unique Fields to Add */}
          <Show when={uniqueSecondaryFields().length > 0}>
            <section aria-labelledby="unique-fields-title">
              <h2 id="unique-fields-title">
                {t('contacts.merge.unique_fields') || 'Fields to Add'}
              </h2>
              <p class="setting-description">
                {t('contacts.merge.unique_description') ||
                  'These fields from the secondary contact will be added to the primary contact.'}
              </p>
              <div class="delivery-records-list" role="list">
                <For each={uniqueSecondaryFields()}>
                  {(field) => (
                    <div class="delivery-record-item" role="listitem">
                      <div class="record-details">
                        <span class="count-label">{field.label}</span>
                        <span class="count-value">{field.value}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>

          {/* Merge Action */}
          <section aria-labelledby="merge-action-title">
            <h2 id="merge-action-title" class="visually-hidden">
              {t('contacts.merge.action') || 'Merge action'}
            </h2>
            <div class="delivery-action-buttons">
              <button
                class="nav-btn primary"
                onClick={handleMerge}
                onKeyDown={(e) => handleKeyDown(e, handleMerge)}
                disabled={merging()}
                aria-label={
                  t('contacts.merge.merge_button') ||
                  `Merge ${effectiveSecondary()!.display_name} into ${effectivePrimary()!.display_name}`
                }
              >
                {merging()
                  ? (t('contacts.merge.merging') || 'Merging...')
                  : (t('contacts.merge.merge_button') || 'Merge Contacts')}
              </button>
              <button
                class="small"
                onClick={() => props.onNavigate('contact-duplicates')}
                aria-label={t('action.cancel') || 'Cancel'}
              >
                {t('action.cancel') || 'Cancel'}
              </button>
            </div>
          </section>
        </Show>
      </Show>

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

export default ContactMerge;
