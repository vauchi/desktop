// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { t } from '../../services/i18nService';

interface ReadyStepProps {
  displayName: string;
  onComplete: () => void;
}

function ReadyStep(props: ReadyStepProps) {
  return (
    <div class="onboarding-step ready-step">
      <div class="ready-celebration" aria-hidden="true">
        <span class="celebration-icon">{'\uD83C\uDF89'}</span>
      </div>

      <h2>
        {t('onboarding.ready.title') || "You're all set!"}
      </h2>
      <p class="step-subtitle">
        {t('onboarding.ready.subtitle') || `Welcome, ${props.displayName}! Your contact card is ready to share.`}
      </p>

      <div class="ready-tips" role="list" aria-label={t('onboarding.ready.tips_label') || 'Getting started tips'}>
        <div class="ready-tip" role="listitem">
          <span class="tip-icon" aria-hidden="true">{'\uD83D\uDCF1'}</span>
          <div>
            <strong>{t('onboarding.ready.tip_exchange_title') || 'Exchange Cards'}</strong>
            <p>{t('onboarding.ready.tip_exchange_desc') || 'Meet someone? Scan their QR code to exchange contact cards instantly.'}</p>
          </div>
        </div>

        <div class="ready-tip" role="listitem">
          <span class="tip-icon" aria-hidden="true">{'\u270F\uFE0F'}</span>
          <div>
            <strong>{t('onboarding.ready.tip_edit_title') || 'Edit Your Card'}</strong>
            <p>{t('onboarding.ready.tip_edit_desc') || 'Add or update your contact details anytime from the home screen.'}</p>
          </div>
        </div>

        <div class="ready-tip" role="listitem">
          <span class="tip-icon" aria-hidden="true">{'\uD83D\uDD04'}</span>
          <div>
            <strong>{t('onboarding.ready.tip_auto_title') || 'Automatic Updates'}</strong>
            <p>{t('onboarding.ready.tip_auto_desc') || 'Change your info and everyone who has your card gets updated automatically.'}</p>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button
          type="button"
          onClick={props.onComplete}
          autofocus
          aria-label={t('onboarding.ready.start') || 'Start using Vauchi'}
        >
          {t('onboarding.ready.start') || 'Start using Vauchi'}
        </button>
      </div>
    </div>
  );
}

export default ReadyStep;
