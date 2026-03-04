// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { t } from '../../services/i18nService';
import WelcomeStep from './WelcomeStep';
import CreateIdentityStep from './CreateIdentityStep';
import AddFieldsStep from './AddFieldsStep';
import PreviewCardStep from './PreviewCardStep';
import SecurityStep from './SecurityStep';
import BackupPromptStep from './BackupPromptStep';
import ReadyStep from './ReadyStep';

export type OnboardingStep =
  | 'welcome'
  | 'create-identity'
  | 'add-fields'
  | 'preview-card'
  | 'security'
  | 'backup-prompt'
  | 'ready';

const STEPS: OnboardingStep[] = [
  'welcome',
  'create-identity',
  'add-fields',
  'preview-card',
  'security',
  'backup-prompt',
  'ready',
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

function OnboardingWizard(props: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = createSignal<OnboardingStep>('welcome');
  const [direction, setDirection] = createSignal<'forward' | 'backward'>('forward');
  const [displayName, setDisplayName] = createSignal('');
  const [identityCreated, setIdentityCreated] = createSignal(false);

  const currentIndex = () => STEPS.indexOf(currentStep());
  const totalSteps = STEPS.length;
  const isFirstStep = () => currentIndex() === 0;
  const isLastStep = () => currentIndex() === totalSteps - 1;

  const goToStep = (step: OnboardingStep) => {
    const targetIndex = STEPS.indexOf(step);
    const current = currentIndex();
    setDirection(targetIndex > current ? 'forward' : 'backward');
    setCurrentStep(step);
  };

  const goNext = () => {
    const idx = currentIndex();
    if (idx < totalSteps - 1) {
      setDirection('forward');
      setCurrentStep(STEPS[idx + 1]);
    }
  };

  const goBack = () => {
    const idx = currentIndex();
    if (idx > 0) {
      setDirection('backward');
      setCurrentStep(STEPS[idx - 1]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Only handle keyboard nav when not in an input/textarea
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    if (e.key === 'Escape' && !isFirstStep()) {
      e.preventDefault();
      goBack();
    }

    // Enter advances except when in input fields (where Enter submits forms)
    if (e.key === 'Enter' && !isInput) {
      e.preventDefault();
      // Only auto-advance on steps that don't have their own Enter handling
      if (
        currentStep() === 'welcome' ||
        currentStep() === 'preview-card' ||
        currentStep() === 'security' ||
        currentStep() === 'ready'
      ) {
        if (isLastStep()) {
          props.onComplete();
        } else {
          goNext();
        }
      }
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  const stepLabel = (step: OnboardingStep): string => {
    switch (step) {
      case 'welcome':
        return t('onboarding.step.welcome') || 'Welcome';
      case 'create-identity':
        return t('onboarding.step.create_identity') || 'Create Identity';
      case 'add-fields':
        return t('onboarding.step.add_fields') || 'Add Fields';
      case 'preview-card':
        return t('onboarding.step.preview_card') || 'Preview';
      case 'security':
        return t('onboarding.step.security') || 'Security';
      case 'backup-prompt':
        return t('onboarding.step.backup') || 'Backup';
      case 'ready':
        return t('onboarding.step.ready') || 'Ready';
    }
  };

  return (
    <main class="page onboarding" aria-labelledby="onboarding-title">
      <div class="onboarding-container">
        {/* Progress indicator */}
        <div
          class="onboarding-progress"
          role="navigation"
          aria-label={t('onboarding.progress.label') || 'Onboarding progress'}
        >
          <ol class="progress-steps">
            {STEPS.map((step, index) => (
              <li
                class={`progress-step ${index < currentIndex() ? 'completed' : ''} ${index === currentIndex() ? 'current' : ''}`}
                aria-current={index === currentIndex() ? 'step' : undefined}
              >
                <span class="progress-dot" aria-hidden="true">
                  {index < currentIndex() ? '\u2713' : index + 1}
                </span>
                <span class="progress-label">{stepLabel(step)}</span>
              </li>
            ))}
          </ol>
          <p class="sr-only" role="status" aria-live="polite">
            {t('onboarding.progress.step_of') ||
              `Step ${currentIndex() + 1} of ${totalSteps}`}
          </p>
        </div>

        {/* Step content with transition */}
        <div
          class={`onboarding-step-content step-${direction()}`}
          role="region"
          aria-label={stepLabel(currentStep())}
        >
          <Show when={currentStep() === 'welcome'}>
            <WelcomeStep onNext={goNext} />
          </Show>
          <Show when={currentStep() === 'create-identity'}>
            <CreateIdentityStep
              onNext={() => {
                goNext();
              }}
              onBack={goBack}
              onIdentityCreated={(name: string) => {
                setDisplayName(name);
                setIdentityCreated(true);
              }}
            />
          </Show>
          <Show when={currentStep() === 'add-fields'}>
            <AddFieldsStep
              onNext={goNext}
              onBack={goBack}
              onSkip={goNext}
            />
          </Show>
          <Show when={currentStep() === 'preview-card'}>
            <PreviewCardStep
              displayName={displayName()}
              onNext={goNext}
              onBack={goBack}
            />
          </Show>
          <Show when={currentStep() === 'security'}>
            <SecurityStep onNext={goNext} onBack={goBack} />
          </Show>
          <Show when={currentStep() === 'backup-prompt'}>
            <BackupPromptStep
              onNext={goNext}
              onBack={goBack}
              onSkip={goNext}
            />
          </Show>
          <Show when={currentStep() === 'ready'}>
            <ReadyStep
              displayName={displayName()}
              onComplete={props.onComplete}
            />
          </Show>
        </div>
      </div>
    </main>
  );
}

export default OnboardingWizard;
