// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_index: number;
  is_current: boolean;
  is_active: boolean;
}

interface JoinDeviceResult {
  success: boolean;
  device_name: string;
  message: string;
}

interface DevicesProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

async function fetchDevices(): Promise<DeviceInfo[]> {
  return await invoke('list_devices');
}

function Devices(props: DevicesProps) {
  const [devices, { refetch }] = createResource(fetchDevices);
  const [showLinkDialog, setShowLinkDialog] = createSignal(false);
  const [showJoinDialog, setShowJoinDialog] = createSignal(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = createSignal<DeviceInfo | null>(null);
  const [linkData, setLinkData] = createSignal('');
  const [joinData, setJoinData] = createSignal('');
  const [error, setError] = createSignal('');
  const [joinMessage, setJoinMessage] = createSignal('');
  const [isJoining, setIsJoining] = createSignal(false);
  const [isRevoking, setIsRevoking] = createSignal(false);

  const generateLink = async () => {
    try {
      const data = (await invoke('generate_device_link')) as string;
      setLinkData(data);
      setShowLinkDialog(true);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const copyLinkData = () => {
    navigator.clipboard.writeText(linkData());
  };

  const handleJoinDevice = async () => {
    if (!joinData().trim()) {
      setJoinMessage('Please paste the device link data');
      return;
    }

    setIsJoining(true);
    setJoinMessage('');

    try {
      const result = (await invoke('join_device', { linkData: joinData() })) as JoinDeviceResult;
      setJoinMessage(result.message);
      if (result.success) {
        refetch();
        setTimeout(() => {
          setShowJoinDialog(false);
          setJoinData('');
          setJoinMessage('');
        }, 2000);
      }
    } catch (e) {
      setJoinMessage(String(e));
    }

    setIsJoining(false);
  };

  const handleRevokeDevice = async (device: DeviceInfo) => {
    setIsRevoking(true);
    setError('');

    try {
      await invoke('revoke_device', { deviceId: device.device_id });
      refetch();
      setShowRevokeConfirm(null);
    } catch (e) {
      setError(String(e));
    }

    setIsRevoking(false);
  };

  return (
    <div class="page devices" role="main" aria-labelledby="devices-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('home')}
          aria-label="Go back to home"
        >
          {t('action.back')}
        </button>
        <h1 id="devices-title">{t('devices.title')}</h1>
      </header>

      <Show when={error()}>
        <p class="error" role="alert" aria-live="assertive">
          {error()}
        </p>
      </Show>

      <section class="devices-section" aria-labelledby="linked-devices-title">
        <div class="section-header">
          <h2 id="linked-devices-title">{t('devices.linked')}</h2>
          <div class="header-buttons" role="group" aria-label="Device actions">
            <button
              class="small secondary"
              onClick={() => setShowJoinDialog(true)}
              aria-label="Join this device to another account"
            >
              Join Another
            </button>
            <button
              class="small primary"
              onClick={generateLink}
              aria-label="Generate link to add a new device"
            >
              {t('devices.generate_link')}
            </button>
          </div>
        </div>

        <div class="devices-list" role="list" aria-label="List of linked devices">
          <For each={devices()}>
            {(device) => (
              <div
                class={`device-item ${device.is_current ? 'current' : ''}`}
                role="listitem"
                aria-label={`${device.device_name}, ${device.is_active ? 'active' : 'revoked'}${device.is_current ? ', this device' : ''}`}
              >
                <div class="device-icon" aria-hidden="true">
                  {device.is_current ? '📱' : '💻'}
                </div>
                <div class="device-info">
                  <span class="device-name">
                    {device.device_name}
                    {device.is_current && (
                      <span class="badge current" aria-label="Current device">
                        This device
                      </span>
                    )}
                  </span>
                  <span class="device-id">ID: {device.device_id.substring(0, 16)}...</span>
                  <span
                    class={`device-status ${device.is_active ? 'active' : 'revoked'}`}
                    role="status"
                  >
                    {device.is_active ? 'Active' : 'Revoked'}
                  </span>
                </div>
                <Show when={!device.is_current && device.is_active}>
                  <button
                    class="small danger"
                    onClick={() => setShowRevokeConfirm(device)}
                    aria-label={`Revoke ${device.device_name}`}
                  >
                    {t('devices.revoke')}
                  </button>
                </Show>
              </div>
            )}
          </For>

          {devices()?.length === 0 && (
            <p class="empty-state" role="status">
              No devices found
            </p>
          )}
        </div>
      </section>

      <section class="info-section" aria-labelledby="multi-device-info-title">
        <h3 id="multi-device-info-title">Multi-Device Sync</h3>
        <p>Link multiple devices to access your contacts from anywhere.</p>
        <p>All devices share the same identity and stay in sync.</p>
      </section>

      {/* Link Device Dialog */}
      <Show when={showLinkDialog()}>
        <div
          class="dialog-overlay"
          onClick={() => setShowLinkDialog(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowLinkDialog(false);
          }}
          role="presentation"
        >
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-dialog-title"
            aria-describedby="link-dialog-description"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="link-dialog-title">{t('devices.generate_link')}</h3>
            <p id="link-dialog-description">
              Scan this code with your new device, or copy the data below:
            </p>

            <div class="link-data" role="group" aria-label="Device link data">
              <code aria-label="Link data preview">{linkData().substring(0, 50)}...</code>
              <button class="small" onClick={copyLinkData} aria-label="Copy link data to clipboard">
                Copy
              </button>
            </div>

            <p class="warning" role="alert">
              This code expires in 10 minutes.
            </p>

            <div class="dialog-actions">
              <button
                class="secondary"
                onClick={() => setShowLinkDialog(false)}
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Join Device Dialog */}
      <Show when={showJoinDialog()}>
        <div
          class="dialog-overlay"
          onClick={() => {
            if (!isJoining()) {
              setShowJoinDialog(false);
              setJoinData('');
              setJoinMessage('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isJoining()) {
              setShowJoinDialog(false);
              setJoinData('');
              setJoinMessage('');
            }
          }}
          role="presentation"
        >
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-dialog-title"
            aria-describedby="join-dialog-description"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="join-dialog-title">Join Another Device</h3>
            <p id="join-dialog-description">Paste the device link data from your other device:</p>

            <textarea
              value={joinData()}
              onInput={(e) => setJoinData(e.target.value)}
              placeholder="Paste device link data here..."
              rows={4}
              disabled={isJoining()}
              aria-label="Device link data"
              aria-required="true"
            />

            <Show when={joinMessage()}>
              <p class="info-message" role="status" aria-live="polite">
                {joinMessage()}
              </p>
            </Show>

            <div class="dialog-actions">
              <button
                class="primary"
                onClick={handleJoinDevice}
                disabled={isJoining() || !joinData().trim()}
                aria-busy={isJoining()}
                aria-label={isJoining() ? 'Joining device' : 'Join this device to the account'}
              >
                {isJoining() ? 'Joining...' : 'Join'}
              </button>
              <button
                class="secondary"
                onClick={() => {
                  setShowJoinDialog(false);
                  setJoinData('');
                  setJoinMessage('');
                }}
                disabled={isJoining()}
                aria-label="Cancel joining"
              >
                {t('action.cancel')}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Revoke Confirmation Dialog */}
      <Show when={showRevokeConfirm()}>
        <div
          class="dialog-overlay"
          onClick={() => {
            if (!isRevoking()) setShowRevokeConfirm(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isRevoking()) setShowRevokeConfirm(null);
          }}
          role="presentation"
        >
          <div
            class="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revoke-dialog-title"
            aria-describedby="revoke-dialog-description"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="revoke-dialog-title">{t('devices.revoke')}</h3>
            <p id="revoke-dialog-description">
              Are you sure you want to revoke <strong>{showRevokeConfirm()?.device_name}</strong>?
            </p>
            <p class="warning" role="alert">
              This device will no longer be able to sync with your account.
            </p>

            <div class="dialog-actions">
              <button
                class="danger"
                onClick={() => handleRevokeDevice(showRevokeConfirm()!)}
                disabled={isRevoking()}
                aria-busy={isRevoking()}
                aria-label={
                  isRevoking() ? 'Revoking device' : `Revoke ${showRevokeConfirm()?.device_name}`
                }
              >
                {isRevoking() ? 'Revoking...' : 'Revoke Device'}
              </button>
              <button
                class="secondary"
                onClick={() => setShowRevokeConfirm(null)}
                disabled={isRevoking()}
                aria-label="Cancel revocation"
              >
                {t('action.cancel')}
              </button>
            </div>
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

export default Devices;
