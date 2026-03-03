// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

export interface IdentityInfo {
  display_name: string;
  public_id: string;
}

export interface BackupResult {
  success: boolean;
  data: string | null;
  error: string | null;
}

export interface SyncStatus {
  pending_updates: number;
  last_sync: number | null;
  is_syncing: boolean;
}

export interface SyncResult {
  contacts_added: number;
  cards_updated: number;
  updates_sent: number;
  success: boolean;
  error: string | null;
}

export interface ContentSettings {
  enabled: boolean;
  content_url: string;
  check_interval_secs: number;
}

export interface ContentUpdateStatus {
  has_updates: boolean;
  available_updates: string[];
  last_check: number | null;
  enabled: boolean;
  error: string | null;
}

export interface DeletionInfo {
  state: string;
  scheduled_at: number;
  execute_at: number;
  days_remaining: number;
}

export interface ConsentRecordInfo {
  id: string;
  consent_type: string;
  granted: boolean;
  timestamp: number;
  policy_version: string | null;
}

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
  ) => void;
}
