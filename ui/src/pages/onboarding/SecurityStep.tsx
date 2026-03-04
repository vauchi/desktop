// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { t } from '../../services/i18nService';

interface SecurityStepProps {
  onNext: () => void;
  onBack: () => void;
}

function SecurityStep(props: SecurityStepProps) {
  return (
    <div class="onboarding-step security-step">
      <h2>{t('onboarding.security.title') || 'Your Data is Secure'}</h2>
      <p class="step-description">
        {t('onboarding.security.description') || 'Vauchi is designed with privacy and security at its core.'}
      </p>

      <div class="security-features" role="list" aria-label={t('onboarding.security.features_label') || 'Security features'}>
        <div class="security-feature" role="listitem">
          <div class="security-icon" aria-hidden="true">{'\uD83D\uDD10'}</div>
          <div>
            <h3>{t('onboarding.security.e2e_title') || 'End-to-End Encryption'}</h3>
            <p>
              {t('onboarding.security.e2e_desc') || 'Your contact card is encrypted so that only people you exchange with can read it. Not even our servers can see your data.'}
            </p>
          </div>
        </div>

        <div class="security-feature" role="listitem">
          <div class="security-icon" aria-hidden="true">{'\uD83D\uDEAB'}</div>
          <div>
            <h3>{t('onboarding.security.no_server_title') || 'No Server Access'}</h3>
            <p>
              {t('onboarding.security.no_server_desc') || 'The relay server only passes encrypted messages. It never stores or reads your contact information.'}
            </p>
          </div>
        </div>

        <div class="security-feature" role="listitem">
          <div class="security-icon" aria-hidden="true">{'\uD83D\uDCF1'}</div>
          <div>
            <h3>{t('onboarding.security.local_title') || 'Data Stays on Your Device'}</h3>
            <p>
              {t('onboarding.security.local_desc') || 'Your identity and contacts are stored locally on your device. You control your data.'}
            </p>
          </div>
        </div>

        <div class="security-feature" role="listitem">
          <div class="security-icon" aria-hidden="true">{'\uD83D\uDD04'}</div>
          <div>
            <h3>{t('onboarding.security.updates_title') || 'Automatic Updates'}</h3>
            <p>
              {t('onboarding.security.updates_desc') || 'When you update your card, contacts receive the update automatically through encrypted channels.'}
            </p>
          </div>
        </div>
      </div>

      <div class="step-actions step-actions-split">
        <button type="button" class="secondary" onClick={() => props.onBack()}>
          {t('onboarding.back') || 'Back'}
        </button>
        <button type="button" onClick={() => props.onNext()}>
          {t('onboarding.next') || 'Next'}
        </button>
      </div>
    </div>
  );
}

export default SecurityStep;
