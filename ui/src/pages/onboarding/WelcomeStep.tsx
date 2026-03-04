// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { t } from '../../services/i18nService';

interface WelcomeStepProps {
  onNext: () => void;
}

function WelcomeStep(props: WelcomeStepProps) {
  return (
    <div class="onboarding-step welcome-step">
      <div class="step-icon" aria-hidden="true">
        <span class="welcome-icon">{'\uD83D\uDD10'}</span>
      </div>

      <h1 id="onboarding-title">{t('onboarding.welcome.title') || 'Welcome to Vauchi'}</h1>

      <p class="step-subtitle">
        {t('onboarding.welcome.subtitle') || 'Your privacy-first digital contact card'}
      </p>

      <ul
        class="feature-list"
        aria-label={t('onboarding.welcome.features_label') || 'Key features'}
      >
        <li>
          <span class="feature-icon" aria-hidden="true">
            {'\uD83D\uDD12'}
          </span>
          <div>
            <strong>{t('onboarding.welcome.feature_encrypted') || 'End-to-end encrypted'}</strong>
            <p>
              {t('onboarding.welcome.feature_encrypted_desc') ||
                'Only you and your contacts can see your information'}
            </p>
          </div>
        </li>
        <li>
          <span class="feature-icon" aria-hidden="true">
            {'\uD83D\uDD04'}
          </span>
          <div>
            <strong>{t('onboarding.welcome.feature_updates') || 'Always up to date'}</strong>
            <p>
              {t('onboarding.welcome.feature_updates_desc') ||
                'Change your number? Everyone gets the update automatically'}
            </p>
          </div>
        </li>
        <li>
          <span class="feature-icon" aria-hidden="true">
            {'\uD83D\uDC65'}
          </span>
          <div>
            <strong>{t('onboarding.welcome.feature_exchange') || 'In-person exchange'}</strong>
            <p>
              {t('onboarding.welcome.feature_exchange_desc') ||
                'Share contact cards by scanning QR codes face to face'}
            </p>
          </div>
        </li>
      </ul>

      <div class="step-actions">
        <button
          type="button"
          onClick={() => props.onNext()}
          autofocus
          aria-label={t('onboarding.welcome.get_started') || 'Get Started'}
        >
          {t('onboarding.welcome.get_started') || 'Get Started'}
        </button>
      </div>
    </div>
  );
}

export default WelcomeStep;
