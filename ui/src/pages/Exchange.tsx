// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createResource, createSignal, Show, createEffect, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'qrcode';
import { t, tArgs } from '../services/i18nService';
import { checkAhaMomentWithContext, type AhaMoment } from '../services/ahaService';

// QR code expires after 5 minutes (300 seconds)
const QR_EXPIRATION_SECONDS = 300;

interface ExchangeQRResponse {
  data: string;
  display_name: string;
  qr_ascii: string;
}

interface ExchangeResult {
  success: boolean;
  contact_name: string;
  contact_id: string;
  message: string;
}

interface ExchangeProps {
  onNavigate: (
    page: 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'
  ) => void;
}

async function generateQR(): Promise<ExchangeQRResponse> {
  return await invoke('generate_qr');
}

function Exchange(props: ExchangeProps) {
  const [qrData, { refetch: refetchQR }] = createResource(generateQR);
  const [scanData, setScanData] = createSignal('');
  const [result, setResult] = createSignal<ExchangeResult | null>(null);
  const [error, setError] = createSignal('');
  const [qrImageUrl, setQrImageUrl] = createSignal('');
  const [timeRemaining, setTimeRemaining] = createSignal(QR_EXPIRATION_SECONDS);
  const [isExpired, setIsExpired] = createSignal(false);
  const [ahaMoment, setAhaMoment] = createSignal<AhaMoment | null>(null);

  // Timer for QR expiration
  let timerInterval: number | undefined;

  const startTimer = () => {
    setTimeRemaining(QR_EXPIRATION_SECONDS);
    setIsExpired(false);

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          if (timerInterval) clearInterval(timerInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as number;
  };

  const refreshQR = async () => {
    await refetchQR();
    startTimer();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start timer when QR data loads
  createEffect(() => {
    if (qrData()) {
      startTimer();
    }
  });

  // Cleanup timer on unmount
  onCleanup(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  // Generate QR code image when data is available
  createEffect(async () => {
    const data = qrData();
    if (data?.data) {
      try {
        const url = await QRCode.toDataURL(data.data, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrImageUrl(url);
      } catch (e) {
        console.error('Failed to generate QR image:', e);
      }
    }
  });

  const handleComplete = async () => {
    if (!scanData().trim()) {
      setError('Please enter the exchange data');
      return;
    }

    try {
      const exchangeResult = (await invoke('complete_exchange', {
        data: scanData(),
      })) as ExchangeResult;
      setResult(exchangeResult);
      setError('');
      setScanData('');
      if (exchangeResult.success) {
        const moment = await checkAhaMomentWithContext(
          'first_contact_added',
          exchangeResult.contact_name
        );
        if (moment) {
          setAhaMoment(moment);
          setTimeout(() => setAhaMoment(null), 4000);
        }
      }
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
  };

  const copyToClipboard = async () => {
    const data = qrData()?.data;
    if (data) {
      await navigator.clipboard.writeText(data);
    }
  };

  return (
    <div class="page exchange" role="main" aria-labelledby="exchange-title">
      <header role="banner">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('home')}
          aria-label="Go back to home"
        >
          {t('action.back')}
        </button>
        <h1 id="exchange-title">{t('exchange.title')}</h1>
      </header>

      <section class="qr-section" aria-labelledby="qr-section-title">
        <h2 id="qr-section-title">{t('exchange.your_qr')}</h2>
        <p id="qr-description">{t('exchange.instruction')}</p>

        <Show
          when={qrData()}
          fallback={
            <div class="loading" role="status" aria-live="polite">
              Generating QR...
            </div>
          }
        >
          <div class="qr-container" aria-describedby="qr-description">
            <Show
              when={!isExpired()}
              fallback={
                <div class="qr-expired" role="alert">
                  <p>{t('exchange.expired')}</p>
                  <button onClick={refreshQR} aria-label="Generate a new QR code">
                    {t('exchange.refreshed')}
                  </button>
                </div>
              }
            >
              <Show
                when={qrImageUrl()}
                fallback={
                  <pre class="qr-ascii" aria-label="QR code in ASCII format">
                    {qrData()?.qr_ascii}
                  </pre>
                }
              >
                <img
                  src={qrImageUrl()}
                  alt="Your contact exchange QR code. Show this to someone to let them scan and add you as a contact."
                  class="qr-image"
                />
              </Show>
            </Show>
            <p class="display-name" aria-label={`Display name: ${qrData()?.display_name}`}>
              {qrData()?.display_name}
            </p>

            <div
              class={`qr-timer ${timeRemaining() <= 30 ? 'warning' : ''} ${isExpired() ? 'expired' : ''}`}
              role="timer"
              aria-live="polite"
              aria-atomic="true"
            >
              <Show when={!isExpired()} fallback={<span>{t('exchange.expired')}</span>}>
                <span>{tArgs('exchange.expires_in', { time: formatTime(timeRemaining()) })}</span>
              </Show>
              <button class="refresh-btn small" onClick={refreshQR} aria-label="Refresh QR code">
                ↻
              </button>
            </div>
          </div>
        </Show>

        <div class="copy-section">
          <p>Or share this data:</p>
          <div class="copy-input-group">
            <input type="text" readonly value={qrData()?.data || ''} />
            <button class="copy-btn" onClick={copyToClipboard} aria-label="Copy exchange data to clipboard">
              Copy
            </button>
          </div>
        </div>
      </section>

      <section class="scan-section" aria-labelledby="scan-section-title">
        <h2 id="scan-section-title">{t('exchange.title')}</h2>
        <p id="scan-description">Paste the exchange data from another user</p>

        <input
          type="text"
          placeholder="Paste exchange data here..."
          value={scanData()}
          onInput={(e) => setScanData(e.target.value)}
          aria-label="Exchange data input"
          aria-describedby="scan-description"
          aria-invalid={error() ? 'true' : undefined}
        />

        <Show when={error()}>
          <p class="error" role="alert" aria-live="assertive">
            {error()}
          </p>
        </Show>

        <Show when={result()}>
          <div class={result()?.success ? 'success' : 'warning'} role="status" aria-live="polite">
            <p>{result()?.message}</p>
            <Show when={result()?.success}>
              <p>Added: {result()?.contact_name}</p>
            </Show>
          </div>
        </Show>

        <button onClick={handleComplete} aria-label="Complete the contact exchange">
          {t('exchange.title')}
        </button>
      </section>

      <Show when={ahaMoment()}>
        <div class="aha-moment" role="status" aria-live="polite">
          <h2>{ahaMoment()!.title}</h2>
          <p>{ahaMoment()!.message}</p>
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
        <button class="nav-btn active" aria-current="page" aria-label="Exchange (current page)">
          {t('exchange.title')}
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

export default Exchange;
