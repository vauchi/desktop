// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { open } from '@tauri-apps/plugin-shell';
import { t } from '../services/i18nService';

interface SupportUsProps {
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

function SupportUs(props: SupportUsProps) {
  return (
    <div class="page support-page">
      <header class="page-header">
        <button
          class="back-btn"
          onClick={() => props.onNavigate('settings')}
          aria-label="Back to settings"
        >
          &larr;
        </button>
        <h1>{t('support.title')}</h1>
      </header>

      <div class="support-content">
        <p class="support-description">{t('support.description')}</p>

        <div class="support-links" role="group" aria-label="Funding platforms">
          <button
            class="support-btn github-sponsors"
            onClick={() => open('https://github.com/sponsors/vauchi')}
            aria-label="Open GitHub Sponsors in browser"
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {t('support.github_sponsors')}
          </button>
          <button
            class="support-btn liberapay"
            onClick={() => open('https://liberapay.com/Vauchi/donate')}
            aria-label="Open Liberapay in browser"
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {t('support.liberapay')}
          </button>
        </div>

        <section class="funds-table" aria-labelledby="funds-heading">
          <h2 id="funds-heading">{t('support.where_funds_go')}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('support.category_hardware')}</th>
                <th scope="col">{t('support.category_infrastructure')}</th>
                <th scope="col">{t('support.category_security')}</th>
                <th scope="col">{t('support.category_development')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('support.purpose_hardware')}</td>
                <td>{t('support.purpose_infrastructure')}</td>
                <td>{t('support.purpose_security')}</td>
                <td>{t('support.purpose_development')}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default SupportUs;
