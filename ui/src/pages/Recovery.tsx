// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface _RecoverySettingsInfo {
  recovery_threshold: number;
  verification_threshold: number;
}

interface ClaimInfo {
  old_pk: string;
  new_pk: string;
  is_expired: boolean;
  contact_name: string | null;
}

interface RecoveryProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

function Recovery(props: RecoveryProps) {
  const [mode, setMode] = createSignal<'menu' | 'claim' | 'vouch'>('menu');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');

  // Claim state
  const [oldPkHex, setOldPkHex] = createSignal('');
  const [claimData, setClaimData] = createSignal('');

  // Vouch state
  const [vouchInput, setVouchInput] = createSignal('');
  const [claimInfo, setClaimInfo] = createSignal<ClaimInfo | null>(null);
  const [voucherData, setVoucherData] = createSignal('');

  const createClaim = async () => {
    if (!oldPkHex().trim()) {
      setError('Please enter your old public key');
      return;
    }

    try {
      const claim = (await invoke('create_recovery_claim', { oldPkHex: oldPkHex() })) as string;
      setClaimData(claim);
      setError('');
      setSuccess('Recovery claim created!');
    } catch (e) {
      setError(String(e));
    }
  };

  const parseClaim = async () => {
    if (!vouchInput().trim()) {
      setError('Please enter a recovery claim');
      return;
    }

    try {
      const info = (await invoke('parse_recovery_claim', { claimB64: vouchInput() })) as ClaimInfo;
      setClaimInfo(info);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const createVoucher = async () => {
    try {
      const voucher = (await invoke('create_recovery_voucher', {
        claimB64: vouchInput(),
      })) as string;
      setVoucherData(voucher);
      setError('');
      setSuccess('Voucher created!');
    } catch (e) {
      setError(String(e));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div class="page recovery" role="main" aria-labelledby="recovery-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => {
            if (mode() === 'menu') {
              props.onNavigate('home');
            } else {
              setMode('menu');
              setError('');
              setSuccess('');
              setClaimData('');
              setVoucherData('');
              setClaimInfo(null);
            }
          }}
          aria-label={mode() === 'menu' ? 'Go back to home' : 'Go back to recovery menu'}
        >
          {t('action.back')}
        </button>
        <h1 id="recovery-title">{t('recovery.title')}</h1>
      </header>

      <Show when={error()}>
        <p class="error" role="alert" aria-live="assertive">
          {error()}
        </p>
      </Show>

      <Show when={success()}>
        <p class="success" role="status" aria-live="polite">
          {success()}
        </p>
      </Show>

      {/* Menu Mode */}
      <Show when={mode() === 'menu'}>
        <section class="recovery-menu" aria-label="Recovery options">
          <div
            class="menu-item"
            role="button"
            tabIndex={0}
            onClick={() => setMode('claim')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMode('claim'))}
            aria-label="Create Recovery Claim. Lost your device? Start the recovery process."
          >
            <div class="menu-icon" aria-hidden="true">
              🔑
            </div>
            <div class="menu-content">
              <h3>{t('recovery.create_claim')}</h3>
              <p>Lost your device? Start the recovery process.</p>
            </div>
          </div>

          <div
            class="menu-item"
            role="button"
            tabIndex={0}
            onClick={() => setMode('vouch')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMode('vouch'))}
            aria-label="Vouch for Contact. Help a contact recover their identity."
          >
            <div class="menu-icon" aria-hidden="true">
              ✅
            </div>
            <div class="menu-content">
              <h3>{t('recovery.vouch')}</h3>
              <p>Help a contact recover their identity.</p>
            </div>
          </div>
        </section>

        <section class="info-section" aria-labelledby="how-recovery-works-title">
          <h3 id="how-recovery-works-title">{t('recovery.how_it_works')}</h3>
          <ol aria-label="Recovery process steps">
            <li>{t('recovery.step1')}</li>
            <li>{t('recovery.step2')}</li>
            <li>{t('recovery.step3')}</li>
            <li>{t('recovery.step4')}</li>
            <li>{t('recovery.step5')}</li>
          </ol>
        </section>
      </Show>

      {/* Create Claim Mode */}
      <Show when={mode() === 'claim'}>
        <section class="recovery-form" aria-labelledby="create-claim-title">
          <h2 id="create-claim-title">{t('recovery.create_claim')}</h2>
          <p id="create-claim-description">Enter the public key from your lost identity:</p>

          <div class="form" role="form" aria-describedby="create-claim-description">
            <label for="old-pk-input">Old Public Key (hex)</label>
            <input
              id="old-pk-input"
              type="text"
              placeholder="Enter 64-character hex string"
              value={oldPkHex()}
              onInput={(e) => setOldPkHex(e.target.value)}
              aria-required="true"
            />

            <button onClick={createClaim} aria-label="Generate recovery claim">
              Generate Claim
            </button>
          </div>

          <Show when={claimData()}>
            <div class="result-box" role="region" aria-labelledby="claim-result-title">
              <h3 id="claim-result-title">{t('recovery.claim_active')}</h3>
              <p>Share this with your contacts:</p>
              <code class="claim-data" aria-label="Recovery claim data">
                {claimData()}
              </code>
              <button
                class="small"
                onClick={() => copyToClipboard(claimData())}
                aria-label="Copy claim data to clipboard"
              >
                Copy
              </button>
            </div>
          </Show>
        </section>
      </Show>

      {/* Vouch Mode */}
      <Show when={mode() === 'vouch'}>
        <section class="recovery-form" aria-labelledby="vouch-title">
          <h2 id="vouch-title">{t('recovery.vouch')}</h2>
          <p id="vouch-description">Paste the recovery claim from your contact:</p>

          <div class="form" role="form" aria-describedby="vouch-description">
            <label for="vouch-input">Recovery Claim</label>
            <textarea
              id="vouch-input"
              placeholder="Paste claim data here"
              value={vouchInput()}
              onInput={(e) => setVouchInput(e.target.value)}
              rows={4}
              aria-required="true"
            />

            <button onClick={parseClaim} aria-label="Verify the recovery claim">
              Verify Claim
            </button>
          </div>

          <Show when={claimInfo()}>
            <div
              class="claim-preview"
              role="region"
              aria-labelledby="claim-details-title"
              aria-live="polite"
            >
              <h3 id="claim-details-title">Claim Details</h3>
              <p>
                <strong>Old Identity:</strong> {claimInfo()?.old_pk.substring(0, 16)}...
              </p>
              <p>
                <strong>New Identity:</strong> {claimInfo()?.new_pk.substring(0, 16)}...
              </p>

              <Show when={claimInfo()?.contact_name}>
                <p class="success" role="status">
                  Matches your contact: {claimInfo()?.contact_name}
                </p>
              </Show>

              <Show when={!claimInfo()?.contact_name}>
                <p class="warning" role="alert">
                  This key is NOT in your contacts. Verify in person!
                </p>
              </Show>

              <Show when={claimInfo()?.is_expired}>
                <p class="error" role="alert">
                  This claim has expired!
                </p>
              </Show>

              <Show when={!claimInfo()?.is_expired}>
                <button
                  class="primary"
                  onClick={createVoucher}
                  aria-label="Create a voucher to help this contact recover"
                >
                  Create Voucher
                </button>
              </Show>
            </div>
          </Show>

          <Show when={voucherData()}>
            <div class="result-box" role="region" aria-labelledby="voucher-result-title">
              <h3 id="voucher-result-title">Your Voucher</h3>
              <p>Give this to the person recovering:</p>
              <code class="voucher-data" aria-label="Voucher data">
                {voucherData()}
              </code>
              <button
                class="small"
                onClick={() => copyToClipboard(voucherData())}
                aria-label="Copy voucher to clipboard"
              >
                Copy
              </button>
            </div>
          </Show>
        </section>
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

export default Recovery;
