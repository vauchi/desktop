// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, For, createSignal, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t, tArgs } from '../services/i18nService';
import { checkAhaMoment, type AhaMoment } from '../services/ahaService';

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

interface IdentityInfo {
  display_name: string;
  public_id: string;
}

interface ContactFieldVisibility {
  contact_id: string;
  display_name: string;
  can_see: boolean;
}

interface VisibilityLevel {
  type: 'everyone' | 'nobody' | 'contacts';
  ids?: string[];
}

interface HomeProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

async function fetchCard(): Promise<CardInfo> {
  return await invoke('get_card');
}

async function fetchIdentity(): Promise<IdentityInfo> {
  return await invoke('get_identity_info');
}

function Home(props: HomeProps) {
  const [card, { refetch: refetchCard }] = createResource(fetchCard);
  const [identity] = createResource(fetchIdentity);
  const [showAddField, setShowAddField] = createSignal(false);
  const [selectedFieldId, setSelectedFieldId] = createSignal<string | null>(null);
  const [selectedFieldLabel, setSelectedFieldLabel] = createSignal('');
  const [fieldViewers, setFieldViewers] = createSignal<ContactFieldVisibility[]>([]);
  const [visibilityError, setVisibilityError] = createSignal('');
  const [editingField, setEditingField] = createSignal<FieldInfo | null>(null);
  const [editValue, setEditValue] = createSignal('');
  const [editError, setEditError] = createSignal('');
  const [isEditSaving, setIsEditSaving] = createSignal(false);
  const [ahaMoment, setAhaMoment] = createSignal<AhaMoment | null>(null);

  const triggerAhaMoment = async (momentType: string) => {
    const moment = await checkAhaMoment(momentType);
    if (moment) {
      setAhaMoment(moment);
      setTimeout(() => setAhaMoment(null), 4000);
    }
  };

  const openVisibilityDialog = async (field: FieldInfo) => {
    setSelectedFieldId(field.id);
    setSelectedFieldLabel(field.label);
    setVisibilityError('');
    try {
      const viewers = (await invoke('get_field_viewers', {
        fieldId: field.id,
      })) as ContactFieldVisibility[];
      setFieldViewers(viewers);
    } catch (e) {
      setVisibilityError(String(e));
    }
  };

  const closeVisibilityDialog = () => {
    setSelectedFieldId(null);
    setFieldViewers([]);
    setVisibilityError('');
  };

  const toggleContactVisibility = async (contactId: string, currentCanSee: boolean) => {
    const fieldId = selectedFieldId();
    if (!fieldId) return;

    try {
      const newVisibility: VisibilityLevel = currentCanSee
        ? { type: 'nobody' }
        : { type: 'everyone' };

      await invoke('set_field_visibility', {
        contactId,
        fieldId,
        visibility: newVisibility,
      });

      // Reload visibility status
      const viewers = (await invoke('get_field_viewers', { fieldId })) as ContactFieldVisibility[];
      setFieldViewers(viewers);
    } catch (e) {
      setVisibilityError(String(e));
    }
  };

  const setAllVisibility = async (canSee: boolean) => {
    const fieldId = selectedFieldId();
    if (!fieldId) return;

    const viewers = fieldViewers();
    try {
      const visibility: VisibilityLevel = canSee ? { type: 'everyone' } : { type: 'nobody' };

      for (const viewer of viewers) {
        await invoke('set_field_visibility', {
          contactId: viewer.contact_id,
          fieldId,
          visibility,
        });
      }

      // Reload visibility status
      const updatedViewers = (await invoke('get_field_viewers', {
        fieldId,
      })) as ContactFieldVisibility[];
      setFieldViewers(updatedViewers);
    } catch (e) {
      setVisibilityError(String(e));
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Delete this field? This cannot be undone.')) return;
    try {
      await invoke('remove_field', { fieldId });
      refetchCard();
    } catch (e) {
      console.error('Failed to delete field:', e);
    }
  };

  const openEditDialog = (field: FieldInfo) => {
    setEditingField(field);
    setEditValue(field.value);
    setEditError('');
  };

  const closeEditDialog = () => {
    setEditingField(null);
    setEditValue('');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    const field = editingField();
    if (!field) return;

    const newValue = editValue().trim();
    if (!newValue) {
      setEditError('Value cannot be empty');
      return;
    }

    setIsEditSaving(true);
    try {
      await invoke('update_field', { fieldId: field.id, newValue });
      refetchCard();
      closeEditDialog();
      triggerAhaMoment('first_edit');
    } catch (e) {
      setEditError(String(e));
    }
    setIsEditSaving(false);
  };

  const fieldIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'email':
        return 'mail';
      case 'phone':
        return 'phone';
      case 'website':
        return 'web';
      case 'address':
        return 'home';
      case 'social':
        return 'share';
      default:
        return 'note';
    }
  };

  return (
    <div class="page home" role="main" aria-labelledby="home-title">
      <header role="banner">
        <h1 id="home-title">{tArgs('home.greeting', { name: card()?.display_name || 'User' })}</h1>
        <p
          class="public-id"
          aria-label={`Your public ID: ${identity()?.public_id.substring(0, 16)}`}
        >
          {t('home.public_id') + ':'} {identity()?.public_id.substring(0, 16)}...
        </p>
      </header>

      <section class="card-section" aria-labelledby="card-section-title">
        <div class="section-header">
          <h2 id="card-section-title">{t('card.title')}</h2>
          <button
            class="icon-btn"
            onClick={() => setShowAddField(true)}
            aria-label="Add a new field to your card"
          >
            {t('card.add_field')}
          </button>
        </div>

        <div class="fields-list" role="list" aria-label="Your contact card fields">
          <For each={card()?.fields}>
            {(field) => (
              <div class="field-item" role="listitem" aria-label={`${field.label}: ${field.value}`}>
                <span class="field-icon" aria-hidden="true">
                  {fieldIcon(field.field_type)}
                </span>
                <div class="field-content">
                  <span class="field-label">{field.label}</span>
                  <span class="field-value">{field.value}</span>
                </div>
                <button
                  class="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(field);
                  }}
                  aria-label={`Edit ${field.label}`}
                >
                  {t('action.edit')}
                </button>
                <button
                  class="visibility-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openVisibilityDialog(field);
                  }}
                  aria-label={`Manage who can see ${field.label}`}
                >
                  {t('visibility.title')}
                </button>
                <button
                  class="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteField(field.id);
                  }}
                  aria-label={`Delete ${field.label}`}
                >
                  ×
                </button>
              </div>
            )}
          </For>

          {card()?.fields.length === 0 && (
            <p class="empty-state" role="status">
              {t('home.no_fields')}
            </p>
          )}
        </div>
      </section>

      <Show when={ahaMoment()}>
        <div class="aha-moment" role="status" aria-live="polite">
          <h2>{ahaMoment()!.title}</h2>
          <p>{ahaMoment()!.message}</p>
        </div>
      </Show>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class="nav-btn active" aria-current="page" aria-label="Home (current page)">
          {t('nav.home')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label="Go to Contacts"
        >
          {t('nav.contacts')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('exchange')}
          aria-label="Go to Exchange"
        >
          {t('nav.exchange')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Go to Settings"
        >
          {t('nav.settings')}
        </button>
      </nav>

      {showAddField() && (
        <AddFieldDialog
          onClose={() => setShowAddField(false)}
          onAdd={() => {
            refetchCard();
            setShowAddField(false);
            triggerAhaMoment('first_edit');
          }}
        />
      )}

      {/* Field Visibility Dialog */}
      <Show when={selectedFieldId()}>
        <div
          class="dialog-overlay"
          onClick={closeVisibilityDialog}
          onKeyDown={(e) => { if (e.key === 'Escape') closeVisibilityDialog(); }}
          role="presentation"
        >
          <div
            class="dialog visibility-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visibility-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="visibility-dialog-title">Who can see "{selectedFieldLabel()}"?</h3>

            <Show when={visibilityError()}>
              <p class="error" role="alert" aria-live="assertive">
                {visibilityError()}
              </p>
            </Show>

            <Show when={fieldViewers().length === 0}>
              <p class="empty-state" role="status">
                No contacts yet. Add contacts to manage visibility.
              </p>
            </Show>

            <Show when={fieldViewers().length > 0}>
              <div class="visibility-actions" role="group" aria-label="Bulk visibility actions">
                <button
                  class="small"
                  onClick={() => setAllVisibility(true)}
                  aria-label="Show this field to all contacts"
                >
                  Show to all
                </button>
                <button
                  class="small secondary"
                  onClick={() => setAllVisibility(false)}
                  aria-label="Hide this field from all contacts"
                >
                  Hide from all
                </button>
              </div>

              <div class="visibility-list" role="list" aria-label="Contact visibility settings">
                <For each={fieldViewers()}>
                  {(viewer) => (
                    <div class="visibility-item" role="listitem">
                      <div class="contact-avatar small" aria-hidden="true">
                        {viewer.display_name.charAt(0).toUpperCase()}
                      </div>
                      <span class="contact-name">{viewer.display_name}</span>
                      <button
                        class={viewer.can_see ? 'visible' : 'hidden'}
                        onClick={() => toggleContactVisibility(viewer.contact_id, viewer.can_see)}
                        aria-pressed={viewer.can_see}
                        aria-label={`${viewer.display_name}: ${viewer.can_see ? 'can see this field' : 'cannot see this field'}. Click to toggle.`}
                      >
                        {viewer.can_see ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <div class="dialog-actions">
              <button
                class="secondary"
                onClick={closeVisibilityDialog}
                aria-label="Close visibility settings"
              >
                {t('action.done')}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit Field Dialog */}
      <Show when={editingField()}>
        <div
          class="dialog-overlay"
          onClick={() => {
            if (!isEditSaving()) closeEditDialog();
          }}
          onKeyDown={(e) => { if (e.key === 'Escape' && !isEditSaving()) closeEditDialog(); }}
          role="presentation"
        >
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-dialog-title">{t('card.edit_field')} {editingField()?.label}</h3>

            <div class="form">
              <label for="edit-field-type">{t('card.field_type')}</label>
              <input
                id="edit-field-type"
                type="text"
                value={editingField()?.field_type || ''}
                disabled
                aria-readonly="true"
              />

              <label for="edit-field-value">{t('card.value')}</label>
              <input
                id="edit-field-value"
                type="text"
                value={editValue()}
                onInput={(e) => setEditValue(e.target.value)}
                placeholder={t('card.enter_value')}
                disabled={isEditSaving()}
                aria-describedby={editError() ? 'edit-error' : undefined}
                aria-invalid={editError() ? 'true' : undefined}
              />

              <Show when={editError()}>
                <p id="edit-error" class="error" role="alert" aria-live="assertive">
                  {editError()}
                </p>
              </Show>

              <div class="dialog-actions">
                <button
                  class="primary"
                  onClick={handleSaveEdit}
                  disabled={isEditSaving()}
                  aria-busy={isEditSaving()}
                  aria-label={isEditSaving() ? 'Saving changes' : 'Save changes'}
                >
                  {isEditSaving() ? 'Saving...' : t('action.save')}
                </button>
                <button
                  class="secondary"
                  onClick={closeEditDialog}
                  disabled={isEditSaving()}
                  aria-label="Cancel editing"
                >
                  {t('action.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface AddFieldDialogProps {
  onClose: () => void;
  onAdd: () => void;
}

function AddFieldDialog(props: AddFieldDialogProps) {
  const [fieldType, setFieldType] = createSignal('email');
  const [label, setLabel] = createSignal('');
  const [value, setValue] = createSignal('');
  const [error, setError] = createSignal('');

  const handleAdd = async () => {
    if (!label().trim() || !value().trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await invoke('add_field', {
        fieldType: fieldType(),
        label: label(),
        value: value(),
      });
      props.onAdd();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      class="dialog-overlay"
      onClick={props.onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') props.onClose(); }}
      role="presentation"
    >
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-field-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-field-title">{t('card.add_field')}</h3>

        <div class="form">
          <label for="add-field-type">{t('card.field_type')}</label>
          <select
            id="add-field-type"
            value={fieldType()}
            onChange={(e) => setFieldType(e.target.value)}
            aria-label="Field type"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="website">Website</option>
            <option value="address">Address</option>
            <option value="social">Social</option>
            <option value="custom">Custom</option>
          </select>

          <label for="add-field-label">{t('card.label')}</label>
          <input
            id="add-field-label"
            type="text"
            placeholder={t('card.enter_label')}
            value={label()}
            onInput={(e) => setLabel(e.target.value)}
            aria-required="true"
          />

          <label for="add-field-value">{t('card.value')}</label>
          <input
            id="add-field-value"
            type="text"
            placeholder={t('card.enter_value')}
            value={value()}
            onInput={(e) => setValue(e.target.value)}
            aria-required="true"
            aria-describedby={error() ? 'add-field-error' : undefined}
            aria-invalid={error() ? 'true' : undefined}
          />

          {error() && (
            <p id="add-field-error" class="error" role="alert" aria-live="assertive">
              {error()}
            </p>
          )}

          <div class="dialog-actions">
            <button class="secondary" onClick={props.onClose} aria-label="Cancel adding field">
              {t('action.cancel')}
            </button>
            <button onClick={handleAdd} aria-label="Add this field to your card">
              {t('card.add_field')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
