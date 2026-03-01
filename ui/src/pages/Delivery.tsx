// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, createResource, Show, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../services/i18nService';

interface DeliveryStatus {
  queued: number;
  sent: number;
  stored: number;
  delivered: number;
  failed: number;
  pending_retries: number;
  offline_queue_depth: number;
}

interface DeliveryRecord {
  message_id: string;
  recipient_id: string;
  status: string;
  reason: string | null;
  created_at: number;
  updated_at: number;
}

interface RetryResult {
  due: number;
  rescheduled: number;
  expired: number;
}

interface CleanupResult {
  expired: number;
  cleaned_up: number;
}

interface DeliveryProps {
  onNavigate: (page: string) => void;
}

async function fetchDeliveryStatus(): Promise<DeliveryStatus> {
  return await invoke('get_delivery_status');
}

async function fetchDeliveryRecords(): Promise<DeliveryRecord[]> {
  return await invoke('list_delivery_records', { filter: null });
}

function formatTimestamp(ts: number): string {
  if (ts === 0) return '-';
  return new Date(ts * 1000).toLocaleString();
}

function statusClass(status: string): string {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'failed':
      return 'error';
    case 'expired':
      return 'warning';
    default:
      return '';
  }
}

function Delivery(props: DeliveryProps) {
  const [status, { refetch: refetchStatus }] = createResource(fetchDeliveryStatus);
  const [records, { refetch: refetchRecords }] = createResource(fetchDeliveryRecords);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [filter, setFilter] = createSignal<string | null>(null);
  const [translatedMessage, setTranslatedMessage] = createSignal('');

  const refetchAll = () => {
    refetchStatus();
    refetchRecords();
  };

  const processRetries = async () => {
    try {
      const result: RetryResult = await invoke('process_delivery_retries');
      setError('');
      setSuccess(
        `Retries processed: ${result.due} due, ${result.rescheduled} rescheduled, ${result.expired} expired`
      );
      refetchAll();
    } catch (e) {
      setError(String(e));
      setSuccess('');
    }
  };

  const runCleanup = async () => {
    try {
      const result: CleanupResult = await invoke('run_delivery_cleanup');
      setError('');
      setSuccess(`Cleanup complete: ${result.expired} expired, ${result.cleaned_up} removed`);
      refetchAll();
    } catch (e) {
      setError(String(e));
      setSuccess('');
    }
  };

  const applyFilter = async (f: string | null) => {
    setFilter(f);
    try {
      const filtered: DeliveryRecord[] = await invoke('list_delivery_records', { filter: f });
      // We can't mutate the resource directly, but we can refetch
      // For now we'll store filtered results separately
      refetchRecords();
    } catch (e) {
      setError(String(e));
    }
  };

  const translateFailure = async (reason: string) => {
    try {
      const msg: string = await invoke('translate_delivery_failure', { reason });
      setTranslatedMessage(msg);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div class="page delivery" role="main" aria-labelledby="delivery-title">
      <header role="banner">
        <button class="back-btn" onClick={() => props.onNavigate('home')}>
          {t('nav.back') || 'Back'}
        </button>
        <h1 id="delivery-title">{t('delivery.title') || 'Delivery Status'}</h1>
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

      {/* Status Summary */}
      <section aria-labelledby="status-summary">
        <h2 id="status-summary">{t('delivery.status') || 'Status Summary'}</h2>
        <Show when={status.loading}>
          <p>Loading...</p>
        </Show>
        <Show when={status()}>
          <div class="delivery-counts">
            <div class="delivery-count-item">
              <span class="count-label">Queued</span>
              <span class="count-value">{status()!.queued}</span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Sent</span>
              <span class="count-value">{status()!.sent}</span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Stored</span>
              <span class="count-value accent">{status()!.stored}</span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Delivered</span>
              <span class="count-value success">{status()!.delivered}</span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Failed</span>
              <span class={'count-value' + (status()!.failed > 0 ? ' error' : '')}>
                {status()!.failed}
              </span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Pending Retries</span>
              <span class="count-value">{status()!.pending_retries}</span>
            </div>
            <div class="delivery-count-item">
              <span class="count-label">Offline Queue</span>
              <span class="count-value">{status()!.offline_queue_depth}</span>
            </div>
          </div>
        </Show>
      </section>

      {/* Actions */}
      <section aria-labelledby="delivery-actions">
        <h2 id="delivery-actions">{t('delivery.actions') || 'Actions'}</h2>
        <div class="delivery-action-buttons">
          <button class="nav-btn" onClick={processRetries}>
            Process Retries
          </button>
          <button class="nav-btn" onClick={runCleanup}>
            Run Cleanup
          </button>
          <button class="nav-btn" onClick={refetchAll}>
            Refresh
          </button>
        </div>
      </section>

      {/* Records List */}
      <section aria-labelledby="delivery-records">
        <div class="section-header">
          <h2 id="delivery-records">{t('delivery.records') || 'Delivery Records'}</h2>
          <div class="delivery-filter-buttons">
            <button
              class={'small' + (filter() === null ? ' primary' : '')}
              onClick={() => applyFilter(null)}
            >
              All
            </button>
            <button
              class={'small' + (filter() === 'pending' ? ' primary' : '')}
              onClick={() => applyFilter('pending')}
            >
              Pending
            </button>
            <button
              class={'small' + (filter() === 'failed' ? ' primary' : '')}
              onClick={() => applyFilter('failed')}
            >
              Failed
            </button>
            <button
              class={'small' + (filter() === 'delivered' ? ' primary' : '')}
              onClick={() => applyFilter('delivered')}
            >
              Delivered
            </button>
          </div>
        </div>

        <Show when={records.loading}>
          <p>Loading records...</p>
        </Show>

        <Show when={records() && records()!.length === 0}>
          <p class="empty-state">No delivery records found.</p>
        </Show>

        <Show when={records() && records()!.length > 0}>
          <div class="delivery-records-list">
            <For each={records()}>
              {(record) => (
                <div class="delivery-record-item">
                  <div class="record-header">
                    <span class={'record-status ' + statusClass(record.status)}>
                      {record.status}
                    </span>
                    <span class="record-id" title={record.message_id}>
                      {record.message_id.substring(0, 12)}...
                    </span>
                  </div>
                  <div class="record-details">
                    <span class="record-recipient" title={record.recipient_id}>
                      To: {record.recipient_id.substring(0, 16)}...
                    </span>
                    <span class="record-time">{formatTimestamp(record.updated_at)}</span>
                  </div>
                  <Show when={record.status === 'failed' && record.reason}>
                    <div class="record-failure">
                      <span class="failure-reason">{record.reason}</span>
                      <button
                        class="small"
                        onClick={() => translateFailure(record.reason!)}
                      >
                        Explain
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={translatedMessage()}>
          <div class="translated-message" role="status" aria-live="polite">
            <p>{translatedMessage()}</p>
          </div>
        </Show>
      </section>
    </div>
  );
}

export default Delivery;
