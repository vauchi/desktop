// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

// --- Domain types ---

interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_index: number;
  is_current: boolean;
  is_active: boolean;
}

interface DeviceLinkQRResult {
  qr_data: string;
  qr_svg: string;
  fingerprint: string;
}

interface DeviceConfirmation {
  device_name: string;
  confirmation_code: string;
  fingerprint: string;
}

interface JoinStartResult {
  success: boolean;
  request_data: string | null;
  target_identity: string | null;
  message: string;
}

interface JoinConfirmation {
  confirmation_code: string;
  fingerprint: string;
}

interface JoinFinishResult {
  success: boolean;
  display_name: string | null;
  device_index: number | null;
  message: string;
}

interface DeviceLinkResponseData {
  response_data: string;
}

interface MultipartQRFrame {
  frame_number: number;
  total_frames: number;
  svg: string;
}

// --- State machine ---

type DeviceLinkState =
  | { step: 'idle' }
  | { step: 'selectTransport' }
  | { step: 'selectRole'; transport: 'relay' | 'offline' }
  | { step: 'generatingQR'; transport: 'relay' | 'offline' }
  | {
      step: 'waitingForRequest';
      transport: 'relay' | 'offline';
      qrData: string;
      qrSvg: string;
      fingerprint: string;
    }
  | {
      step: 'confirmingDevice';
      transport: 'relay' | 'offline';
      deviceName: string;
      confirmationCode: string;
      fingerprint: string;
    }
  | { step: 'completing' }
  | { step: 'success'; deviceName: string }
  | { step: 'failed'; error: string }
  | {
      step: 'offlineReceiveRequest';
      transport: 'offline';
      qrData: string;
      qrSvg: string;
      fingerprint: string;
    }
  | { step: 'offlineShowResponse'; transport: 'offline'; deviceName: string }
  | { step: 'joinPaste'; transport: 'relay' | 'offline' }
  | {
      step: 'joinWaiting';
      transport: 'relay' | 'offline';
      confirmationCode: string;
      fingerprint: string;
    }
  | {
      step: 'joinOfflineShowRequest';
      transport: 'offline';
      requestData: string;
      confirmationCode: string;
      fingerprint: string;
    }
  | {
      step: 'joinOfflineWaitResponse';
      transport: 'offline';
      confirmationCode: string;
      fingerprint: string;
    }
  | { step: 'joinSuccess'; displayName: string };

// --- Props ---

interface DevicesProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

// --- Data fetcher ---

async function fetchDevices(): Promise<DeviceInfo[]> {
  return await invoke('list_devices');
}

// --- Component ---

