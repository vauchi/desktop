// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, createMemo, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t, tArgs } from '../services/i18nService';

interface ContactInfo {
  id: string;
  display_name: string;
  verified: boolean;
}

interface FieldInfo {
  id: string;
  field_type: string;
  label: string;
  value: string;
}

interface OpenResult {
  success: boolean;
  action: string;
  uri: string | null;
  error: string | null;
}

interface ContactDetails {
  id: string;
  display_name: string;
  verified: boolean;
  fields: FieldInfo[];
}

interface VisibilityLevel {
  type: 'everyone' | 'nobody' | 'contacts';
  ids?: string[];
}

interface FieldVisibilityInfo {
  field_id: string;
  field_label: string;
  field_type: string;
  visibility: VisibilityLevel;
  can_see: boolean;
}

interface FingerprintInfo {
  their_fingerprint: string;
  our_fingerprint: string;
  formatted_their: string;
  formatted_our: string;
}

interface ContactsProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

async function fetchContacts(): Promise<ContactInfo[]> {
  return await invoke('list_contacts');
}

function Contacts(props: ContactsProps) {
  const [contacts, { refetch }] = createResource(fetchContacts);
  const [selectedContact, setSelectedContact] = createSignal<ContactDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [showVisibility, setShowVisibility] = createSignal(false);
  const [showVerification, setShowVerification] = createSignal(false);
  const [visibilityRules, setVisibilityRules] = createSignal<FieldVisibilityInfo[]>([]);
  const [fingerprint, setFingerprint] = createSignal<FingerprintInfo | null>(null);
  const [isVerifying, setIsVerifying] = createSignal(false);
  const [error, setError] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');

  // Filter contacts based on search query
  const filteredContacts = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return contacts() || [];

    return (contacts() || []).filter((c) => c.display_name.toLowerCase().includes(query));
  });

  const openContactDetail = async (contactId: string) => {
    try {
      const details = (await invoke('get_contact', { id: contactId })) as ContactDetails;
      setSelectedContact(details);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const closeDetail = () => {
    setSelectedContact(null);
    setShowDeleteConfirm(false);
    setShowVisibility(false);
    setShowVerification(false);
    setVisibilityRules([]);
    setFingerprint(null);
    setError('');
  };

  const loadFingerprint = async (contactId: string) => {
    try {
      const fp = (await invoke('get_contact_fingerprint', { id: contactId })) as FingerprintInfo;
      setFingerprint(fp);
      setShowVerification(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleVerifyContact = async () => {
    const contact = selectedContact();
    if (!contact) return;

    setIsVerifying(true);
    try {
      await invoke('verify_contact', { id: contact.id });
      // Refresh the contact details
      const details = (await invoke('get_contact', { id: contact.id })) as ContactDetails;
      setSelectedContact(details);
      setShowVerification(false);
      setFingerprint(null);
      refetch();
    } catch (e) {
      setError(String(e));
    }
    setIsVerifying(false);
  };

  const loadVisibilityRules = async (contactId: string) => {
    try {
      const rules = (await invoke('get_visibility_rules', { contactId })) as FieldVisibilityInfo[];
      setVisibilityRules(rules);
      setShowVisibility(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleFieldVisibility = async (fieldId: string, currentCanSee: boolean) => {
    const contact = selectedContact();
    if (!contact) return;

    try {
      const newVisibility: VisibilityLevel = currentCanSee
        ? { type: 'nobody' }
        : { type: 'everyone' };

      await invoke('set_field_visibility', {
        contactId: contact.id,
        fieldId,
        visibility: newVisibility,
      });

      // Reload visibility rules
      await loadVisibilityRules(contact.id);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async () => {
    const contact = selectedContact();
    if (!contact) return;

    try {
      await invoke('remove_contact', { id: contact.id });
      setSelectedContact(null);
      setShowDeleteConfirm(false);
      refetch();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleFieldClick = async (field: FieldInfo) => {
    try {
      const result = (await invoke('open_contact_field', {
        fieldType: field.field_type,
        label: field.label,
        value: field.value,
      })) as OpenResult;

      if (!result.success && result.error) {
        // If opening failed, copy to clipboard as fallback
        await navigator.clipboard.writeText(field.value);
        setError(`${result.error} Value copied to clipboard.`);
      }
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(field.value);
      setError(`Could not open. Copied to clipboard.`);
    }
  };

  const getFieldIcon = (fieldType: string): string => {
    switch (fieldType.toLowerCase()) {
      case 'phone':
        return '📞';
      case 'email':
        return '✉️';
      case 'website':
        return '🌐';
      case 'address':
        return '📍';
      case 'social':
        return '👤';
      default:
        return '📋';
    }
  };

  return (
    <div class="page contacts" role="main" aria-labelledby="contacts-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('home')}
          aria-label="Go back to home"
        >
          {t('action.back')}
        </button>
        <h1 id="contacts-title">{t('contacts.title')}</h1>
      </header>

      <div class="search-bar" role="search">
        <input
          type="text"
          placeholder={t('contacts.search')}
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          aria-label="Search contacts by name"
        />
        <Show when={searchQuery()}>
          <button class="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">
            ×
          </button>
        </Show>
      </div>

      <div class="contacts-list" role="list" aria-label="Contacts list">
        <For each={filteredContacts()}>
          {(contact) => (
            <div
              class="contact-item"
              role="listitem"
              tabIndex={0}
              onClick={() => openContactDetail(contact.id)}
              onKeyPress={(e) => e.key === 'Enter' && openContactDetail(contact.id)}
              aria-label={`${contact.display_name}, ${contact.verified ? 'verified' : 'not verified'}. Press Enter to view details.`}
            >
              <div class="contact-avatar" aria-hidden="true">
                {contact.display_name.charAt(0).toUpperCase()}
              </div>
              <div class="contact-info">
                <span class="contact-name">{contact.display_name}</span>
                <span class="contact-status">
                  {contact.verified ? t('contacts.verified') : t('contacts.not_verified')}
                </span>
              </div>
            </div>
          )}
        </For>

        {filteredContacts().length === 0 && searchQuery() && (
          <div class="empty-state" role="status" aria-live="polite">
            <p>No contacts match "{searchQuery()}"</p>
            <button class="secondary" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          </div>
        )}

        {contacts()?.length === 0 && !searchQuery() && (
          <div
            class="empty-state"
            role="status"
            aria-label="No contacts yet. Exchange cards with someone to add contacts."
          >
            <p>{t('contacts.empty')}</p>
            <button onClick={() => props.onNavigate('exchange')}>{t('exchange.title')}</button>
          </div>
        )}
      </div>

      {/* Contact Detail Dialog */}
      <Show when={selectedContact()}>
        <div class="dialog-overlay" onClick={closeDetail} role="presentation">
          <div
            class="dialog contact-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Show
              when={!showDeleteConfirm()}
              fallback={
                <div
                  class="delete-confirm"
                  role="alertdialog"
                  aria-labelledby="delete-confirm-title"
                  aria-describedby="delete-confirm-description"
                >
                  <h3 id="delete-confirm-title">{t('action.delete')}?</h3>
                  <p id="delete-confirm-description">
                    Are you sure you want to delete {selectedContact()?.display_name}?
                  </p>
                  <p class="warning" role="alert">
                    This action cannot be undone.
                  </p>
                  <div class="dialog-actions">
                    <button
                      class="danger"
                      onClick={handleDelete}
                      aria-label={`Delete ${selectedContact()?.display_name}`}
                    >
                      {t('action.delete')}
                    </button>
                    <button class="secondary" onClick={() => setShowDeleteConfirm(false)}>
                      {t('action.cancel')}
                    </button>
                  </div>
                </div>
              }
            >
              <div class="contact-header">
                <div class="contact-avatar large" aria-hidden="true">
                  {selectedContact()?.display_name.charAt(0).toUpperCase()}
                </div>
                <h3 id="contact-detail-title">{selectedContact()?.display_name}</h3>
                <span
                  class={selectedContact()?.verified ? 'verified' : 'not-verified'}
                  role="status"
                  aria-label={`Verification status: ${selectedContact()?.verified ? 'verified' : 'not verified'}`}
                >
                  {selectedContact()?.verified ? t('contacts.verified') : t('contacts.not_verified')}
                </span>
                <Show when={!selectedContact()?.verified}>
                  <button
                    class="small primary"
                    onClick={() => loadFingerprint(selectedContact()!.id)}
                    aria-label={`Verify ${selectedContact()?.display_name}'s identity`}
                  >
                    Verify Identity
                  </button>
                </Show>
              </div>

              <Show when={error()}>
                <p class="error" role="alert" aria-live="assertive">
                  {error()}
                </p>
              </Show>

              <div class="contact-fields" role="list" aria-label={t('contacts.detail')}>
                <Show when={selectedContact()?.fields.length === 0}>
                  <p class="empty-fields" role="status">
                    No contact information shared yet.
                  </p>
                </Show>
                <For each={selectedContact()?.fields}>
                  {(field) => (
                    <div
                      class="field-item clickable"
                      role="listitem"
                      tabIndex={0}
                      onClick={() => handleFieldClick(field)}
                      onKeyPress={(e) => e.key === 'Enter' && handleFieldClick(field)}
                      aria-label={`${field.label}: ${field.value}. Press Enter to open.`}
                    >
                      <span class="field-icon" aria-hidden="true">
                        {getFieldIcon(field.field_type)}
                      </span>
                      <div class="field-content">
                        <span class="field-label">{field.label}</span>
                        <span class="field-value">{field.value}</span>
                      </div>
                      <span class="field-action" aria-hidden="true">
                        →
                      </span>
                    </div>
                  )}
                </For>
              </div>

              <div class="contact-id">
                <span class="label">Contact ID</span>
                <span class="mono">{selectedContact()?.id.substring(0, 16)}...</span>
              </div>

              {/* Verification Section */}
              <Show when={showVerification() && fingerprint()}>
                <div
                  class="verification-section"
                  role="region"
                  aria-labelledby="verification-title"
                  aria-describedby="verification-instructions"
                >
                  <h4 id="verification-title">
                    Verify {selectedContact()?.display_name}'s Identity
                  </h4>
                  <p id="verification-instructions" class="verify-instructions">
                    Compare these fingerprints with {selectedContact()?.display_name} in person to
                    verify their identity.
                  </p>

                  <div
                    class="fingerprint-comparison"
                    role="group"
                    aria-label="Fingerprint comparison"
                  >
                    <div class="fingerprint-block">
                      <span class="fp-label" id="their-fp-label">
                        Their Fingerprint
                      </span>
                      <code class="fingerprint" aria-labelledby="their-fp-label">
                        {fingerprint()?.formatted_their}
                      </code>
                    </div>
                    <div class="fingerprint-block">
                      <span class="fp-label" id="our-fp-label">
                        Your Fingerprint
                      </span>
                      <code class="fingerprint" aria-labelledby="our-fp-label">
                        {fingerprint()?.formatted_our}
                      </code>
                    </div>
                  </div>

                  <p class="verify-warning" role="alert">
                    Only mark as verified if you have confirmed these fingerprints match the ones
                    shown on their device.
                  </p>

                  <div class="verification-actions">
                    <button
                      class="primary"
                      onClick={handleVerifyContact}
                      disabled={isVerifying()}
                      aria-busy={isVerifying()}
                      aria-label={
                        isVerifying()
                          ? 'Verifying contact'
                          : `Mark ${selectedContact()?.display_name} as verified`
                      }
                    >
                      {isVerifying() ? 'Verifying...' : 'Mark as Verified'}
                    </button>
                    <button
                      class="secondary"
                      onClick={() => {
                        setShowVerification(false);
                        setFingerprint(null);
                      }}
                      disabled={isVerifying()}
                      aria-label="Cancel verification"
                    >
                      {t('action.cancel')}
                    </button>
                  </div>
                </div>
              </Show>

              {/* Visibility Section */}
              <div class="visibility-section" role="region" aria-label={t('visibility.title')}>
                <Show
                  when={!showVisibility()}
                  fallback={
                    <div class="visibility-list">
                      <h4 id="visibility-title">What {selectedContact()?.display_name} can see:</h4>
                      <Show when={visibilityRules().length === 0}>
                        <p class="empty-fields" role="status">
                          You haven't added any fields to your card yet.
                        </p>
                      </Show>
                      <div role="list" aria-labelledby="visibility-title">
                        <For each={visibilityRules()}>
                          {(field) => (
                            <div class="visibility-item" role="listitem">
                              <span class="field-label" id={`visibility-label-${field.field_id}`}>
                                {field.field_label}
                              </span>
                              <button
                                class={field.can_see ? 'visible' : 'hidden'}
                                onClick={() => toggleFieldVisibility(field.field_id, field.can_see)}
                                aria-pressed={field.can_see}
                                aria-label={`${field.field_label}: ${field.can_see ? 'visible to contact' : 'hidden from contact'}. Click to toggle.`}
                              >
                                {field.can_see ? 'Visible' : 'Hidden'}
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                      <button class="secondary small" onClick={() => setShowVisibility(false)}>
                        Hide visibility settings
                      </button>
                    </div>
                  }
                >
                  <button
                    class="secondary"
                    onClick={() => loadVisibilityRules(selectedContact()!.id)}
                    aria-label={`Manage what ${selectedContact()?.display_name} can see from your card`}
                  >
                    Manage what they see
                  </button>
                </Show>
              </div>

              <div class="dialog-actions">
                <button class="secondary" onClick={closeDetail} aria-label="Close contact details">
                  Close
                </button>
                <button
                  class="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label={`Delete ${selectedContact()?.display_name} from contacts`}
                >
                  {t('action.delete')}
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class="nav-btn" onClick={() => props.onNavigate('home')} aria-label="Go to Home">
          Home
        </button>
        <button class="nav-btn active" aria-current="page" aria-label="Contacts (current page)">
          {t('contacts.title')}
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('exchange')}
          aria-label="Go to Exchange"
        >
          Exchange
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Go to Settings"
        >
          Settings
        </button>
      </nav>
    </div>
  );
}

export default Contacts;
