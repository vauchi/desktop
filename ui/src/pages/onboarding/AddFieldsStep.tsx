// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../services/i18nService';

interface FieldEntry {
  fieldType: string;
  label: string;
  value: string;
}

const FIELD_TYPES = [
  {
    type: 'phone',
    icon: '\uD83D\uDCF1',
    labelKey: 'onboarding.fields.phone',
    defaultLabel: 'Phone',
  },
  {
    type: 'email',
    icon: '\u2709\uFE0F',
    labelKey: 'onboarding.fields.email',
    defaultLabel: 'Email',
  },
  {
    type: 'website',
    icon: '\uD83C\uDF10',
    labelKey: 'onboarding.fields.website',
    defaultLabel: 'Website',
  },
  {
    type: 'social',
    icon: '\uD83D\uDC64',
    labelKey: 'onboarding.fields.social',
    defaultLabel: 'Social',
  },
];

interface AddFieldsStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function AddFieldsStep(props: AddFieldsStepProps) {
  const [fields, setFields] = createSignal<FieldEntry[]>([]);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [selectedType, setSelectedType] = createSignal('phone');
  const [fieldLabel, setFieldLabel] = createSignal('');
  const [fieldValue, setFieldValue] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const getPlaceholder = (type: string): string => {
    switch (type) {
      case 'phone':
        return t('onboarding.fields.phone_placeholder') || '+1 234 567 890';
      case 'email':
        return t('onboarding.fields.email_placeholder') || 'you@example.com';
      case 'website':
        return t('onboarding.fields.website_placeholder') || 'https://example.com';
      case 'social':
        return t('onboarding.fields.social_placeholder') || '@username';
      default:
        return '';
    }
  };

  const getDefaultLabel = (type: string): string => {
    const ft = FIELD_TYPES.find((f) => f.type === type);
    return ft ? t(ft.labelKey) || ft.defaultLabel : type;
  };

  const handleAddField = async () => {
    const value = fieldValue().trim();
    if (!value) {
      setError(t('error.validation') || 'Please enter a value');
      return;
    }

    setSaving(true);
    setError('');

    const label = fieldLabel().trim() || getDefaultLabel(selectedType());

    try {
      await invoke('add_field', {
        fieldType: selectedType(),
        label,
        value,
      });

      setFields([...fields(), { fieldType: selectedType(), label, value }]);
      setFieldLabel('');
      setFieldValue('');
      setShowAddForm(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveField = (index: number) => {
    const updated = [...fields()];
    updated.splice(index, 1);
    setFields(updated);
  };

  return (
    <div class="onboarding-step add-fields-step">
      <h2>{t('onboarding.fields.title') || 'Add Contact Details'}</h2>
      <p class="step-description">
        {t('onboarding.fields.description') ||
          'Add optional information to your card. You can always change this later.'}
      </p>

      {/* Added fields list */}
      <Show when={fields().length > 0}>
        <ul
          class="fields-list onboarding-fields"
          aria-label={t('onboarding.fields.added_label') || 'Added fields'}
        >
          <For each={fields()}>
            {(field, index) => {
              const ft = FIELD_TYPES.find((f) => f.type === field.fieldType);
              return (
                <li class="field-item">
                  <span class="field-icon" aria-hidden="true">
                    {ft?.icon || '\uD83D\uDCCB'}
                  </span>
                  <div class="field-content">
                    <span class="field-label">{field.label}</span>
                    <span class="field-value">{field.value}</span>
                  </div>
                  <button
                    type="button"
                    class="icon-btn danger"
                    onClick={() => handleRemoveField(index())}
                    aria-label={`${t('onboarding.fields.remove') || 'Remove'} ${field.label}`}
                  >
                    {'\u2715'}
                  </button>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>

      {/* Add field form */}
      <Show
        when={showAddForm()}
        fallback={
          <div class="add-field-buttons">
            <For each={FIELD_TYPES}>
              {(ft) => (
                <button
                  type="button"
                  class="secondary add-field-type-btn"
                  onClick={() => {
                    setSelectedType(ft.type);
                    setFieldLabel(getDefaultLabel(ft.type));
                    setShowAddForm(true);
                  }}
                  aria-label={`${t('onboarding.fields.add') || 'Add'} ${t(ft.labelKey) || ft.defaultLabel}`}
                >
                  <span aria-hidden="true">{ft.icon}</span> {t(ft.labelKey) || ft.defaultLabel}
                </button>
              )}
            </For>
          </div>
        }
      >
        <div
          class="add-field-form"
          role="group"
          aria-label={t('onboarding.fields.add_form') || 'Add field'}
        >
          <div class="field-type-header">
            <span aria-hidden="true">
              {FIELD_TYPES.find((f) => f.type === selectedType())?.icon}
            </span>
            <strong>{getDefaultLabel(selectedType())}</strong>
          </div>

          <label for="field-label">
            {t('onboarding.fields.label_label') || 'Label (optional)'}
          </label>
          <input
            id="field-label"
            type="text"
            placeholder={getDefaultLabel(selectedType())}
            value={fieldLabel()}
            onInput={(e) => setFieldLabel(e.target.value)}
            disabled={saving()}
          />

          <label for="field-value">{t('onboarding.fields.value_label') || 'Value'}</label>
          <input
            id="field-value"
            type="text"
            placeholder={getPlaceholder(selectedType())}
            value={fieldValue()}
            onInput={(e) => setFieldValue(e.target.value)}
            disabled={saving()}
            aria-required="true"
            autofocus
          />

          {error() && (
            <p class="error" role="alert" aria-live="polite">
              {error()}
            </p>
          )}

          <div class="add-field-actions">
            <button
              type="button"
              class="secondary"
              onClick={() => {
                setShowAddForm(false);
                setError('');
              }}
              disabled={saving()}
            >
              {t('onboarding.cancel') || 'Cancel'}
            </button>
            <button type="button" onClick={handleAddField} disabled={saving()} aria-busy={saving()}>
              {saving()
                ? t('onboarding.fields.saving') || 'Saving...'
                : t('onboarding.fields.add_field') || 'Add Field'}
            </button>
          </div>
        </div>
      </Show>

      <div class="step-actions step-actions-split">
        <button type="button" class="secondary" onClick={() => props.onBack()}>
          {t('onboarding.back') || 'Back'}
        </button>
        <div class="step-actions-right">
          <Show when={fields().length === 0}>
            <button type="button" class="text-btn" onClick={() => props.onSkip()}>
              {t('onboarding.skip') || 'Skip for now'}
            </button>
          </Show>
          <button type="button" onClick={() => props.onNext()}>
            {t('onboarding.next') || 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddFieldsStep;
