// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, Show, For, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface DuressSettingsPageProps {
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

interface DuressAlertSettings {
  alert_contact_ids: string[];
  alert_message: string;
  include_location: boolean;
}

interface ContactInfo {
  id: string;
  display_name: string;
}

function DuressSettings(props: DuressSettingsPageProps) {
  // Password and duress status
  const [passwordEnabled, setPasswordEnabled] = createSignal(false);
  const [duressEnabled, setDuressEnabled] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);

  // App password setup
  const [showPasswordDialog, setShowPasswordDialog] = createSignal(false);
  const [appPassword, setAppPassword] = createSignal('');
  const [appPasswordConfirm, setAppPasswordConfirm] = createSignal('');

  // Duress PIN setup
  const [showDuressDialog, setShowDuressDialog] = createSignal(false);
  const [currentPassword, setCurrentPassword] = createSignal('');
  const [duressPin, setDuressPin] = createSignal('');
  const [dressPinConfirm, setDressPinConfirm] = createSignal('');

  // Change duress PIN
  const [showChangeDuressDialog, setShowChangeDuressDialog] = createSignal(false);
  const [changeCurrentPassword, setChangeCurrentPassword] = createSignal('');
  const [newDuressPin, setNewDuressPin] = createSignal('');
  const [newDressPinConfirm, setNewDressPinConfirm] = createSignal('');

  // Disable duress
  const [showDisableConfirm, setShowDisableConfirm] = createSignal(false);
  const [disablePassword, setDisablePassword] = createSignal('');

  // Duress test
  const [showDuressTest, setShowDuressTest] = createSignal(false);
  const [duressTestInput, setDuressTestInput] = createSignal('');
  const [duressTestResult, setDuressTestResult] = createSignal('');

  // Duress alert settings
  const [duressAlertSettings, setDuressAlertSettings] = createSignal<DuressAlertSettings | null>(
    null
  );
  const [showDuressAlertDialog, setShowDuressAlertDialog] = createSignal(false);
  const [duressAlertContacts, setDuressAlertContacts] = createSignal<ContactInfo[]>([]);
  const [selectedDuressAlertIds, setSelectedDuressAlertIds] = createSignal<Set<string>>(new Set());
  const [duressAlertMessage, setDuressAlertMessage] = createSignal('I may be under duress.');
  const [duressAlertIncludeLocation, setDuressAlertIncludeLocation] = createSignal(false);

  // Decoy contacts
  const [decoyContacts, setDecoyContacts] = createSignal<ContactInfo[]>([]);
  const [showAddDecoyDialog, setShowAddDecoyDialog] = createSignal(false);
  const [newDecoyName, setNewDecoyName] = createSignal('');
  const [decoyMessage, setDecoyMessage] = createSignal('');

  // Feedback
  const [errorMessage, setErrorMessage] = createSignal('');
  const [successMessage, setSuccessMessage] = createSignal('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  onMount(async () => {
    setIsLoading(true);
    try {
      const status = (await invoke('get_duress_status')) as {
        password_enabled: boolean;
        duress_enabled: boolean;
      };
      setPasswordEnabled(status.password_enabled);
      setDuressEnabled(status.duress_enabled);
    } catch (e) {
      console.error('Failed to load duress status:', e);
    }

    try {
      const ds = (await invoke('get_duress_settings')) as DuressAlertSettings | null;
      setDuressAlertSettings(ds);
      if (ds) {
        setDuressAlertMessage(ds.alert_message);
        setDuressAlertIncludeLocation(ds.include_location);
      }
    } catch (e) {
      console.error('Failed to load duress alert settings:', e);
    }

    try {
      const decoys = (await invoke('list_decoy_contacts')) as ContactInfo[];
      setDecoyContacts(decoys);
    } catch (e) {
      console.error('Failed to load decoy contacts:', e);
    }

    setIsLoading(false);
  });

  // --- App Password ---

  const handleSetupPassword = async () => {
    clearMessages();
    if (appPassword().length < 4) {
      setErrorMessage('Password must be at least 4 characters');
      return;
    }
    if (appPassword() !== appPasswordConfirm()) {
      setErrorMessage('Passwords do not match');
      return;
    }
    try {
      await invoke('setup_app_password', { password: appPassword() });
      setPasswordEnabled(true);
      setShowPasswordDialog(false);
      setAppPassword('');
      setAppPasswordConfirm('');
      showSuccess('App password set successfully');
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  // --- Duress PIN Setup ---

  const handleSetupDuress = async () => {
    clearMessages();
    if (duressPin().length < 4) {
      setErrorMessage('Duress PIN must be at least 4 characters');
      return;
    }
    if (duressPin() !== dressPinConfirm()) {
      setErrorMessage('PINs do not match');
      return;
    }
    try {
      await invoke('enable_duress_password', {
        password: currentPassword(),
        duressPassword: duressPin(),
      });
      setDuressEnabled(true);
      setShowDuressDialog(false);
      setCurrentPassword('');
      setDuressPin('');
      setDressPinConfirm('');
      showSuccess('Duress PIN configured successfully');
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  // --- Change Duress PIN ---

  const handleChangeDuressPin = async () => {
    clearMessages();
    if (newDuressPin().length < 4) {
      setErrorMessage('New duress PIN must be at least 4 characters');
      return;
    }
    if (newDuressPin() !== newDressPinConfirm()) {
      setErrorMessage('PINs do not match');
      return;
    }
    try {
      await invoke('enable_duress_password', {
        password: changeCurrentPassword(),
        duressPassword: newDuressPin(),
      });
      setShowChangeDuressDialog(false);
      setChangeCurrentPassword('');
      setNewDuressPin('');
      setNewDressPinConfirm('');
      showSuccess('Duress PIN changed successfully');
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  // --- Disable Duress ---

  const handleDisableDuress = async () => {
    clearMessages();
    try {
      await invoke('disable_duress_password', { password: disablePassword() });
      setDuressEnabled(false);
      setDuressAlertSettings(null);
      setShowDisableConfirm(false);
      setDisablePassword('');
      showSuccess('Duress PIN disabled');
    } catch (e) {
      setErrorMessage(String(e));
    }
  };

  // --- Test Duress ---

  const handleTestDuress = async () => {
    const pin = duressTestInput().trim();
    if (!pin) {
      setDuressTestResult('Please enter a PIN to test');
      return;
    }
    try {
      const result = (await invoke('test_duress_auth', { password: pin })) as { mode: string };
      if (result.mode === 'duress') {
        setDuressTestResult(
          'Duress mode detected. In a real scenario, alerts would be sent and decoy contacts shown.'
        );
      } else if (result.mode === 'normal') {
        setDuressTestResult('Normal unlock. No alerts would be triggered.');
      } else {
        setDuressTestResult('Invalid PIN. Authentication would fail.');
      }
    } catch (e) {
      setDuressTestResult(String(e));
    }
  };

  // --- Duress Alert Settings ---

  const handleSaveDuressAlertSettings = async () => {
    clearMessages();
    try {
      const settings = {
        alert_contact_ids: Array.from(selectedDuressAlertIds()),
        alert_message: duressAlertMessage(),
        include_location: duressAlertIncludeLocation(),
      };
      await invoke('save_duress_settings', { settings });
      setDuressAlertSettings(settings);
      setShowDuressAlertDialog(false);
      showSuccess('Duress alert settings saved');
    } catch (e) {
      setErrorMessage(`Failed to save: ${e}`);
    }
  };

  // --- Decoy Contacts ---

  const handleAddDecoy = async () => {
    clearMessages();
    const name = newDecoyName().trim();
    if (!name) return;
    try {
      const result = (await invoke('add_decoy_contact', {
        input: { display_name: name },
      })) as ContactInfo;
      setDecoyContacts((prev) => [...prev, result]);
      setShowAddDecoyDialog(false);
      setNewDecoyName('');
      showSuccess('Decoy contact added');
    } catch (e) {
      setDecoyMessage(`Failed: ${e}`);
    }
  };

  const handleRemoveDecoy = async (id: string) => {
    try {
      await invoke('remove_decoy_contact', { id });
      setDecoyContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setDecoyMessage(`Failed to remove: ${e}`);
    }
  };

  const handleClearAllDecoys = async () => {
    try {
      await invoke('clear_decoy_contacts');
      setDecoyContacts([]);
      showSuccess('All decoy contacts removed');
    } catch (e) {
      setDecoyMessage(`Failed: ${e}`);
    }
  };

  return (
    <div
      class="page settings"
      role="main"
      aria-labelledby="duress-page-title"
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
        <h1 id="duress-page-title">Duress Protection</h1>
      </header>

      <Show when={isLoading()}>
        <div class="loading" role="status" aria-live="polite">
          Loading duress settings...
        </div>
      </Show>

      <Show when={!isLoading()}>
        {/* Status Overview */}
        <section class="settings-section" aria-labelledby="duress-status-title">
          <h2 id="duress-status-title">Status</h2>
          <p class="setting-description">
            Duress mode protects you when forced to unlock the app. A secondary PIN shows decoy
            contacts and silently alerts trusted contacts.
          </p>

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

          <div class="setting-item">
            <span class="setting-label">App Password</span>
            <span class="setting-value">{passwordEnabled() ? 'Enabled' : 'Not set'}</span>
          </div>

          <div class="setting-item">
            <span class="setting-label">Duress PIN</span>
            <span class="setting-value">{duressEnabled() ? 'Enabled' : 'Not configured'}</span>
          </div>
        </section>

        {/* Setup Section */}
        <section class="settings-section" aria-labelledby="duress-setup-title">
          <h2 id="duress-setup-title">Setup</h2>

          {/* Step 1: App Password (required before duress) */}
          <Show when={!passwordEnabled()}>
            <p class="setting-description">
              An app password is required before setting up duress mode. This password protects your
              data on every app launch.
            </p>
            <div class="setting-buttons">
              <button
                class="primary"
                onClick={() => {
                  clearMessages();
                  setAppPassword('');
                  setAppPasswordConfirm('');
                  setShowPasswordDialog(true);
                }}
                aria-label="Set up app password"
              >
                Set App Password
              </button>
            </div>
          </Show>

          {/* Step 2: Duress PIN (requires password) */}
          <Show when={passwordEnabled() && !duressEnabled()}>
            <p class="setting-description">
              Set a secondary PIN that, when entered instead of your password, triggers duress mode.
              The app will appear to unlock normally but show decoy contacts.
            </p>
            <div class="setting-buttons">
              <button
                class="primary"
                onClick={() => {
                  clearMessages();
                  setCurrentPassword('');
                  setDuressPin('');
                  setDressPinConfirm('');
                  setShowDuressDialog(true);
                }}
                aria-label="Set up duress PIN"
              >
                Set Duress PIN
              </button>
            </div>
          </Show>

          {/* Duress is enabled: management options */}
          <Show when={duressEnabled()}>
            <p class="setting-description">
              Duress PIN is active. When entered, contacts will be replaced with decoy data and
              trusted contacts will be silently alerted.
            </p>
            <div class="setting-buttons">
              <button
                class="secondary"
                onClick={() => {
                  clearMessages();
                  setChangeCurrentPassword('');
                  setNewDuressPin('');
                  setNewDressPinConfirm('');
                  setShowChangeDuressDialog(true);
                }}
                aria-label="Change duress PIN"
              >
                Change Duress PIN
              </button>
              <button
                class="secondary"
                onClick={() => {
                  setDuressTestInput('');
                  setDuressTestResult('');
                  setShowDuressTest(true);
                }}
                aria-label="Test duress PIN without triggering alerts"
              >
                Test Duress Mode
              </button>
              <button
                class="danger"
                onClick={() => {
                  clearMessages();
                  setDisablePassword('');
                  setShowDisableConfirm(true);
                }}
                aria-label="Disable duress PIN"
              >
                Disable Duress PIN
              </button>
            </div>
          </Show>
        </section>

        {/* Duress Behavior Configuration (only shown when enabled) */}
        <Show when={duressEnabled()}>
          <section class="settings-section" aria-labelledby="duress-behavior-title">
            <h2 id="duress-behavior-title">Duress Behavior</h2>
            <p class="setting-description">
              Configure what happens when the duress PIN is entered. These settings are only visible
              during normal authentication.
            </p>

            {/* Alert Recipients */}
            <div class="setting-item">
              <span class="setting-label">Alert Recipients</span>
              <span class="setting-value">
                {duressAlertSettings()
                  ? `${duressAlertSettings()!.alert_contact_ids.length} contact${
                      duressAlertSettings()!.alert_contact_ids.length !== 1 ? 's' : ''
                    }`
                  : 'Not configured'}
              </span>
            </div>
            <p class="setting-description">
              These contacts receive an encrypted alert when the duress PIN is used. The alert is
              indistinguishable from regular sync traffic.
            </p>

            <Show when={duressAlertSettings()}>
              <div class="setting-item">
                <span class="setting-label">Alert Message</span>
                <span class="setting-value">{duressAlertSettings()!.alert_message}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">Include Location</span>
                <span class="setting-value">
                  {duressAlertSettings()!.include_location ? 'Yes' : 'No'}
                </span>
              </div>
            </Show>

            <div class="setting-buttons">
              <button
                class="secondary"
                onClick={async () => {
                  try {
                    const contacts = (await invoke('list_contacts')) as ContactInfo[];
                    setDuressAlertContacts(contacts);
                    const existing = duressAlertSettings()?.alert_contact_ids || [];
                    setSelectedDuressAlertIds(new Set(existing));
                  } catch {
                    setDuressAlertContacts([]);
                  }
                  setShowDuressAlertDialog(true);
                }}
                aria-label="Configure duress alert recipients"
              >
                {duressAlertSettings() ? 'Edit Alert Settings' : 'Configure Alerts'}
              </button>
            </div>
          </section>

          {/* Decoy Contacts Section */}
          <section class="settings-section" aria-labelledby="decoy-contacts-title">
            <h2 id="decoy-contacts-title">Decoy Contacts</h2>
            <p class="setting-description">
              Fake contacts displayed instead of your real contacts when duress mode is active. Add
              realistic-looking names so the app appears normal to an observer.
            </p>

            <div class="setting-item">
              <span class="setting-label">Configured</span>
              <span class="setting-value">
                {decoyContacts().length} contact{decoyContacts().length !== 1 ? 's' : ''}
              </span>
            </div>

            <Show when={decoyContacts().length > 0}>
              <ul class="decoy-contact-list" aria-label="Decoy contacts">
                <For each={decoyContacts()}>
                  {(decoy) => (
                    <li class="decoy-contact-item">
                      <span>{decoy.display_name}</span>
                      <button
                        class="danger small"
                        onClick={() => handleRemoveDecoy(decoy.id)}
                        aria-label={`Remove decoy contact ${decoy.display_name}`}
                      >
                        Remove
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <Show when={decoyMessage()}>
              <p class="sync-message" role="status" aria-live="polite">
                {decoyMessage()}
              </p>
            </Show>

            <div class="setting-buttons">
              <button
                class="secondary"
                onClick={() => {
                  setNewDecoyName('');
                  setShowAddDecoyDialog(true);
                }}
                aria-label="Add a decoy contact"
              >
                Add Decoy Contact
              </button>
              <Show when={decoyContacts().length > 0}>
                <button
                  class="danger"
                  onClick={handleClearAllDecoys}
                  aria-label="Remove all decoy contacts"
                >
                  Clear All
                </button>
              </Show>
            </div>
          </section>
        </Show>

        {/* ======= DIALOGS ======= */}

        {/* Set App Password Dialog */}
        <Show when={showPasswordDialog()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowPasswordDialog(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowPasswordDialog(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="password-dialog-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="password-dialog-title">Set App Password</h3>
              <p class="setting-description">
                This password will be required every time you open the app. Choose something
                memorable but not easily guessed.
              </p>
              <Show when={errorMessage()}>
                <p class="error" role="alert">
                  {errorMessage()}
                </p>
              </Show>
              <label>
                Password
                <input
                  type="password"
                  value={appPassword()}
                  onInput={(e) => setAppPassword(e.currentTarget.value)}
                  placeholder="Enter password (min 4 characters)"
                  aria-label="App password"
                />
              </label>
              <label>
                Confirm Password
                <input
                  type="password"
                  value={appPasswordConfirm()}
                  onInput={(e) => setAppPasswordConfirm(e.currentTarget.value)}
                  placeholder="Confirm password"
                  aria-label="Confirm app password"
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowPasswordDialog(false)}
                  aria-label="Cancel setting app password"
                >
                  {t('action.cancel')}
                </button>
                <button class="primary" onClick={handleSetupPassword} aria-label="Set app password">
                  Set Password
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Set Duress PIN Dialog */}
        <Show when={showDuressDialog()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowDuressDialog(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDuressDialog(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="duress-dialog-title"
              aria-describedby="duress-dialog-description"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="duress-dialog-title">Set Duress PIN</h3>
              <p id="duress-dialog-description" class="setting-description">
                Your current app password is required to authorize this change. The duress PIN must
                be different from your app password.
              </p>
              <Show when={errorMessage()}>
                <p class="error" role="alert">
                  {errorMessage()}
                </p>
              </Show>
              <label>
                Current App Password
                <input
                  type="password"
                  value={currentPassword()}
                  onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                  placeholder="Enter your app password"
                  aria-label="Current app password for verification"
                />
              </label>
              <label>
                Duress PIN
                <input
                  type="password"
                  value={duressPin()}
                  onInput={(e) => setDuressPin(e.currentTarget.value)}
                  placeholder="Enter duress PIN (min 4 characters)"
                  aria-label="Duress PIN"
                />
              </label>
              <label>
                Confirm Duress PIN
                <input
                  type="password"
                  value={dressPinConfirm()}
                  onInput={(e) => setDressPinConfirm(e.currentTarget.value)}
                  placeholder="Confirm duress PIN"
                  aria-label="Confirm duress PIN"
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowDuressDialog(false)}
                  aria-label="Cancel setting duress PIN"
                >
                  {t('action.cancel')}
                </button>
                <button class="primary" onClick={handleSetupDuress} aria-label="Set duress PIN">
                  Set Duress PIN
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Change Duress PIN Dialog */}
        <Show when={showChangeDuressDialog()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowChangeDuressDialog(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowChangeDuressDialog(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-duress-dialog-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="change-duress-dialog-title">Change Duress PIN</h3>
              <p class="setting-description">
                Enter your current app password and choose a new duress PIN.
              </p>
              <Show when={errorMessage()}>
                <p class="error" role="alert">
                  {errorMessage()}
                </p>
              </Show>
              <label>
                Current App Password
                <input
                  type="password"
                  value={changeCurrentPassword()}
                  onInput={(e) => setChangeCurrentPassword(e.currentTarget.value)}
                  placeholder="Enter your app password"
                  aria-label="Current app password for verification"
                />
              </label>
              <label>
                New Duress PIN
                <input
                  type="password"
                  value={newDuressPin()}
                  onInput={(e) => setNewDuressPin(e.currentTarget.value)}
                  placeholder="Enter new duress PIN"
                  aria-label="New duress PIN"
                />
              </label>
              <label>
                Confirm New Duress PIN
                <input
                  type="password"
                  value={newDressPinConfirm()}
                  onInput={(e) => setNewDressPinConfirm(e.currentTarget.value)}
                  placeholder="Confirm new duress PIN"
                  aria-label="Confirm new duress PIN"
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowChangeDuressDialog(false)}
                  aria-label="Cancel changing duress PIN"
                >
                  {t('action.cancel')}
                </button>
                <button
                  class="primary"
                  onClick={handleChangeDuressPin}
                  aria-label="Change duress PIN"
                >
                  Change PIN
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Disable Duress Confirmation Dialog */}
        <Show when={showDisableConfirm()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowDisableConfirm(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDisableConfirm(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="disable-duress-title"
              aria-describedby="disable-duress-description"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="disable-duress-title">Disable Duress PIN</h3>
              <p id="disable-duress-description" class="setting-description">
                This will remove your duress PIN, alert settings, and decoy contacts. Enter your app
                password to confirm.
              </p>
              <Show when={errorMessage()}>
                <p class="error" role="alert">
                  {errorMessage()}
                </p>
              </Show>
              <label>
                App Password
                <input
                  type="password"
                  value={disablePassword()}
                  onInput={(e) => setDisablePassword(e.currentTarget.value)}
                  placeholder="Enter your app password"
                  aria-label="App password to disable duress"
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowDisableConfirm(false)}
                  aria-label="Cancel disabling duress"
                >
                  {t('action.cancel')}
                </button>
                <button
                  class="danger"
                  onClick={handleDisableDuress}
                  aria-label="Confirm disable duress PIN"
                >
                  Disable Duress PIN
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Test Duress Mode Dialog */}
        <Show when={showDuressTest()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowDuressTest(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDuressTest(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="duress-test-title"
              aria-describedby="duress-test-description"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="duress-test-title">Test Duress Mode</h3>
              <p id="duress-test-description" class="setting-description">
                Enter a PIN to test whether it triggers normal or duress mode. No alerts will be
                sent during this test.
              </p>
              <Show when={duressTestResult()}>
                <p class="sync-message" role="status" aria-live="polite">
                  {duressTestResult()}
                </p>
              </Show>
              <label>
                PIN
                <input
                  type="password"
                  value={duressTestInput()}
                  onInput={(e) => setDuressTestInput(e.currentTarget.value)}
                  placeholder="Enter PIN to test"
                  aria-label="PIN to test"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTestDuress();
                  }}
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowDuressTest(false)}
                  aria-label="Close test dialog"
                >
                  Close
                </button>
                <button class="primary" onClick={handleTestDuress} aria-label="Test this PIN">
                  Test
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Duress Alert Settings Dialog */}
        <Show when={showDuressAlertDialog()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowDuressAlertDialog(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDuressAlertDialog(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="duress-alert-dialog-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="duress-alert-dialog-title">Duress Alert Settings</h3>
              <p class="setting-description">
                Choose contacts to silently notify and customize the alert message sent when the
                duress PIN is used. Alerts are encrypted and indistinguishable from normal sync
                traffic.
              </p>

              <fieldset class="contact-picker" aria-label="Select alert recipients">
                <legend>Alert Recipients (max 5)</legend>
                <Show
                  when={duressAlertContacts().length > 0}
                  fallback={
                    <p class="empty-fields">No contacts available. Exchange cards first.</p>
                  }
                >
                  <ul class="contact-picker-list">
                    <For each={duressAlertContacts()}>
                      {(contact) => (
                        <li class="contact-picker-item">
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedDuressAlertIds().has(contact.id)}
                              onChange={() => {
                                const ids = new Set(selectedDuressAlertIds());
                                if (ids.has(contact.id)) {
                                  ids.delete(contact.id);
                                } else if (ids.size < 5) {
                                  ids.add(contact.id);
                                }
                                setSelectedDuressAlertIds(ids);
                              }}
                              disabled={
                                !selectedDuressAlertIds().has(contact.id) &&
                                selectedDuressAlertIds().size >= 5
                              }
                              aria-label={`Select ${contact.display_name} as alert recipient`}
                            />
                            <span>{contact.display_name}</span>
                          </label>
                        </li>
                      )}
                    </For>
                  </ul>
                  <p class="setting-description">{selectedDuressAlertIds().size} of 5 selected</p>
                </Show>
              </fieldset>

              <label>
                Alert Message
                <input
                  type="text"
                  value={duressAlertMessage()}
                  onInput={(e) => setDuressAlertMessage(e.currentTarget.value)}
                  placeholder="Message sent to alert recipients"
                  aria-label="Duress alert message"
                />
              </label>

              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={duressAlertIncludeLocation()}
                  onChange={() => setDuressAlertIncludeLocation(!duressAlertIncludeLocation())}
                />
                Include device location in alert
              </label>

              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowDuressAlertDialog(false)}
                  aria-label="Cancel duress alert settings"
                >
                  {t('action.cancel')}
                </button>
                <button
                  class="primary"
                  onClick={handleSaveDuressAlertSettings}
                  aria-label="Save duress alert settings"
                >
                  {t('action.save')}
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Add Decoy Contact Dialog */}
        <Show when={showAddDecoyDialog()}>
          <div
            class="dialog-overlay"
            onClick={() => setShowAddDecoyDialog(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowAddDecoyDialog(false);
            }}
            role="presentation"
          >
            <div
              class="dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-decoy-dialog-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="add-decoy-dialog-title">Add Decoy Contact</h3>
              <p class="setting-description">
                Create a fake contact name that will appear in duress mode. Use realistic names so
                the contact list looks natural.
              </p>
              <label>
                Display Name
                <input
                  type="text"
                  value={newDecoyName()}
                  onInput={(e) => setNewDecoyName(e.currentTarget.value)}
                  placeholder="e.g. John Smith"
                  aria-label="Decoy contact name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDecoyName().trim()) {
                      handleAddDecoy();
                    }
                  }}
                />
              </label>
              <div class="dialog-actions">
                <button
                  class="secondary"
                  onClick={() => setShowAddDecoyDialog(false)}
                  aria-label="Cancel adding decoy contact"
                >
                  {t('action.cancel')}
                </button>
                <button
                  class="primary"
                  disabled={!newDecoyName().trim()}
                  onClick={handleAddDecoy}
                  aria-label="Add decoy contact"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </Show>
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

export default DuressSettings;
