// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Tauri IPC Mock for Playwright VRT
 *
 * Injects a mock __TAURI_INTERNALS__ so the SolidJS frontend renders
 * without the Rust backend. Used only for visual regression testing.
 */

/** State held in the browser context between invoke() calls. */
interface MockState {
  hasIdentity: boolean;
  displayName: string;
  fields: Array<{
    id: string;
    field_type: string;
    label: string;
    value: string;
  }>;
  contacts: Array<{
    id: string;
    display_name: string;
    public_key_hex: string;
  }>;
  nextFieldId: number;
}

/**
 * Returns a script string that can be injected via page.addInitScript().
 * Mocks window.__TAURI_INTERNALS__ to handle invoke() calls.
 */
export function tauriMockScript(): string {
  return `
    (() => {
      // Restore state from sessionStorage to survive location.reload()
      const saved = sessionStorage.getItem('__tauri_mock_state__');
      const state = saved ? JSON.parse(saved) : {
        hasIdentity: false,
        displayName: '',
        fields: [],
        contacts: [],
        nextFieldId: 1,
      };

      function persistState() {
        sessionStorage.setItem('__tauri_mock_state__', JSON.stringify(state));
      }

      const handlers = {
        has_identity: () => state.hasIdentity,

        create_identity: (args) => {
          state.hasIdentity = true;
          state.displayName = args.name || 'Test User';
          persistState();
          return null;
        },

        get_identity_info: () => ({
          display_name: state.displayName,
          public_id: 'ab'.repeat(16),
          public_key_hex: 'ab'.repeat(32),
          created_at: Date.now(),
          device_count: 1,
        }),

        get_card: () => ({
          display_name: state.displayName,
          fields: state.fields,
        }),

        add_field: (args) => {
          const id = 'field-' + state.nextFieldId++;
          state.fields.push({
            id,
            field_type: args.fieldType || args.field_type || 'email',
            label: args.label || '',
            value: args.value || '',
          });
          persistState();
          return id;
        },

        update_field: (args) => {
          const f = state.fields.find((f) => f.id === args.fieldId);
          if (f && args.newValue !== undefined) f.value = args.newValue;
          persistState();
          return null;
        },

        remove_field: (args) => {
          state.fields = state.fields.filter((f) => f.id !== args.fieldId);
          persistState();
          return null;
        },

        list_contacts: () => state.contacts,

        get_contact: (args) => {
          const c = state.contacts.find((c) => c.id === args.id);
          if (!c) throw new Error('Contact not found');
          return {
            ...c,
            fields: [{ id: 'cf-1', field_type: 'email', label: 'Email', value: 'contact@example.com' }],
            is_verified: false,
            is_blocked: false,
            is_hidden: false,
          };
        },

        get_contact_fingerprint: () => ({
          fingerprint: 'AB CD EF 01 23 45 67 89',
          algorithm: 'SHA-256',
        }),

        verify_contact: () => null,
        remove_contact: (args) => {
          state.contacts = state.contacts.filter((c) => c.id !== args.id);
          persistState();
          return null;
        },

        get_visibility_rules: () => [],
        set_field_visibility: () => null,
        get_field_viewers: () => [],

        generate_qr: () => ({
          data: 'vauchi://mock-exchange-data',
          display_name: state.displayName || 'Test User',
          qr_ascii: '█▀▀▀▀▀█ MOCK QR █▀▀▀▀▀█',
        }),

        complete_exchange: (args) => {
          const id = 'contact-' + (state.contacts.length + 1);
          state.contacts.push({
            id,
            display_name: 'New Contact',
            public_key_hex: 'cd'.repeat(32),
          });
          persistState();
          return { success: true, contact_name: 'New Contact', contact_id: id, message: 'Contact added' };
        },

        list_devices: () => [{
          device_id: 'dev-001',
          name: 'This Device',
          is_current: true,
          created_at: Date.now(),
        }],

        generate_device_link: () => 'vauchi://link/mock-data',
        join_device: () => ({ success: true }),
        revoke_device: () => null,

        get_sync_status: () => ({
          connected: false,
          last_sync: null,
          pending_updates: 0,
        }),
        sync: () => ({ synced: 0, errors: [] }),
        get_relay_url: () => 'wss://relay.vauchi.app',
        set_relay_url: () => null,

        check_password_strength: (args) => {
          const pw = args.password || '';
          if (pw.length < 4) return { strength: 'Weak', score: 0, feedback: ['Too short'] };
          if (pw.length < 8) return { strength: 'Fair', score: 1, feedback: ['Add more characters'] };
          if (pw.length < 12) return { strength: 'Good', score: 2, feedback: [] };
          return { strength: 'Strong', score: 3, feedback: [] };
        },

        export_backup: () => ({ success: true, data: btoa('mock-backup-data'), error: null }),
        import_backup: () => 'Backup restored successfully',
        update_display_name: (args) => { state.displayName = args.name; persistState(); return null; },

        get_recovery_settings: () => ({ trusted_contacts: [], threshold: 2 }),
        create_recovery_claim: () => 'mock-claim-b64',
        parse_recovery_claim: () => ({ public_key_hex: 'ab'.repeat(32), created_at: Date.now() }),
        create_recovery_voucher: () => 'mock-voucher-b64',
        check_recovery_claim: () => ({ status: 'pending' }),

        check_content_updates: () => ({ available: false }),
        apply_content_updates: () => null,
        get_content_settings: () => ({ enabled: true, last_check: null }),
        set_content_updates_enabled: () => null,
        get_social_networks: () => [],

        get_available_themes: () => [
          { id: 'dark-default', name: 'Dark', mode: 'dark' },
          { id: 'light-default', name: 'Light', mode: 'light' },
        ],
        get_theme: () => ({
          id: 'dark-default',
          name: 'Dark',
          mode: 'dark',
          author: null,
          colors: {
            bg_primary: '#1a1a2e',
            bg_secondary: '#16213e',
            bg_tertiary: '#0f3460',
            text_primary: '#e0e0e0',
            text_secondary: '#a0a0a0',
            accent: '#00d4aa',
            accent_dark: '#00a882',
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800',
            border: '#2a2a4a',
          },
        }),
        get_default_theme_id: () => 'dark-default',

        get_locales: () => [
          { code: 'en', name: 'English', english_name: 'English', is_rtl: false },
          { code: 'de', name: 'Deutsch', english_name: 'German', is_rtl: false },
          { code: 'fr', name: 'Fran\\u00e7ais', english_name: 'French', is_rtl: false },
          { code: 'es', name: 'Espa\\u00f1ol', english_name: 'Spanish', is_rtl: false },
        ],
        get_localized_string: (args) => args.key || '',
        get_locale_strings: (args) => {
          const locale = args.localeCode || args.locale || 'en';
          const de = locale === 'de';
          return {
            // App
            'app.tagline': de ? 'Deine digitale Visitenkarte' : 'Your digital contact card',
            'welcome.title': de ? 'Willkommen bei Vauchi' : 'Welcome to Vauchi',
            // Setup
            'setup.enter_name': de ? 'Deinen Namen eingeben' : 'Enter your name',
            'setup.get_started': de ? 'Los geht\\'s' : 'Get Started',
            'setup.creating': de ? 'Wird erstellt...' : 'Creating...',
            // Home
            'home.greeting': de ? 'Hallo, {name}!' : 'Hello, {name}!',
            'home.no_fields': de ? 'Noch keine Felder' : 'No fields yet',
            'home.public_id': de ? '\\u00d6ffentliche ID' : 'Public ID',
            // Navigation
            'nav.home': de ? 'Start' : 'Home',
            'nav.contacts': de ? 'Kontakte' : 'Contacts',
            'nav.exchange': de ? 'Austausch' : 'Exchange',
            'nav.settings': de ? 'Einstellungen' : 'Settings',
            // Card
            'card.title': de ? 'Deine Karte' : 'Your Card',
            'card.add_field': de ? 'Feld hinzuf\\u00fcgen' : 'Add Field',
            'card.edit_field': de ? 'Feld bearbeiten' : 'Edit Field',
            'card.field_type': de ? 'Feldtyp' : 'Field Type',
            'card.label': de ? 'Bezeichnung' : 'Label',
            'card.value': de ? 'Wert' : 'Value',
            'card.enter_label': de ? 'Bezeichnung eingeben' : 'Enter label',
            'card.enter_value': de ? 'Wert eingeben' : 'Enter value',
            // Contacts
            'contacts.title': de ? 'Kontakte' : 'Contacts',
            'contacts.empty': de ? 'Noch keine Kontakte' : 'No contacts yet',
            'contacts.search': de ? 'Kontakte suchen' : 'Search contacts',
            'contacts.detail': de ? 'Kontaktdetails' : 'Contact Details',
            'contacts.verified': de ? 'Verifiziert' : 'Verified',
            'contacts.not_verified': de ? 'Nicht verifiziert' : 'Not Verified',
            // Exchange
            'exchange.title': de ? 'Austausch' : 'Exchange',
            'exchange.your_qr': de ? 'Dein QR-Code' : 'Your QR Code',
            'exchange.instruction': de ? 'Zeige diesen Code zum Austauschen' : 'Show this code to exchange',
            'exchange.expired': de ? 'Abgelaufen' : 'Expired',
            'exchange.refreshed': de ? 'Aktualisiert' : 'Refreshed',
            // Settings
            'settings.title': de ? 'Einstellungen' : 'Settings',
            'settings.display_name': de ? 'Anzeigename' : 'Display Name',
            'settings.identity': de ? 'Identit\\u00e4t' : 'Identity',
            'settings.appearance': de ? 'Darstellung' : 'Appearance',
            'settings.theme': de ? 'Thema' : 'Theme',
            'settings.language': de ? 'Sprache' : 'Language',
            'settings.relay': de ? 'Relay-Server' : 'Relay Server',
            'settings.about': de ? '\\u00dcber' : 'About',
            'settings.help_support': de ? 'Hilfe & Support' : 'Help & Support',
            // Backup
            'backup.title': de ? 'Sicherung' : 'Backup',
            // Sync
            'sync.title': de ? 'Synchronisieren' : 'Sync',
            // Devices
            'devices.title': de ? 'Ger\\u00e4te' : 'Devices',
            'devices.linked': de ? 'Verbunden' : 'Linked',
            'devices.generate_link': de ? 'Link erstellen' : 'Generate Link',
            'devices.revoke': de ? 'Widerrufen' : 'Revoke',
            // Recovery
            'recovery.title': de ? 'Wiederherstellung' : 'Recovery',
            'recovery.how_it_works': de ? 'So funktioniert es' : 'How it works',
            'recovery.create_claim': de ? 'Anspruch erstellen' : 'Create Claim',
            'recovery.vouch': de ? 'B\\u00fcrgen' : 'Vouch',
            'recovery.claim_active': de ? 'Anspruch aktiv' : 'Claim Active',
            'recovery.step1': de ? 'Schritt 1' : 'Step 1',
            'recovery.step2': de ? 'Schritt 2' : 'Step 2',
            'recovery.step3': de ? 'Schritt 3' : 'Step 3',
            'recovery.step4': de ? 'Schritt 4' : 'Step 4',
            'recovery.step5': de ? 'Schritt 5' : 'Step 5',
            // Help
            'help.title': de ? 'Hilfe' : 'Help',
            // Visibility
            'visibility.title': de ? 'Sichtbarkeit' : 'Visibility',
            // Actions
            'action.save': de ? 'Speichern' : 'Save',
            'action.cancel': de ? 'Abbrechen' : 'Cancel',
            'action.delete': de ? 'L\\u00f6schen' : 'Delete',
            'action.edit': de ? 'Bearbeiten' : 'Edit',
            'action.done': de ? 'Fertig' : 'Done',
            'action.back': de ? 'Zur\\u00fcck' : 'Back',
            // Errors
            'error.validation': de ? 'Validierungsfehler' : 'Validation error',
          };
        },

        get_help_categories: () => ['Getting Started', 'Exchange', 'Privacy'],
        get_all_faqs: () => [
          { id: '1', category: 'Getting Started', question: 'How do I start?', answer: 'Create your identity.' },
        ],
        search_help: () => [],

        // Aha moments
        check_aha_moment_localized: () => null,
        check_aha_moment_with_context: () => null,

        // Field validation
        validate_contact_field: () => ({ field_id: 'f-1', validator_name: 'Test', trust_level: 'low_confidence', timestamp: Date.now() }),
        get_field_validation_status: () => ({ trust_level: 'unverified', validation_count: 0, validations: [] }),
        revoke_field_validation: () => true,
        get_field_validation_count: () => 0,
        list_my_validations: () => [],

        // Localized help
        get_all_faqs_localized: () => [
          { id: '1', category: 'Getting Started', question: 'How do I start?', answer: 'Create your identity.' },
        ],
        search_help_localized: () => [],

        open_contact_field: () => ({ opened: true }),
        get_field_action: () => ({ action: 'open', url: '' }),

        // Search / hidden contacts
        search_contacts: (args) => {
          const q = (args.query || '').toLowerCase();
          return state.contacts.filter((c) => c.display_name.toLowerCase().includes(q));
        },
        list_hidden_contacts: () => [],
        hide_contact: () => null,
        unhide_contact: () => null,
        trust_contact: () => null,
        untrust_contact: () => null,

        // GDPR / Privacy
        get_deletion_state: () => ({ state: 'none', scheduled_at: 0, execute_at: 0, days_remaining: 0 }),
        get_consent_records: () => [],
        grant_consent: () => null,
        revoke_consent: () => null,
        export_gdpr_data: () => JSON.stringify({ exported: true }),
        schedule_account_deletion: () => ({ state: 'scheduled', scheduled_at: Date.now(), execute_at: Date.now() + 30*86400*1000, days_remaining: 30 }),
        cancel_account_deletion: () => null,
      };

      window.__TAURI_INTERNALS__ = {
        invoke: (cmd, args = {}) => {
          const handler = handlers[cmd];
          if (!handler) {
            console.warn('[tauri-mock] unhandled command:', cmd, args);
            return Promise.resolve(null);
          }
          try {
            const result = handler(args);
            return Promise.resolve(result);
          } catch (e) {
            return Promise.reject(e);
          }
        },
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        convertFileSrc: (path) => path,
      };
    })();
  `;
}
