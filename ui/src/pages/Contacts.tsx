// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';
import ValidationBadge from '../components/ValidationBadge';
import { createFocusTrap } from '../utils/focusTrap';

interface ContactInfo {
  id: string;
  display_name: string;
  verified: boolean;
  recovery_trusted: boolean;
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

interface SecondaryAction {
  action_type: string;
  label: string;
}

interface ContactDetails {
  id: string;
  display_name: string;
  verified: boolean;
  recovery_trusted: boolean;
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

async function fetchHiddenContacts(): Promise<ContactInfo[]> {
  return await invoke('list_hidden_contacts');
}

async function searchContactsBackend(query: string): Promise<ContactInfo[]> {
  return await invoke('search_contacts', { query });
}

async function hideContact(id: string): Promise<void> {
  await invoke('hide_contact', { id });
}

async function unhideContact(id: string): Promise<void> {
  await invoke('unhide_contact', { id });
}

function Contacts(props: ContactsProps) {
  const [showHiddenContacts, setShowHiddenContacts] = createSignal(false);
  const [contacts, { refetch }] = createResource(fetchContacts);
  const [hiddenContacts, { refetch: refetchHidden }] = createResource(fetchHiddenContacts);
  const [selectedContact, setSelectedContact] = createSignal<ContactDetails | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [showVisibility, setShowVisibility] = createSignal(false);
  const [showVerification, setShowVerification] = createSignal(false);
  const [visibilityRules, setVisibilityRules] = createSignal<FieldVisibilityInfo[]>([]);
  const [fingerprint, setFingerprint] = createSignal<FingerprintInfo | null>(null);
  const [isVerifying, setIsVerifying] = createSignal(false);
  const [isTogglingTrust, setIsTogglingTrust] = createSignal(false);
  const [error, setError] = createSignal('');
  const [statusMessage, setStatusMessage] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);

  const [searchResults, setSearchResults] = createSignal<ContactInfo[] | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    field: FieldInfo;
    actions: SecondaryAction[];
  } | null>(null);

