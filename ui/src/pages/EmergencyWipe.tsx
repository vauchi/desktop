// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface EmergencyWipePageProps {
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
  ) => void;
}

interface ContactInfo {
  id: string;
  display_name: string;
}

interface EmergencyConfig {
  trusted_contact_ids: string[];
  message: string;
  include_location: boolean;
}

interface ShredReport {
  contacts_notified: number;
  relay_purge_sent: boolean;
  smk_destroyed: boolean;
  sqlite_destroyed: boolean;
  all_clear: boolean;
}

interface BroadcastResult {
  sent: number;
  total: number;
}

function EmergencyWipe(props: EmergencyWipePageProps) {
  // Emergency broadcast config
  const [emergencyConfig, setEmergencyConfig] = createSignal<EmergencyConfig | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  // Emergency broadcast dialog
  const [showConfigDialog, setShowConfigDialog] = createSignal(false);
  const [availableContacts, setAvailableContacts] = createSignal<ContactInfo[]>([]);
  const [selectedContactIds, setSelectedContactIds] = createSignal<Set<string>>(new Set());
  const [emergencyAlertMsg, setEmergencyAlertMsg] = createSignal(
    'I may be in danger. Please check on me.'
  );
  const [emergencyIncludeLocation, setEmergencyIncludeLocation] = createSignal(false);

  // Emergency wipe state
  const [showWipeConfirm, setShowWipeConfirm] = createSignal(false);
  const [wipeCountdown, setWipeCountdown] = createSignal(0);
  const [isWiping, setIsWiping] = createSignal(false);
  const [wipeComplete, setWipeComplete] = createSignal(false);
  const [wipeReport, setWipeReport] = createSignal<ShredReport | null>(null);

  // Feedback
  const [errorMessage, setErrorMessage] = createSignal('');
  const [successMessage, setSuccessMessage] = createSignal('');

  let countdownTimer: ReturnType<typeof setInterval> | undefined;

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  onMount(async () => {
    setIsLoading(true);
    try {
      const ec = (await invoke('get_emergency_config')) as EmergencyConfig | null;
      setEmergencyConfig(ec);
      if (ec) {
        setEmergencyAlertMsg(ec.message);
        setEmergencyIncludeLocation(ec.include_location);
      }
    } catch (e) {
      console.error('Failed to load emergency config:', e);
    }
    setIsLoading(false);
  });

  onCleanup(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }
  });

  // --- Emergency Broadcast ---

  const handleSaveConfig = async () => {
    clearMessages();
    const ids = Array.from(selectedContactIds());
    if (ids.length === 0) {
      setErrorMessage('Please select at least one trusted contact');
      return;
    }
    if (ids.length > 10) {
      setErrorMessage('Maximum 10 trusted contacts allowed');
      return;
    }
    try {
      await invoke('save_emergency_config', {
        config: {
          trusted_contact_ids: ids,
          message: emergencyAlertMsg(),
          include_location: emergencyIncludeLocation(),
        },
      });
      setEmergencyConfig({
        trusted_contact_ids: ids,
        message: emergencyAlertMsg(),
        include_location: emergencyIncludeLocation(),
      });
      setShowConfigDialog(false);
      showSuccess('Emergency broadcast configured');
    } catch (e) {
      setErrorMessage(`Failed to save: ${e}`);
    }
  };

  const handleDisableConfig = async () => {
    clearMessages();
    try {
      await invoke('delete_emergency_config');
      setEmergencyConfig(null);
      setEmergencyAlertMsg('I may be in danger. Please check on me.');
      setEmergencyIncludeLocation(false);
      showSuccess('Emergency broadcast disabled');
    } catch (e) {
      setErrorMessage(`Failed to disable: ${e}`);
    }
  };

  const handleSendBroadcast = async () => {
    clearMessages();
    const contactCount = emergencyConfig()?.trusted_contact_ids?.length ?? 0;
    if (
      !window.confirm(
        `Send emergency alert to ${contactCount} trusted contact${
          contactCount !== 1 ? 's' : ''
        }? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const result = (await invoke('send_emergency_broadcast')) as BroadcastResult;
      showSuccess(`Alert queued for ${result.sent} of ${result.total} contacts`);
    } catch (e) {
      setErrorMessage(`Failed to send: ${e}`);
    }
  };

  // --- Emergency Wipe with Countdown ---

  const WIPE_COUNTDOWN_SECONDS = 10;

  const startWipeCountdown = () => {
    setShowWipeConfirm(true);
    setWipeCountdown(WIPE_COUNTDOWN_SECONDS);

    countdownTimer = setInterval(() => {
      setWipeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          countdownTimer = undefined;
          executeWipe();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelWipe = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
    setShowWipeConfirm(false);
    setWipeCountdown(0);
  };

  const executeWipe = async () => {
    setIsWiping(true);
    setShowWipeConfirm(false);
    try {
      const result = (await invoke('panic_shred')) as ShredReport;
      setWipeReport(result);
      setWipeComplete(true);
    } catch (e) {
      setIsWiping(false);
      setErrorMessage(`Emergency wipe failed: ${e}`);
    }
  };

  return (
    <div
      class="page settings"
      role="main"
      aria-labelledby="emergency-page-title"
      aria-busy={isLoading()}
    >
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Go back to settings"
        >
          {`\u2190 ${t('action.back')}`}
        </button>
        <h1 id="emergency-page-title">Emergency Features</h1>
      </header>

      <Show when={isLoading()}>
        <div class="loading" role="status" aria-live="polite">
          Loading emergency settings...
        </div>
      </Show>

      <Show when={successMessage()}>
        <p class="success-message" role="status" aria-live="polite">
          {successMessage()}
        </p>
      </Show>
      <Show when={errorMessage()}>
        <p class="error" role="alert" aria-live="assertive">
          {errorMessage()}
        </p>
      </Show>

      <Show when={!isLoading() && !wipeComplete()}>
        {/* Emergency Broadcast Section */}
        <section class="settings-section" aria-labelledby="broadcast-section-title">
          <h2 id="broadcast-section-title">Emergency Broadcast</h2>
          <p class="setting-description">
            Send encrypted alerts to trusted contacts when you feel unsafe. Alerts are
            indistinguishable from regular sync traffic on the network, providing plausible
            deniability.
          </p>

          <div class="setting-item">
            <span class="setting-label">Status</span>
            <span class="setting-value">
              {emergencyConfig()
                ? `Configured (${emergencyConfig()!.trusted_contact_ids.length} contact${
                    emergencyConfig()!.trusted_contact_ids.length !== 1 ? 's' : ''
                  })`
                : 'Not configured'}
            </span>
          </div>

          <Show when={emergencyConfig()}>
            <div class="setting-item">
              <span class="setting-label">Alert Message</span>
              <span class="setting-value">{emergencyConfig()!.message}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Include Location</span>
              <span class="setting-value">
                {emergencyConfig()!.include_location ? 'Yes' : 'No'}
              </span>
            </div>
          </Show>

          <div class="setting-buttons">
            <button
              class="secondary"
              onClick={async () => {
                clearMessages();
                try {
                  const contacts = (await invoke('list_contacts')) as ContactInfo[];
                  setAvailableContacts(contacts);
                  const existing = emergencyConfig()?.trusted_contact_ids || [];
                  setSelectedContactIds(new Set(existing));
                } catch {
                  setAvailableContacts([]);
                }
                setShowConfigDialog(true);
              }}
              aria-label="Configure emergency broadcast"
            >
              {emergencyConfig() ? 'Edit Configuration' : 'Configure'}
            </button>
            <Show when={emergencyConfig()}>
              <button
                class="primary"
                onClick={handleSendBroadcast}
                aria-label="Send emergency broadcast now"
              >
                Send Alert Now
              </button>
              <button
                class="danger"
                onClick={handleDisableConfig}
                aria-label="Disable emergency broadcast"
              >
                Disable
              </button>
            </Show>
          </div>
        </section>

        {/* Emergency Data Wipe Section */}
        <section class="settings-section" aria-labelledby="wipe-section-title">
          <h2 id="wipe-section-title">Emergency Data Wipe</h2>
          <p class="setting-description">
            Immediately and irreversibly destroy all data on this device. This is a last resort
            measure for situations where your data is at risk of being compromised.
          </p>

          <div class="setting-item">
            <span class="setting-label">What will be destroyed</span>
          </div>
          <ul class="wipe-details-list" aria-label="Data that will be destroyed">
            <li>All contacts and contact cards</li>
            <li>Your identity and encryption keys</li>
            <li>All ratchet session states</li>
            <li>Pending updates and message queue</li>
            <li>Local database (SQLite)</li>
            <li>Symmetric Master Key (SMK)</li>
          </ul>

          <div class="setting-item">
            <span class="setting-label">Additional actions</span>
          </div>
          <ul class="wipe-details-list" aria-label="Additional wipe actions">
            <li>Contacts will be notified of account deletion</li>
            <li>Relay server will be asked to purge stored data</li>
          </ul>

          <p class="setting-description warning-text">
            This action cannot be undone. No grace period. Make sure you have a backup if you want
            to recover your identity later.
          </p>

          <div class="setting-buttons">
            <button
              class="danger"
              onClick={startWipeCountdown}
              disabled={isWiping()}
              aria-label="Start emergency data wipe with countdown"
            >
              Emergency Wipe
            </button>
          </div>
        </section>
      </Show>

      {/* Wipe Complete Report */}
      <Show when={wipeComplete()}>
        <section class="settings-section" aria-labelledby="wipe-complete-title">
          <h2 id="wipe-complete-title">Wipe Complete</h2>
          <Show
            when={wipeReport()?.all_clear}
            fallback={
              <p class="setting-description warning-text" role="alert">
                Wipe completed with warnings. Some operations may not have succeeded. Check the
                details below.
              </p>
            }
          >
            <p class="success-message" role="status" aria-live="polite">
              All data has been destroyed successfully.
            </p>
          </Show>

          <Show when={wipeReport()}>
            <div class="setting-item">
              <span class="setting-label">Contacts Notified</span>
              <span class="setting-value">{wipeReport()!.contacts_notified}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Relay Purge Sent</span>
              <span class="setting-value">{wipeReport()!.relay_purge_sent ? 'Yes' : 'No'}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Master Key Destroyed</span>
              <span class="setting-value">{wipeReport()!.smk_destroyed ? 'Yes' : 'No'}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Database Destroyed</span>
              <span class="setting-value">{wipeReport()!.sqlite_destroyed ? 'Yes' : 'No'}</span>
            </div>
          </Show>
        </section>
      </Show>

      {/* Wipe In Progress */}
      <Show when={isWiping() && !wipeComplete()}>
        <section class="settings-section" aria-labelledby="wipe-progress-title" aria-busy="true">
          <h2 id="wipe-progress-title">Destroying Data...</h2>
          <p class="setting-description" role="status" aria-live="polite">
            Emergency wipe in progress. Do not close the application.
          </p>
          <div class="wipe-progress-indicator" aria-label="Wipe in progress">
            <div class="wipe-progress-spinner" />
          </div>
        </section>
      </Show>

      {/* ======= DIALOGS ======= */}

      {/* Emergency Wipe Countdown Dialog */}
      <Show when={showWipeConfirm()}>
        <div class="dialog-overlay" role="presentation">
          <div
            class="dialog wipe-countdown-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wipe-countdown-title"
            aria-describedby="wipe-countdown-description"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="wipe-countdown-title">Emergency Data Wipe</h3>
            <p id="wipe-countdown-description">
              All data will be <strong>permanently destroyed</strong> in:
            </p>
            <div
              class="wipe-countdown-display"
              role="timer"
              aria-live="assertive"
              aria-atomic="true"
            >
              <span class="countdown-number">{wipeCountdown()}</span>
              <span class="countdown-label">seconds</span>
            </div>
            <p class="setting-description">
              This includes your identity, contacts, encryption keys, and all local data. This
              action is <strong>irreversible</strong>.
            </p>
            <div class="dialog-actions">
              <button class="primary" onClick={cancelWipe} aria-label="Cancel emergency wipe">
                Cancel Wipe
              </button>
              <button
                class="danger"
                onClick={() => {
                  cancelWipe();
                  executeWipe();
                }}
                aria-label="Wipe now without waiting"
              >
                Wipe Now
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Emergency Broadcast Configuration Dialog */}
      <Show when={showConfigDialog()}>
        <div
          class="dialog-overlay"
          onClick={() => setShowConfigDialog(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowConfigDialog(false);
          }}
          role="presentation"
        >
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-dialog-title"
            aria-describedby="emergency-dialog-description"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="emergency-dialog-title">Emergency Broadcast Configuration</h3>
            <p id="emergency-dialog-description" class="setting-description">
              Choose up to 10 trusted contacts to receive an encrypted alert. Alerts are
              indistinguishable from normal sync traffic on the wire.
            </p>

            <Show when={errorMessage()}>
              <p class="error" role="alert">
                {errorMessage()}
              </p>
            </Show>

            <fieldset class="contact-picker" aria-label="Select trusted contacts">
              <legend>Trusted Contacts (max 10)</legend>
              <Show
                when={availableContacts().length > 0}
                fallback={<p class="empty-fields">No contacts available. Exchange cards first.</p>}
              >
                <ul class="contact-picker-list">
                  <For each={availableContacts()}>
                    {(contact) => (
                      <li class="contact-picker-item">
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedContactIds().has(contact.id)}
                            onChange={() => {
                              const ids = new Set(selectedContactIds());
                              if (ids.has(contact.id)) {
                                ids.delete(contact.id);
                              } else if (ids.size < 10) {
                                ids.add(contact.id);
                              }
                              setSelectedContactIds(ids);
                            }}
                            disabled={
                              !selectedContactIds().has(contact.id) &&
                              selectedContactIds().size >= 10
                            }
                            aria-label={`Select ${contact.display_name} as trusted contact`}
                          />
                          <span>{contact.display_name}</span>
                        </label>
                      </li>
                    )}
                  </For>
                </ul>
                <p class="setting-description">{selectedContactIds().size} of 10 selected</p>
              </Show>
            </fieldset>

            <label>
              Alert Message
              <input
                type="text"
                value={emergencyAlertMsg()}
                onInput={(e) => setEmergencyAlertMsg(e.currentTarget.value)}
                placeholder="I may be in danger. Please check on me."
                aria-label="Emergency alert message"
              />
            </label>

            <div class="accessibility-toggle">
              <label for="emergency-location-toggle">
                Include Location
                <span class="toggle-description">Attach device location to the alert</span>
              </label>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  id="emergency-location-toggle"
                  checked={emergencyIncludeLocation()}
                  onChange={() => setEmergencyIncludeLocation(!emergencyIncludeLocation())}
                />
                <span class="toggle-slider" aria-hidden="true" />
              </div>
            </div>

            <div class="dialog-actions">
              <button
                class="secondary"
                onClick={() => setShowConfigDialog(false)}
                aria-label="Cancel emergency broadcast configuration"
              >
                {t('action.cancel')}
              </button>
              <button
                class="primary"
                onClick={handleSaveConfig}
                aria-label="Save emergency broadcast configuration"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </Show>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class="nav-btn" onClick={() => props.onNavigate('home')} aria-label="Go to Home">
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
          class="nav-btn active"
          onClick={() => props.onNavigate('settings')}
          aria-current="page"
          aria-label="Settings (current page)"
        >
          {t('nav.settings')}
        </button>
      </nav>
    </div>
  );
}

export default EmergencyWipe;