function Devices(props: DevicesProps) {
  const [devices, { refetch }] = createResource(fetchDevices);

  // State machine for device linking flow
  const [linkState, setLinkState] = createSignal<DeviceLinkState>({ step: 'idle' });

  // Input signals for join flow
  const [joinInputData, setJoinInputData] = createSignal('');
  const [deviceNameInput, setDeviceNameInput] = createSignal('');

  // Input signal for offline initiator receiving a request manually
  const [offlineRequestInput, setOfflineRequestInput] = createSignal('');
  // Input signal for offline responder receiving a response manually
  const [offlineResponseInput, setOfflineResponseInput] = createSignal('');

  // Multipart QR state for offline flow
  const [multipartFrames, setMultipartFrames] = createSignal<MultipartQRFrame[]>([]);
  const [currentFrame, setCurrentFrame] = createSignal(1);

  // Revoke dialog state (kept separate)
  const [showRevokeConfirm, setShowRevokeConfirm] = createSignal<DeviceInfo | null>(null);
  const [isRevoking, setIsRevoking] = createSignal(false);
  const [error, setError] = createSignal('');

  // --- Initiator flow ---

  const startInitiatorFlow = async (transport: 'relay' | 'offline') => {
    setLinkState({ step: 'generatingQR', transport });
    try {
      const result = await invoke<DeviceLinkQRResult>('generate_device_link_qr');
      if (transport === 'offline') {
        setLinkState({
          step: 'offlineReceiveRequest',
          transport,
          qrData: result.qr_data,
          qrSvg: result.qr_svg,
          fingerprint: result.fingerprint,
        });
        return;
      }

      setLinkState({
        step: 'waitingForRequest',
        transport,
        qrData: result.qr_data,
        qrSvg: result.qr_svg,
        fingerprint: result.fingerprint,
      });

      if (transport === 'relay') {
        const requestData = await invoke<string>('relay_listen_for_request');
        const confirmation = await invoke<DeviceConfirmation>('prepare_device_confirmation', {
          requestData,
        });
        setLinkState({
          step: 'confirmingDevice',
          transport,
          deviceName: confirmation.device_name,
          confirmationCode: confirmation.confirmation_code,
          fingerprint: confirmation.fingerprint,
        });
      }
    } catch (e) {
      setLinkState({ step: 'failed', error: String(e) });
    }
  };

  const approveLink = async () => {
    const state = linkState();
    if (state.step !== 'confirmingDevice') return;
    const transport = state.transport;
    const deviceName = state.deviceName;

    setLinkState({ step: 'completing' });
    try {
      const result = await invoke<DeviceLinkResponseData>('confirm_device_link_approved');
      if (transport === 'relay') {
        await invoke('relay_send_response', { responseData: result.response_data });
        setLinkState({ step: 'success', deviceName });
      } else {
        // Offline: show response as multipart QR for the new device to scan
        const frames = await invoke<MultipartQRFrame[]>('generate_multipart_qr', {
          data: result.response_data,
        });
        setMultipartFrames(frames);
        setCurrentFrame(1);
        setLinkState({ step: 'offlineShowResponse', transport: 'offline', deviceName });
      }
      refetch();
    } catch (e) {
      setLinkState({ step: 'failed', error: String(e) });
    }
  };

  const denyLink = async () => {
    await invoke('deny_device_link');
    setLinkState({ step: 'idle' });
  };

  // --- Responder (join) flow ---

  const startJoinFlow = async (transport: 'relay' | 'offline') => {
    const data = joinInputData();
    const name = deviceNameInput();
    if (!data.trim()) return;

    try {
      const joinResult = await invoke<JoinStartResult>('join_device', {
        linkData: data,
        deviceName: name || 'Desktop',
      });
      if (!joinResult.success) {
        setLinkState({ step: 'failed', error: joinResult.message });
        return;
      }

      const confirmation = await invoke<JoinConfirmation>('get_join_confirmation_code');

      if (transport === 'offline' && joinResult.request_data) {
        // Show request as multipart QR for the existing device to scan/paste
        const frames = await invoke<MultipartQRFrame[]>('generate_multipart_qr', {
          data: joinResult.request_data,
        });
        setMultipartFrames(frames);
        setCurrentFrame(1);
        setLinkState({
          step: 'joinOfflineShowRequest',
          transport: 'offline',
          requestData: joinResult.request_data,
          confirmationCode: confirmation.confirmation_code,
          fingerprint: confirmation.fingerprint,
        });
        return;
      }

      setLinkState({
        step: 'joinWaiting',
        transport,
        confirmationCode: confirmation.confirmation_code,
        fingerprint: confirmation.fingerprint,
      });

      if (transport === 'relay' && joinResult.request_data && joinResult.target_identity) {
        const responseData = await invoke<string>('relay_join_via_relay', {
          requestData: joinResult.request_data,
          targetIdentity: joinResult.target_identity,
        });
        const finishResult = await invoke<JoinFinishResult>('finish_join_device', {
          responseData,
        });
        if (finishResult.success) {
          setLinkState({
            step: 'joinSuccess',
            displayName: finishResult.display_name || 'Unknown',
          });
          refetch();
        } else {
          setLinkState({ step: 'failed', error: finishResult.message });
        }
      }
    } catch (e) {
      setLinkState({ step: 'failed', error: String(e) });
    }
  };

  // --- Revoke flow (unchanged) ---

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

  // --- Render ---

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
          <Show when={linkState().step === 'idle'}>
            <div class="header-buttons" role="group" aria-label="Device actions">
              <button
                class="small primary"
                onClick={() => setLinkState({ step: 'selectTransport' })}
                aria-label="Start device linking flow"
              >
                {t('devices.generate_link')}
              </button>
            </div>
          </Show>
        </div>

        {/* --- State machine inline UI --- */}
        <div aria-live="polite">
          {/* Select Transport */}
          <Show when={linkState().step === 'selectTransport'}>
            <div class="link-flow" role="group" aria-label="Choose transport">
              <h3>{t('devices.link.choose_transport') || 'How do you want to link?'}</h3>
              <button
                class="transport-option"
                onClick={() => setLinkState({ step: 'selectRole', transport: 'relay' })}
              >
                {t('devices.link.via_internet') || 'Link via Internet'}
              </button>
              <button
                class="transport-option"
                onClick={() => setLinkState({ step: 'selectRole', transport: 'offline' })}
              >
                {t('devices.link.via_offline') || 'Link Offline (QR Code)'}
              </button>
              <button class="small secondary" onClick={() => setLinkState({ step: 'idle' })}>
                {t('action.cancel')}
              </button>
            </div>
          </Show>

          {/* Select Role */}
          <Show when={linkState().step === 'selectRole'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'selectRole' }>;
              return (
                <div class="link-flow" role="group" aria-label="Choose role">
                  <h3>{t('devices.link.choose_role') || 'What would you like to do?'}</h3>
                  <button
                    class="transport-option"
                    onClick={() => startInitiatorFlow(state.transport)}
                  >
                    {t('devices.link.role_initiator') || 'Link a new device to this account'}
                  </button>
                  <button
                    class="transport-option"
                    onClick={() => setLinkState({ step: 'joinPaste', transport: state.transport })}
                  >
                    {t('devices.link.role_responder') || 'Join this device to another account'}
                  </button>
                  <button class="small secondary" onClick={() => setLinkState({ step: 'idle' })}>
                    {t('action.cancel')}
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Generating QR */}
          <Show when={linkState().step === 'generatingQR'}>
            <div class="link-flow">
              <p>Generating QR code...</p>
            </div>
          </Show>

          {/* Waiting for Request */}
          <Show when={linkState().step === 'waitingForRequest'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'waitingForRequest' }>;
              return (
                <div class="link-flow qr-display">
                  <h3>{t('devices.link.scan_qr') || 'Scan this code on your new device'}</h3>
                  {/* eslint-disable-next-line solid/no-innerhtml -- SVG is backend-generated, trusted */}
                  <div class="qr-container" innerHTML={state.qrSvg} />
                  <div class="qr-actions">
                    <button
                      class="small"
                      onClick={() => navigator.clipboard.writeText(state.qrData)}
                    >
                      {t('devices.link.copy_data') || 'Copy Link Data'}
                    </button>
                  </div>
                  <p class="fingerprint">Fingerprint: {state.fingerprint}</p>
                  <Show when={state.transport === 'relay'}>
                    <p class="waiting-indicator">Waiting for device to connect...</p>
                  </Show>
                  <button
                    class="secondary"
                    onClick={() => {
                      invoke('deny_device_link');
                      setLinkState({ step: 'idle' });
                    }}
                  >
                    {t('action.cancel')}
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Offline: Receive Request */}
          <Show when={linkState().step === 'offlineReceiveRequest'}>
            {(() => {
              const state = linkState() as Extract<
                DeviceLinkState,
                { step: 'offlineReceiveRequest' }
              >;
              const handleOfflineRequest = async () => {
                const requestData = offlineRequestInput().trim();
                if (!requestData) return;
                try {
                  const confirmation = await invoke<DeviceConfirmation>(
                    'prepare_device_confirmation',
                    { requestData }
                  );
                  setLinkState({
                    step: 'confirmingDevice',
                    transport: 'offline',
                    deviceName: confirmation.device_name,
                    confirmationCode: confirmation.confirmation_code,
                    fingerprint: confirmation.fingerprint,
                  });
                } catch (e) {
                  setLinkState({ step: 'failed', error: String(e) });
                }
              };
              return (
                <div class="link-flow qr-display">
                  <h3>{t('devices.link.scan_qr') || 'Scan this code on your new device'}</h3>
                  {/* eslint-disable-next-line solid/no-innerhtml -- SVG is backend-generated, trusted */}
                  <div class="qr-container" innerHTML={state.qrSvg} />
                  <div class="qr-actions">
                    <button
                      class="small"
                      onClick={() => navigator.clipboard.writeText(state.qrData)}
                    >
                      {t('devices.link.copy_data') || 'Copy Link Data'}
                    </button>
                  </div>
                  <p class="fingerprint">Fingerprint: {state.fingerprint}</p>
                  <div class="offline-request-input">
                    <h4>Paste the request from the new device:</h4>
                    <textarea
                      placeholder="Paste request data here..."
                      value={offlineRequestInput()}
                      onInput={(e) => setOfflineRequestInput(e.target.value)}
                      rows={4}
                    />
                    <button
                      class="primary"
                      onClick={handleOfflineRequest}
                      disabled={!offlineRequestInput().trim()}
                    >
                      Process Request
                    </button>
                  </div>
                  <button
                    class="secondary"
                    onClick={() => {
                      invoke('deny_device_link');
                      setOfflineRequestInput('');
                      setLinkState({ step: 'idle' });
                    }}
                  >
                    {t('action.cancel')}
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Offline: Show Response as Multipart QR */}
          <Show when={linkState().step === 'offlineShowResponse'}>
            {(() => {
              const state = linkState() as Extract<
                DeviceLinkState,
                { step: 'offlineShowResponse' }
              >;
              const frames = multipartFrames();
              return (
                <div class="link-flow multipart-qr">
                  <h3>Show this to the new device</h3>
                  <p>
                    Device <strong>{state.deviceName}</strong> linked. Have the new device scan each
                    frame below.
                  </p>
                  <Show when={frames.length > 0}>
                    <p class="frame-indicator">
                      Frame {currentFrame()} of {frames.length}
                    </p>
                    {/* eslint-disable solid/no-innerhtml -- SVG is backend-generated by generate_multipart_qr, trusted */}
                    <div class="qr-container" innerHTML={frames[currentFrame() - 1]?.svg} />
                    {/* eslint-enable solid/no-innerhtml */}
                    <Show when={frames.length > 1}>
                      <div class="frame-nav" role="group" aria-label="Frame navigation">
                        <button
                          disabled={currentFrame() <= 1}
                          onClick={() => setCurrentFrame((f) => f - 1)}
                        >
                          Previous
                        </button>
                        <button
                          disabled={currentFrame() >= frames.length}
                          onClick={() => setCurrentFrame((f) => f + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </Show>
                  </Show>
                  <button
                    class="primary"
                    onClick={() => {
                      setMultipartFrames([]);
                      setCurrentFrame(1);
                      setOfflineRequestInput('');
                      setLinkState({ step: 'idle' });
                    }}
                  >
                    Done
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Confirming Device */}
          <Show when={linkState().step === 'confirmingDevice'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'confirmingDevice' }>;
              return (
                <div class="link-flow confirmation-card">
                  <h3>{t('devices.link.confirm_title') || 'Confirm Device Link'}</h3>
                  <p>
                    Device: <strong>{state.deviceName}</strong>
                  </p>
                  <div class="confirmation-code" aria-label="Confirmation code">
                    {state.confirmationCode}
                  </div>
                  <p>
                    {t('devices.link.confirm_code_match') ||
                      'Verify this code matches on your new device.'}
                  </p>
                  <div class="dialog-actions">
                    <button class="primary" onClick={approveLink}>
                      {t('devices.link.approve') || 'Approve'}
                    </button>
                    <button class="danger" onClick={denyLink}>
                      {t('devices.link.deny') || 'Deny'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </Show>

          {/* Completing */}
          <Show when={linkState().step === 'completing'}>
            <div class="link-flow">
              <p>Completing device link...</p>
            </div>
          </Show>

          {/* Success */}
          <Show when={linkState().step === 'success'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'success' }>;
              return (
                <div class="link-flow">
                  <h3>{t('devices.link.success') || 'Device linked successfully!'}</h3>
                  <p>
                    Device <strong>{state.deviceName}</strong> has been linked.
                  </p>
                  <button class="primary" onClick={() => setLinkState({ step: 'idle' })}>
                    Done
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Failed */}
          <Show when={linkState().step === 'failed'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'failed' }>;
              return (
                <div class="link-flow">
                  <p class="error" role="alert">
                    {state.error}
                  </p>
                  <button class="secondary" onClick={() => setLinkState({ step: 'idle' })}>
                    Try Again
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Join Paste */}
          <Show when={linkState().step === 'joinPaste'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'joinPaste' }>;
              return (
                <div class="link-flow join-paste">
                  <h3>{t('devices.link.join_title') || 'Join Existing Account'}</h3>
                  <input
                    type="text"
                    placeholder={t('devices.link.device_name') || 'Name for this device'}
                    value={deviceNameInput()}
                    onInput={(e) => setDeviceNameInput(e.target.value)}
                  />
                  <textarea
                    placeholder={
                      t('devices.link.paste_data') || 'Paste link data from your other device...'
                    }
                    value={joinInputData()}
                    onInput={(e) => setJoinInputData(e.target.value)}
                    rows={4}
                  />
                  <div class="dialog-actions">
                    <button
                      class="primary"
                      onClick={() => startJoinFlow(state.transport)}
                      disabled={!joinInputData().trim()}
                    >
                      Join
                    </button>
                    <button class="secondary" onClick={() => setLinkState({ step: 'idle' })}>
                      {t('action.cancel')}
                    </button>
                  </div>
                </div>
              );
            })()}
          </Show>

          {/* Join Waiting */}
          <Show when={linkState().step === 'joinWaiting'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'joinWaiting' }>;
              return (
                <div class="link-flow join-waiting">
                  <h3>{t('devices.link.waiting_approval') || 'Waiting for Approval'}</h3>
                  <div class="confirmation-code">{state.confirmationCode}</div>
                  <p>Verify this code matches on your other device, then approve there.</p>
                  <p class="fingerprint">Fingerprint: {state.fingerprint}</p>
                </div>
              );
            })()}
          </Show>

          {/* Join Offline: Show Request as Multipart QR */}
          <Show when={linkState().step === 'joinOfflineShowRequest'}>
            {(() => {
              const state = linkState() as Extract<
                DeviceLinkState,
                { step: 'joinOfflineShowRequest' }
              >;
              const frames = multipartFrames();
              return (
                <div class="link-flow multipart-qr">
                  <h3>Show this request to the existing device</h3>
                  <div class="confirmation-code" aria-label="Confirmation code">
                    {state.confirmationCode}
                  </div>
                  <p>
                    Verify this code matches on the other device after they process your request.
                  </p>
                  <p class="fingerprint">Fingerprint: {state.fingerprint}</p>
                  <Show when={frames.length > 0}>
                    <p class="frame-indicator">
                      Frame {currentFrame()} of {frames.length}
                    </p>
                    {/* eslint-disable solid/no-innerhtml -- SVG is backend-generated by generate_multipart_qr, trusted */}
                    <div class="qr-container" innerHTML={frames[currentFrame() - 1]?.svg} />
                    {/* eslint-enable solid/no-innerhtml */}
                    <Show when={frames.length > 1}>
                      <div class="frame-nav" role="group" aria-label="Frame navigation">
                        <button
                          disabled={currentFrame() <= 1}
                          onClick={() => setCurrentFrame((f) => f - 1)}
                        >
                          Previous
                        </button>
                        <button
                          disabled={currentFrame() >= frames.length}
                          onClick={() => setCurrentFrame((f) => f + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </Show>
                    <div class="qr-actions">
                      <button
                        class="small"
                        onClick={() => navigator.clipboard.writeText(state.requestData)}
                      >
                        Copy Request Data
                      </button>
                    </div>
                  </Show>
                  <button
                    class="primary"
                    onClick={() => {
                      setMultipartFrames([]);
                      setCurrentFrame(1);
                      setLinkState({
                        step: 'joinOfflineWaitResponse',
                        transport: 'offline',
                        confirmationCode: state.confirmationCode,
                        fingerprint: state.fingerprint,
                      });
                    }}
                  >
                    I've shared the request
                  </button>
                  <button
                    class="secondary"
                    onClick={() => {
                      setMultipartFrames([]);
                      setCurrentFrame(1);
                      setLinkState({ step: 'idle' });
                    }}
                  >
                    {t('action.cancel')}
                  </button>
                </div>
              );
            })()}
          </Show>

          {/* Join Offline: Wait for Response */}
          <Show when={linkState().step === 'joinOfflineWaitResponse'}>
            {(() => {
              const state = linkState() as Extract<
                DeviceLinkState,
                { step: 'joinOfflineWaitResponse' }
              >;
              const handleFinishOfflineJoin = async () => {
                const responseData = offlineResponseInput().trim();
                if (!responseData) return;
                try {
                  const finishResult = await invoke<JoinFinishResult>('finish_join_device', {
                    responseData,
                  });
                  if (finishResult.success) {
                    setOfflineResponseInput('');
                    setLinkState({
                      step: 'joinSuccess',
                      displayName: finishResult.display_name || 'Unknown',
                    });
                    refetch();
                  } else {
                    setLinkState({ step: 'failed', error: finishResult.message });
                  }
                } catch (e) {
                  setLinkState({ step: 'failed', error: String(e) });
                }
              };
              return (
                <div class="link-flow join-waiting">
                  <h3>Paste the response from the existing device</h3>
                  <div class="confirmation-code" aria-label="Confirmation code">
                    {state.confirmationCode}
                  </div>
                  <p class="fingerprint">Fingerprint: {state.fingerprint}</p>
                  <textarea
                    placeholder="Paste response data from the other device..."
                    value={offlineResponseInput()}
                    onInput={(e) => setOfflineResponseInput(e.target.value)}
                    rows={4}
                  />
                  <div class="dialog-actions">
                    <button
                      class="primary"
                      onClick={handleFinishOfflineJoin}
                      disabled={!offlineResponseInput().trim()}
                    >
                      Complete Join
                    </button>
                    <button
                      class="secondary"
                      onClick={() => {
                        setOfflineResponseInput('');
                        setLinkState({ step: 'idle' });
                      }}
                    >
                      {t('action.cancel')}
                    </button>
                  </div>
                </div>
              );
            })()}
          </Show>

          {/* Join Success */}
          <Show when={linkState().step === 'joinSuccess'}>
            {(() => {
              const state = linkState() as Extract<DeviceLinkState, { step: 'joinSuccess' }>;
              return (
                <div class="link-flow">
                  <h3>{t('devices.link.join_success') || 'Successfully joined!'}</h3>
                  <p>Connected to {state.displayName}'s account. Run sync to fetch contacts.</p>
                  <button class="primary" onClick={() => setLinkState({ step: 'idle' })}>
                    Done
                  </button>
                </div>
              );
            })()}
          </Show>
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
            tabIndex={-1}
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
