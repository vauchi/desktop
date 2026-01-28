// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, Show, For, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import {
  getAvailableThemes,
  selectTheme,
  getSelectedThemeId,
  type Theme,
} from '../services/themeService';
import {
  getAvailableLocales,
  setLocale,
  getSelectedLocale,
  type LocaleInfo,
} from '../services/i18nService';

interface IdentityInfo {
  display_name: string;
  public_id: string;
}

interface BackupResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

interface SyncStatus {
  pending_updates: number;
  last_sync: number | null;
  is_syncing: boolean;
}

interface SyncResult {
  contacts_added: number;
  cards_updated: number;
  updates_sent: number;
  success: boolean;
  error: string | null;
}

interface ContentSettings {
  enabled: boolean;
  content_url: string;
  check_interval_secs: number;
}

interface ContentUpdateStatus {
  has_updates: boolean;
  available_updates: string[];
  last_check: number | null;
  enabled: boolean;
  error: string | null;
}

interface SettingsProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery' | 'help'
  ) => void;
}

async function fetchIdentity(): Promise<IdentityInfo> {
  return await invoke('get_identity_info');
}

function Settings(props: SettingsProps) {
  const [identity, { refetch: refetchIdentity }] = createResource(fetchIdentity);
  const [showBackupDialog, setShowBackupDialog] = createSignal(false);
  const [showImportDialog, setShowImportDialog] = createSignal(false);
  const [backupPassword, setBackupPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [backupData, setBackupData] = createSignal('');
  const [backupError, setBackupError] = createSignal('');
  const [passwordStrength, setPasswordStrength] = createSignal('');
  const [importData, setImportData] = createSignal('');
  const [importPassword, setImportPassword] = createSignal('');
  const [importError, setImportError] = createSignal('');
  const [importSuccess, setImportSuccess] = createSignal('');
  const [editingName, setEditingName] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [nameError, setNameError] = createSignal('');

  // Sync state
  const [syncStatus, setSyncStatus] = createSignal<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [syncMessage, setSyncMessage] = createSignal('');

  // Relay URL state
  const [relayUrl, setRelayUrl] = createSignal('');
  const [editingRelay, setEditingRelay] = createSignal(false);
  const [newRelayUrl, setNewRelayUrl] = createSignal('');
  const [relayError, setRelayError] = createSignal('');

  // Content updates state
  const [contentUpdatesEnabled, setContentUpdatesEnabled] = createSignal(true);
  const [isCheckingContent, setIsCheckingContent] = createSignal(false);
  const [contentUpdateMessage, setContentUpdateMessage] = createSignal('');
  const [hasContentUpdates, setHasContentUpdates] = createSignal(false);

  // Accessibility settings state
  const [reduceMotion, setReduceMotion] = createSignal(false);
  const [highContrast, setHighContrast] = createSignal(false);
  const [largeTouchTargets, setLargeTouchTargets] = createSignal(false);

  // Theme and locale state
  const [availableThemes, setAvailableThemes] = createSignal<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = createSignal<string>('');
  const [availableLocales, setAvailableLocales] = createSignal<LocaleInfo[]>([]);
  const [selectedLocaleCode, setSelectedLocaleCode] = createSignal<string>('en');

  // Apply accessibility settings to document
  const applyAccessibilitySettings = () => {
    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion()));
    document.documentElement.setAttribute('data-high-contrast', String(highContrast()));
    document.documentElement.setAttribute('data-large-touch-targets', String(largeTouchTargets()));
  };

  // Load sync status, relay URL, and accessibility settings on mount
  onMount(async () => {
    try {
      const status = (await invoke('get_sync_status')) as SyncStatus;
      setSyncStatus(status);
    } catch (e) {
      console.error('Failed to get sync status:', e);
    }

    try {
      const url = (await invoke('get_relay_url')) as string;
      setRelayUrl(url);
    } catch (e) {
      console.error('Failed to get relay URL:', e);
    }

    // Load content update settings
    try {
      const settings = (await invoke('get_content_settings')) as ContentSettings;
      setContentUpdatesEnabled(settings.enabled);
    } catch (e) {
      console.error('Failed to get content settings:', e);
    }

    // Load accessibility settings from localStorage
    const savedReduceMotion = localStorage.getItem('a11y-reduce-motion') === 'true';
    const savedHighContrast = localStorage.getItem('a11y-high-contrast') === 'true';
    const savedLargeTouchTargets = localStorage.getItem('a11y-large-touch-targets') === 'true';

    setReduceMotion(savedReduceMotion);
    setHighContrast(savedHighContrast);
    setLargeTouchTargets(savedLargeTouchTargets);
    applyAccessibilitySettings();

    // Load themes and locales
    try {
      const themes = await getAvailableThemes();
      setAvailableThemes(themes);
      const currentThemeId = getSelectedThemeId() || 'default-dark';
      setSelectedThemeId(currentThemeId);
    } catch (e) {
      console.error('Failed to load themes:', e);
    }

    try {
      const locales = await getAvailableLocales();
      setAvailableLocales(locales);
      setSelectedLocaleCode(getSelectedLocale());
    } catch (e) {
      console.error('Failed to load locales:', e);
    }
  });

  const toggleReduceMotion = () => {
    const newValue = !reduceMotion();
    setReduceMotion(newValue);
    localStorage.setItem('a11y-reduce-motion', String(newValue));
    applyAccessibilitySettings();
  };

  const toggleHighContrast = () => {
    const newValue = !highContrast();
    setHighContrast(newValue);
    localStorage.setItem('a11y-high-contrast', String(newValue));
    applyAccessibilitySettings();
  };

  const toggleLargeTouchTargets = () => {
    const newValue = !largeTouchTargets();
    setLargeTouchTargets(newValue);
    localStorage.setItem('a11y-large-touch-targets', String(newValue));
    applyAccessibilitySettings();
  };

  const handleThemeChange = async (themeId: string) => {
    try {
      await selectTheme(themeId);
      setSelectedThemeId(themeId);
    } catch (e) {
      console.error('Failed to change theme:', e);
    }
  };

  const handleLocaleChange = (code: string) => {
    setLocale(code);
    setSelectedLocaleCode(code);
    // Reload page to apply locale changes fully
    window.location.reload();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('');

    try {
      const result = (await invoke('sync')) as SyncResult;
      if (result.success) {
        if (result.error) {
          setSyncMessage(result.error);
        } else {
          setSyncMessage(
            `Synced: ${result.cards_updated} cards updated, ${result.updates_sent} sent`
          );
        }
      } else {
        setSyncMessage(result.error || 'Sync failed');
      }

      // Refresh status
      const status = (await invoke('get_sync_status')) as SyncStatus;
      setSyncStatus(status);
    } catch (e) {
      setSyncMessage(String(e));
    }

    setIsSyncing(false);
  };

  const checkPassword = async () => {
    const password = backupPassword();
    if (password.length < 8) {
      setPasswordStrength('');
      return;
    }
    try {
      const strength = (await invoke('check_password_strength', { password })) as string;
      setPasswordStrength(strength);
    } catch {
      setPasswordStrength('');
    }
  };

  const handleExportBackup = async () => {
    setBackupError('');

    if (backupPassword() !== confirmPassword()) {
      setBackupError('Passwords do not match');
      return;
    }

    if (backupPassword().length < 8) {
      setBackupError('Password must be at least 8 characters');
      return;
    }

    try {
      // Check password strength
      await invoke('check_password_strength', { password: backupPassword() });

      // Export backup
      const result = (await invoke('export_backup', {
        password: backupPassword(),
      })) as BackupResult;

      if (result.success && result.data) {
        setBackupData(result.data);
        setBackupError('');
      } else {
        setBackupError(result.error || 'Export failed');
      }
    } catch (e) {
      setBackupError(String(e));
    }
  };

  const copyBackup = async () => {
    await navigator.clipboard.writeText(backupData());
  };

  const closeDialog = () => {
    setShowBackupDialog(false);
    setBackupPassword('');
    setConfirmPassword('');
    setBackupData('');
    setBackupError('');
    setPasswordStrength('');
  };

  const handleImportBackup = async () => {
    setImportError('');
    setImportSuccess('');

    if (!importData().trim()) {
      setImportError('Please paste your backup data');
      return;
    }

    if (!importPassword().trim()) {
      setImportError('Please enter your backup password');
      return;
    }

    try {
      const result = (await invoke('import_backup', {
        backupData: importData(),
        password: importPassword(),
      })) as string;
      setImportSuccess(result);
      setImportData('');
      setImportPassword('');
      refetchIdentity();
    } catch (e) {
      setImportError(String(e));
    }
  };

  const closeImportDialog = () => {
    setShowImportDialog(false);
    setImportData('');
    setImportPassword('');
    setImportError('');
    setImportSuccess('');
  };

  const startEditingName = () => {
    setNewName(identity()?.display_name || '');
    setNameError('');
    setEditingName(true);
  };

  const handleUpdateName = async () => {
    setNameError('');
    const name = newName().trim();
    if (!name) {
      setNameError('Display name cannot be empty');
      return;
    }
    if (name.length > 100) {
      setNameError('Display name cannot exceed 100 characters');
      return;
    }
    try {
      await invoke('update_display_name', { name });
      setEditingName(false);
      refetchIdentity();
    } catch (e) {
      setNameError(String(e));
    }
  };

  const cancelEditingName = () => {
    setEditingName(false);
    setNewName('');
    setNameError('');
  };

  const startEditingRelay = () => {
    setNewRelayUrl(relayUrl());
    setRelayError('');
    setEditingRelay(true);
  };

  const handleUpdateRelay = async () => {
    setRelayError('');
    const url = newRelayUrl().trim();

    // Validate URL format
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      setRelayError('URL must start with wss:// (or ws:// for local dev)');
      return;
    }

    try {
      new URL(url); // Validate URL format
    } catch {
      setRelayError('Invalid URL format');
      return;
    }

    try {
      await invoke('set_relay_url', { url });
      setRelayUrl(url);
      setEditingRelay(false);
    } catch (e) {
      setRelayError(String(e));
    }
  };

  const cancelEditingRelay = () => {
    setEditingRelay(false);
    setNewRelayUrl('');
    setRelayError('');
  };

  const toggleContentUpdates = async () => {
    const newValue = !contentUpdatesEnabled();
    try {
      await invoke('set_content_updates_enabled', { enabled: newValue });
      setContentUpdatesEnabled(newValue);
    } catch (e) {
      console.error('Failed to toggle content updates:', e);
    }
  };

  const checkContentUpdates = async () => {
    setIsCheckingContent(true);
    setContentUpdateMessage('');

    try {
      const status = (await invoke('check_content_updates')) as ContentUpdateStatus;
      if (status.error) {
        setContentUpdateMessage(status.error);
      } else if (status.has_updates) {
        setHasContentUpdates(true);
        setContentUpdateMessage(`Updates available: ${status.available_updates.join(', ')}`);
      } else {
        setContentUpdateMessage('Content is up to date');
      }
    } catch (e) {
      setContentUpdateMessage(String(e));
    }

    setIsCheckingContent(false);
  };

  const applyContentUpdates = async () => {
    setIsCheckingContent(true);
    setContentUpdateMessage('Applying updates...');

    try {
      await invoke('apply_content_updates');
      setHasContentUpdates(false);
      setContentUpdateMessage('Content updated successfully');
    } catch (e) {
      setContentUpdateMessage(String(e));
    }

    setIsCheckingContent(false);
  };

  return (
    <div class="page settings" role="main" aria-labelledby="settings-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('home')}
          aria-label="Go back to home"
        >
          ← Back
        </button>
        <h1 id="settings-title">Settings</h1>
      </header>

      <section class="settings-section" aria-labelledby="identity-section-title">
        <h2 id="identity-section-title">Identity</h2>
        <div class="setting-item">
          <span class="setting-label" id="display-name-label">
            Display Name
          </span>
          <Show
            when={editingName()}
            fallback={
              <div class="setting-value-row">
                <span class="setting-value" aria-labelledby="display-name-label">
                  {identity()?.display_name}
                </span>
                <button class="small" onClick={startEditingName} aria-label="Edit display name">
                  Edit
                </button>
              </div>
            }
          >
            <div class="edit-name-form" role="form" aria-label="Edit display name">
              <input
                type="text"
                value={newName()}
                onInput={(e) => setNewName(e.target.value)}
                placeholder="Enter display name"
                aria-label="New display name"
                aria-describedby={nameError() ? 'name-error' : undefined}
                aria-invalid={nameError() ? 'true' : undefined}
              />
              <div class="edit-actions">
                <button
                  class="small primary"
                  onClick={handleUpdateName}
                  aria-label="Save display name"
                >
                  Save
                </button>
                <button
                  class="small secondary"
                  onClick={cancelEditingName}
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
              </div>
              <Show when={nameError()}>
                <p id="name-error" class="error small" role="alert" aria-live="assertive">
                  {nameError()}
                </p>
              </Show>
            </div>
          </Show>
        </div>
        <div class="setting-item">
          <span class="setting-label" id="public-id-label">
            Public ID
          </span>
          <span class="setting-value mono" aria-labelledby="public-id-label">
            {identity()?.public_id}
          </span>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="devices-section-title">
        <h2 id="devices-section-title">Devices & Recovery</h2>
        <div class="setting-buttons" role="group" aria-label="Device and recovery options">
          <button
            class="secondary"
            onClick={() => props.onNavigate('devices')}
            aria-label="Manage linked devices"
          >
            Manage Devices
          </button>
          <button
            class="secondary"
            onClick={() => props.onNavigate('recovery')}
            aria-label="Configure recovery options"
          >
            Recovery Options
          </button>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="accessibility-section-title">
        <h2 id="accessibility-section-title">Accessibility</h2>
        <p class="setting-description" id="accessibility-description">
          Customize the app for your accessibility needs.
        </p>

        <div class="accessibility-toggle">
          <label for="reduce-motion-toggle">
            Reduce Motion
            <span class="toggle-description">Minimize animations and transitions</span>
          </label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="reduce-motion-toggle"
              checked={reduceMotion()}
              onChange={toggleReduceMotion}
              aria-describedby="accessibility-description"
            />
            <span class="toggle-slider" aria-hidden="true" />
          </div>
        </div>

        <div class="accessibility-toggle">
          <label for="high-contrast-toggle">
            High Contrast
            <span class="toggle-description">Increase color contrast for better visibility</span>
          </label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="high-contrast-toggle"
              checked={highContrast()}
              onChange={toggleHighContrast}
            />
            <span class="toggle-slider" aria-hidden="true" />
          </div>
        </div>

        <div class="accessibility-toggle">
          <label for="large-touch-toggle">
            Large Touch Targets
            <span class="toggle-description">
              Increase button and input sizes for easier interaction
            </span>
          </label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="large-touch-toggle"
              checked={largeTouchTargets()}
              onChange={toggleLargeTouchTargets}
            />
            <span class="toggle-slider" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="appearance-section-title">
        <h2 id="appearance-section-title">Appearance</h2>
        <p class="setting-description" id="appearance-description">
          Customize the look and language of the app.
        </p>

        <div class="setting-item">
          <span class="setting-label" id="theme-label">
            Theme
          </span>
          <select
            class="setting-select"
            value={selectedThemeId()}
            onChange={(e) => handleThemeChange(e.target.value)}
            aria-labelledby="theme-label"
          >
            <For each={availableThemes()}>
              {(theme) => (
                <option value={theme.id}>
                  {theme.name} ({theme.mode})
                </option>
              )}
            </For>
          </select>
        </div>

        <div class="setting-item">
          <span class="setting-label" id="language-label">
            Language
          </span>
          <select
            class="setting-select"
            value={selectedLocaleCode()}
            onChange={(e) => handleLocaleChange(e.target.value)}
            aria-labelledby="language-label"
          >
            <For each={availableLocales()}>
              {(locale) => (
                <option value={locale.code}>
                  {locale.name} ({locale.english_name})
                </option>
              )}
            </For>
          </select>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="sync-section-title">
        <h2 id="sync-section-title">Sync</h2>
        <p class="setting-description" id="sync-description">
          Synchronize your contact cards with the relay server.
        </p>

        <div class="setting-item">
          <span class="setting-label" id="relay-label">
            Relay Server
          </span>
          <Show
            when={editingRelay()}
            fallback={
              <div class="setting-value-row">
                <span class="setting-value mono small" aria-labelledby="relay-label">
                  {relayUrl() || 'Not configured'}
                </span>
                <button
                  class="small"
                  onClick={startEditingRelay}
                  aria-label="Edit relay server URL"
                >
                  Edit
                </button>
              </div>
            }
          >
            <div class="edit-relay-form" role="form" aria-label="Edit relay server">
              <input
                type="text"
                value={newRelayUrl()}
                onInput={(e) => setNewRelayUrl(e.target.value)}
                placeholder="wss://relay.example.com"
                aria-label="Relay server URL"
                aria-describedby={relayError() ? 'relay-error' : undefined}
                aria-invalid={relayError() ? 'true' : undefined}
              />
              <div class="edit-actions">
                <button
                  class="small primary"
                  onClick={handleUpdateRelay}
                  aria-label="Save relay URL"
                >
                  Save
                </button>
                <button
                  class="small secondary"
                  onClick={cancelEditingRelay}
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
              </div>
              <Show when={relayError()}>
                <p id="relay-error" class="error small" role="alert" aria-live="assertive">
                  {relayError()}
                </p>
              </Show>
            </div>
          </Show>
        </div>

        <Show when={syncStatus()}>
          <div class="setting-item" role="status" aria-live="polite">
            <span class="setting-label" id="pending-label">
              Pending Updates
            </span>
            <span class="setting-value" aria-labelledby="pending-label">
              {syncStatus()?.pending_updates || 0}
            </span>
          </div>
          <Show when={syncStatus()?.last_sync}>
            <div class="setting-item">
              <span class="setting-label" id="last-sync-label">
                Last Sync
              </span>
              <span class="setting-value" aria-labelledby="last-sync-label">
                {new Date((syncStatus()?.last_sync || 0) * 1000).toLocaleString()}
              </span>
            </div>
          </Show>
        </Show>
        <Show when={syncMessage()}>
          <p class="sync-message" role="status" aria-live="polite">
            {syncMessage()}
          </p>
        </Show>
        <div class="setting-buttons">
          <button
            class="primary"
            onClick={handleSync}
            disabled={isSyncing()}
            aria-busy={isSyncing()}
            aria-label={isSyncing() ? 'Syncing in progress' : 'Start synchronization'}
          >
            {isSyncing() ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="content-section-title">
        <h2 id="content-section-title">Content Updates</h2>
        <p class="setting-description" id="content-description">
          Update social networks, themes, and localization without app updates.
        </p>

        <div class="accessibility-toggle">
          <label for="content-updates-toggle">
            Enable Remote Updates
            <span class="toggle-description">Automatically check for content updates</span>
          </label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              id="content-updates-toggle"
              checked={contentUpdatesEnabled()}
              onChange={toggleContentUpdates}
              aria-describedby="content-description"
            />
            <span class="toggle-slider" aria-hidden="true" />
          </div>
        </div>

        <Show when={contentUpdateMessage()}>
          <p class="sync-message" role="status" aria-live="polite">
            {contentUpdateMessage()}
          </p>
        </Show>

        <div class="setting-buttons">
          <button
            class="secondary"
            onClick={checkContentUpdates}
            disabled={isCheckingContent() || !contentUpdatesEnabled()}
            aria-busy={isCheckingContent()}
            aria-label="Check for content updates"
          >
            {isCheckingContent() ? 'Checking...' : 'Check for Updates'}
          </button>
          <Show when={hasContentUpdates()}>
            <button
              class="primary"
              onClick={applyContentUpdates}
              disabled={isCheckingContent()}
              aria-label="Apply content updates"
            >
              Apply Updates
            </button>
          </Show>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="backup-section-title">
        <h2 id="backup-section-title">Backup</h2>
        <p class="setting-description" id="backup-description">
          Export your identity to back it up or transfer to another device.
        </p>
        <div class="setting-buttons" role="group" aria-describedby="backup-description">
          <button
            class="secondary"
            onClick={() => setShowBackupDialog(true)}
            aria-label="Export a backup of your identity"
          >
            Export Backup
          </button>
          <button
            class="secondary"
            onClick={() => setShowImportDialog(true)}
            aria-label="Import a backup file"
          >
            Import Backup
          </button>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="help-section-title">
        <h2 id="help-section-title">Help & Support</h2>
        <div class="setting-buttons help-links" role="group" aria-label="Help and support links">
          <button
            class="secondary"
            onClick={() => props.onNavigate('help')}
            aria-label="Open FAQ and help"
          >
            FAQ & Help
          </button>
          <button
            class="secondary link-btn"
            onClick={() => open('https://vauchi.app/user-guide')}
            aria-label="Open user guide in browser"
          >
            User Guide
          </button>
          <button
            class="secondary link-btn"
            onClick={() => open('https://github.com/vauchi/issues')}
            aria-label="Report an issue on GitHub"
          >
            Report Issue
          </button>
          <button
            class="secondary link-btn"
            onClick={() => open('https://vauchi.app/privacy')}
            aria-label="View privacy policy"
          >
            Privacy Policy
          </button>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="about-section-title">
        <h2 id="about-section-title">About</h2>
        <div class="setting-item">
          <span class="setting-label" id="version-label">
            Version
          </span>
          <span class="setting-value" aria-labelledby="version-label">
            1.0.0 (build 1)
          </span>
        </div>
        <div class="setting-item">
          <span class="setting-label" id="app-label">
            Vauchi
          </span>
          <span class="setting-value" aria-labelledby="app-label">
            Privacy-focused contact card exchange
          </span>
        </div>
      </section>

      {/* Backup Dialog */}
      <Show when={showBackupDialog()}>
        <div class="dialog-overlay" onClick={closeDialog} role="presentation">
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="backup-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="backup-dialog-title">Export Backup</h3>

            <Show
              when={!backupData()}
              fallback={
                <div class="backup-result">
                  <p class="success" role="status" aria-live="polite">
                    Backup created successfully!
                  </p>
                  <textarea
                    readonly
                    value={backupData()}
                    rows={6}
                    aria-label="Your encrypted backup data"
                  />
                  <div class="dialog-actions">
                    <button
                      class="primary"
                      onClick={copyBackup}
                      aria-label="Copy backup data to clipboard"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      class="secondary"
                      onClick={closeDialog}
                      aria-label="Close backup dialog"
                    >
                      Close
                    </button>
                  </div>
                </div>
              }
            >
              <div class="backup-form">
                <p id="backup-form-description">Enter a strong password to encrypt your backup.</p>

                <label for="backup-password">Password</label>
                <input
                  id="backup-password"
                  type="password"
                  value={backupPassword()}
                  onInput={(e) => {
                    setBackupPassword(e.target.value);
                    checkPassword();
                  }}
                  placeholder="Enter password"
                  aria-describedby={
                    `${passwordStrength() ? 'password-strength' : ''} ${backupError() ? 'backup-error' : ''}`.trim() ||
                    undefined
                  }
                  aria-invalid={backupError() ? 'true' : undefined}
                />
                <Show when={passwordStrength()}>
                  <p
                    id="password-strength"
                    class="password-strength"
                    role="status"
                    aria-live="polite"
                  >
                    Strength: {passwordStrength()}
                  </p>
                </Show>

                <label for="backup-confirm-password">Confirm Password</label>
                <input
                  id="backup-confirm-password"
                  type="password"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />

                <Show when={backupError()}>
                  <p id="backup-error" class="error" role="alert" aria-live="assertive">
                    {backupError()}
                  </p>
                </Show>

                <div class="dialog-actions">
                  <button
                    class="primary"
                    onClick={handleExportBackup}
                    aria-label="Create encrypted backup"
                  >
                    Export
                  </button>
                  <button class="secondary" onClick={closeDialog} aria-label="Cancel backup">
                    Cancel
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Import Dialog */}
      <Show when={showImportDialog()}>
        <div class="dialog-overlay" onClick={closeImportDialog} role="presentation">
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="import-dialog-title">Import Backup</h3>

            <Show when={importSuccess()}>
              <div class="import-result">
                <p class="success" role="status" aria-live="polite">
                  {importSuccess()}
                </p>
                <div class="dialog-actions">
                  <button
                    class="primary"
                    onClick={closeImportDialog}
                    aria-label="Close import dialog"
                  >
                    Done
                  </button>
                </div>
              </div>
            </Show>

            <Show when={!importSuccess()}>
              <div class="import-form">
                <p id="import-form-description">
                  Paste your backup data and enter the password used to encrypt it.
                </p>

                <label for="import-data">Backup Data</label>
                <textarea
                  id="import-data"
                  value={importData()}
                  onInput={(e) => setImportData(e.target.value)}
                  placeholder="Paste your backup data here..."
                  rows={4}
                  aria-required="true"
                  aria-describedby={importError() ? 'import-error' : undefined}
                  aria-invalid={importError() ? 'true' : undefined}
                />

                <label for="import-password">Password</label>
                <input
                  id="import-password"
                  type="password"
                  value={importPassword()}
                  onInput={(e) => setImportPassword(e.target.value)}
                  placeholder="Enter backup password"
                  aria-required="true"
                />

                <Show when={importError()}>
                  <p id="import-error" class="error" role="alert" aria-live="assertive">
                    {importError()}
                  </p>
                </Show>

                <div class="dialog-actions">
                  <button
                    class="primary"
                    onClick={handleImportBackup}
                    aria-label="Import and restore backup"
                  >
                    Import
                  </button>
                  <button class="secondary" onClick={closeImportDialog} aria-label="Cancel import">
                    Cancel
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class="nav-btn" onClick={() => props.onNavigate('home')} aria-label="Go to Home">
          Home
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('contacts')}
          aria-label="Go to Contacts"
        >
          Contacts
        </button>
        <button
          class="nav-btn"
          onClick={() => props.onNavigate('exchange')}
          aria-label="Go to Exchange"
        >
          Exchange
        </button>
        <button class="nav-btn active" aria-current="page" aria-label="Settings (current page)">
          Settings
        </button>
      </nav>
    </div>
  );
}

export default Settings;
