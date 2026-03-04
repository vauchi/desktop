// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../services/i18nService';

interface FieldInfo {
  id: string;
  field_type: string;
  label: string;
  value: string;
}

interface CardInfo {
  display_name: string;
  fields: FieldInfo[];
}

interface PreviewCardStepProps {
  displayName: string;
  onNext: () => void;
  onBack: () => void;
}

async function fetchCard(): Promise<CardInfo> {
  return await invoke('get_card');
}

function fieldTypeIcon(fieldType: string): string {
  switch (fieldType.toLowerCase()) {
    case 'phone':
      return '\uD83D\uDCF1';
    case 'email':
      return '\u2709\uFE0F';
    case 'website':
      return '\uD83C\uDF10';
    case 'social':
      return '\uD83D\uDC64';
    case 'address':
      return '\uD83D\uDCCD';
    default:
      return '\uD83D\uDCCB';
  }
}

function PreviewCardStep(props: PreviewCardStepProps) {
  const [card] = createResource(fetchCard);

  return (
    <div class="onboarding-step preview-card-step">
      <h2>{t('onboarding.preview.title') || 'Your Card Preview'}</h2>
      <p class="step-description">
        {t('onboarding.preview.description') || 'This is how your card will look to others when you exchange contacts.'}
      </p>

      <Show
        when={!card.loading}
        fallback={
          <div class="loading" role="status" aria-live="polite">
            {t('onboarding.preview.loading') || 'Loading card...'}
          </div>
        }
      >
        <div
          class="card-preview"
          role="region"
          aria-label={t('onboarding.preview.card_label') || 'Contact card preview'}
        >
          <div class="card-preview-header">
            <div class="card-avatar" aria-hidden="true">
              {(card()?.display_name || props.displayName || '?')[0].toUpperCase()}
            </div>
            <h3 class="card-name">
              {card()?.display_name || props.displayName}
            </h3>
          </div>

          <Show
            when={card()?.fields && card()!.fields.length > 0}
            fallback={
              <p class="card-empty-fields">
                {t('onboarding.preview.no_fields') || 'No contact details added yet.'}
              </p>
            }
          >
            <ul class="card-preview-fields" aria-label={t('onboarding.preview.fields_label') || 'Contact fields'}>
              <For each={card()?.fields}>
                {(field) => (
                  <li class="card-preview-field">
                    <span class="field-icon" aria-hidden="true">
                      {fieldTypeIcon(field.field_type)}
                    </span>
                    <div class="field-content">
                      <span class="field-label">{field.label}</span>
                      <span class="field-value">{field.value}</span>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>

      <div class="step-actions step-actions-split">
        <button type="button" class="secondary" onClick={props.onBack}>
          {t('onboarding.back') || 'Back'}
        </button>
        <button type="button" onClick={props.onNext}>
          {t('onboarding.next') || 'Next'}
        </button>
      </div>
    </div>
  );
}

export default PreviewCardStep;