  // Keyboard shortcut listener for toggling hidden contacts view
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setShowHiddenContacts((prev) => !prev);
      }
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleClickAway = () => setContextMenu(null);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickAway);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickAway);
    });
  });

  // Use backend search when query is present, otherwise show all contacts
  const filteredContacts = createMemo(() => {
    if (searchQuery().trim()) {
      return searchResults() || [];
    }
    return showHiddenContacts() ? hiddenContacts() || [] : contacts() || [];
  });

  // Debounced backend search
  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout);
    if (!value.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        const results = await searchContactsBackend(value.trim());
        setSearchResults(results);
      } catch (e) {
        setError(String(e));
      }
    }, 300);
  };

  const openContactDetail = async (contactId: string) => {
    setTriggerElement(document.activeElement as HTMLElement);
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
    const trigger = triggerElement();
    if (trigger) {
      requestAnimationFrame(() => trigger.focus());
    }
    setTriggerElement(null);
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

  const handleToggleRecoveryTrust = async () => {
    const contact = selectedContact();
    if (!contact) return;

    setIsTogglingTrust(true);
    try {
      if (contact.recovery_trusted) {
        await invoke('untrust_contact', { id: contact.id });
      } else {
        await invoke('trust_contact', { id: contact.id });
      }
      // Refresh the contact details
      const details = (await invoke('get_contact', { id: contact.id })) as ContactDetails;
      setSelectedContact(details);
      refetch();
    } catch (e) {
      setError(String(e));
    }
    setIsTogglingTrust(false);
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
      refetchHidden();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleHideContact = async () => {
    const contact = selectedContact();
    if (!contact) return;

    try {
      await hideContact(contact.id);
      setSelectedContact(null);
      refetch();
      refetchHidden();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUnhideContact = async () => {
    const contact = selectedContact();
    if (!contact) return;

    try {
      await unhideContact(contact.id);
      setSelectedContact(null);
      refetch();
      refetchHidden();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleFieldContextMenu = async (e: MouseEvent, field: FieldInfo) => {
    e.preventDefault();
    try {
      const actions = (await invoke('get_secondary_actions', {
        fieldType: field.field_type,
        label: field.label,
        value: field.value,
      })) as SecondaryAction[];
      setContextMenu({ x: e.clientX, y: e.clientY, field, actions });
    } catch {
      // Fallback: just show copy option
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        field,
        actions: [{ action_type: 'copy', label: 'Copy to Clipboard' }],
      });
    }
  };

  const handleActionClick = async (actionType: string, field: FieldInfo) => {
    setContextMenu(null);
    if (actionType === 'copy') {
      await navigator.clipboard.writeText(field.value);
      setStatusMessage('Copied to clipboard');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }
    if (actionType === 'directions') {
      try {
        const url = (await invoke('get_directions_url', {
          fieldType: field.field_type,
          label: field.label,
          value: field.value,
        })) as string | null;
        if (url) {
          await invoke('open_contact_field', {
            fieldType: 'website',
            label: 'Directions',
            value: url,
          });
          return;
        }
      } catch {
        // Fall through to default handler
      }
    }
    await handleFieldClick(field);
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
        setStatusMessage(`${result.error} Value copied to clipboard.`);
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(field.value);
      setStatusMessage(`Could not open. Copied to clipboard.`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleListKeyDown = (e: KeyboardEvent) => {
    const list = e.currentTarget as HTMLElement;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[tabindex="0"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown' && currentIndex < items.length - 1) {
      e.preventDefault();
      items[currentIndex + 1].focus();
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      items[currentIndex - 1].focus();
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
      <header role="banner" class={showHiddenContacts() ? 'hidden-mode' : ''}>
        <button
          class="back-btn"
          onClick={() => props.onNavigate('home')}
          aria-label="Go back to home"
        >
          {t('action.back')}
        </button>
        <h1 id="contacts-title">
          {showHiddenContacts() ? 'Hidden Contacts' : t('contacts.title')}
        </h1>
        <Show when={showHiddenContacts()}>
          <span class="mode-indicator" aria-label="Hidden contacts mode active">
            🔒
          </span>
        </Show>
      </header>

      <div class="search-bar" role="search">
        <input
          type="text"
          placeholder={t('contacts.search')}
          value={searchQuery()}
          onInput={(e) => handleSearchInput(e.target.value)}
          aria-label="Search contacts by name"
        />
        <Show when={searchQuery()}>
          <button
            class="clear-search"
            onClick={() => {
              setSearchQuery('');
              setSearchResults(null);
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        </Show>
      </div>

      <Show when={filteredContacts().length > 0}>
        <ul class="contacts-list" aria-label="Contacts list" onKeyDown={handleListKeyDown}>
          <For each={filteredContacts()}>
            {(contact) => (
              <li
                class="contact-item"
                tabIndex={0}
                onClick={() => openContactDetail(contact.id)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') &&
                  (e.preventDefault(), openContactDetail(contact.id))
                }
                aria-label={`${contact.display_name}, ${contact.verified ? 'verified' : 'not verified'}. Press Enter to view details.`}
              >
                <div class="contact-avatar" aria-hidden="true">
                  {contact.display_name.charAt(0).toUpperCase()}
                </div>
                <div class="contact-info">
                  <span class="contact-name">{contact.display_name}</span>
                  <span class="contact-status">
                    {contact.verified ? t('contacts.verified') : t('contacts.not_verified')}
                    {contact.recovery_trusted && ' · Recovery Trusted'}
                  </span>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

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

      {/* Contact Detail Dialog */}
      <Show when={selectedContact()}>
        <div
          class="dialog-overlay"
          onClick={closeDetail}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDetail();
          }}
          role="presentation"
        >
          <div
            class="dialog contact-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-detail-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            ref={(el) => {
              const cleanup = createFocusTrap(el);
              onCleanup(cleanup);
            }}
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
                  {selectedContact()?.verified
                    ? t('contacts.verified')
                    : t('contacts.not_verified')}
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
                <Show when={selectedContact()?.recovery_trusted}>
                  <span class="recovery-trusted" role="status" aria-label="Recovery trusted">
                    Recovery Trusted
                  </span>
                </Show>
              </div>

              <div class="recovery-trust-section" role="region" aria-label="Recovery trust">
                <button
                  class={selectedContact()?.recovery_trusted ? 'secondary small' : 'small primary'}
                  onClick={handleToggleRecoveryTrust}
                  disabled={isTogglingTrust()}
                  aria-busy={isTogglingTrust()}
                  aria-label={
                    selectedContact()?.recovery_trusted
                      ? `Remove recovery trust from ${selectedContact()?.display_name}`
                      : `Trust ${selectedContact()?.display_name} for recovery`
                  }
                >
                  {isTogglingTrust()
                    ? '...'
                    : selectedContact()?.recovery_trusted
                      ? 'Remove Recovery Trust'
                      : 'Trust for Recovery'}
                </button>
              </div>

              <Show when={error()}>
                <p class="error" role="alert" aria-live="assertive">
                  {error()}
                </p>
              </Show>

              <Show when={statusMessage()}>
                <p class="success-message" role="status" aria-live="polite">
                  {statusMessage()}
                </p>
              </Show>

              <ul
                class="contact-fields"
                aria-label={t('contacts.detail')}
                onKeyDown={handleListKeyDown}
              >
                <Show when={selectedContact()?.fields.length === 0}>
                  <p class="empty-fields" role="status">
                    No contact information shared yet.
                  </p>
                </Show>
                <For each={selectedContact()?.fields}>
                  {(field) => (
                    <li
                      class="field-item clickable"
                      tabIndex={0}
                      onClick={() => handleFieldClick(field)}
                      onContextMenu={(e) => handleFieldContextMenu(e, field)}
                      onKeyDown={(e) =>
                        (e.key === 'Enter' || e.key === ' ') &&
                        (e.preventDefault(), handleFieldClick(field))
                      }
                      aria-label={`${field.label}: ${field.value}. Press Enter to open, right-click for more actions.`}
                    >
                      <span class="field-icon" aria-hidden="true">
                        {getFieldIcon(field.field_type)}
                      </span>
                      <div class="field-content">
                        <span class="field-label">{field.label}</span>
                        <span class="field-value">{field.value}</span>
                      </div>
                      <ValidationBadge
                        contactId={selectedContact()!.id}
                        fieldId={field.id}
                        fieldValue={field.value}
                      />
                      <span class="field-action" aria-hidden="true">
                        →
                      </span>
                    </li>
                  )}
                </For>
              </ul>

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
                      <ul aria-labelledby="visibility-title">
                        <For each={visibilityRules()}>
                          {(field) => (
                            <li class="visibility-item">
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
                            </li>
                          )}
                        </For>
                      </ul>
                      <button
                        class="secondary small"
                        onClick={() => setShowVisibility(false)}
                        aria-label="Hide visibility settings"
                      >
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
                <Show when={!showHiddenContacts()}>
                  <button
                    class="secondary"
                    onClick={handleHideContact}
                    aria-label={`Hide ${selectedContact()?.display_name} from contacts`}
                  >
                    Hide Contact
                  </button>
                </Show>
                <Show when={showHiddenContacts()}>
                  <button
                    class="primary"
                    onClick={handleUnhideContact}
                    aria-label={`Unhide ${selectedContact()?.display_name} and return to contacts`}
                  >
                    Unhide Contact
                  </button>
                </Show>
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

      {/* Context Menu */}
      <Show when={contextMenu()}>
        <div
          class="context-menu"
          role="menu"
          aria-label="Field actions"
          style={{
            position: 'fixed',
            left: `${contextMenu()!.x}px`,
            top: `${contextMenu()!.y}px`,
            'z-index': '1000',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={contextMenu()!.actions}>
            {(action) => (
              <button
                class="context-menu-item"
                role="menuitem"
                onClick={() => handleActionClick(action.action_type, contextMenu()!.field)}
              >
                {action.label}
              </button>
            )}
          </For>
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
