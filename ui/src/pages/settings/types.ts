// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/** The user's identity as displayed in the settings UI. */
export interface IdentityInfo {
  display_name: string;
  public_id: string;
}

/** Result of an identity backup operation, containing the exported data or an error. */
export interface BackupResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

/** Current state of contact synchronization (pending count, last sync time, active flag). */
export interface SyncStatus {
  pending_updates: number;
  last_sync: number | null;
  is_syncing: boolean;
}

/** Outcome of a completed sync cycle, summarizing contacts added, cards updated, and updates sent. */
export interface SyncResult {
  contacts_added: number;
  cards_updated: number;
  updates_sent: number;
  success: boolean;
  error: string | null;
}

/** User-configurable settings for automatic content update checks. */
export interface ContentSettings {
  enabled: boolean;
  content_url: string;
  check_interval_secs: number;
}

/** Current content update status including available updates and last check timestamp. */
export interface ContentUpdateStatus {
  has_updates: boolean;
  available_updates: string[];
  last_check: number | null;
  enabled: boolean;
  error: string | null;
}

/** Information about a scheduled account deletion, including countdown and execution time. */
export interface DeletionInfo {
  state: string;
  scheduled_at: number;
  execute_at: number;
  days_remaining: number;
}

/** A recorded user consent decision (e.g. analytics, data sharing) with policy version tracking. */
export interface ConsentRecordInfo {
  id: string;
  consent_type: string;
  granted: boolean;
  timestamp: number;
  policy_version: string | null;
}

/** Props for the Settings page component, providing the app-level navigation callback. */
export interface SettingsProps {
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
      | 'contact-duplicates'
      | 'contact-merge'
      | 'contact-settings'
  ) => void;
}
