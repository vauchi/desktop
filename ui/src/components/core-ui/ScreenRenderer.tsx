// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { For, Show } from 'solid-js';
import type { ScreenModel, ScreenAction, UserAction } from '../../types/core-ui';
import ComponentRenderer from './ComponentRenderer';

interface ScreenRendererProps {
  screen: ScreenModel;
  onAction: (action: UserAction) => void;
}

function actionButtonClass(action: ScreenAction): string {
  switch (action.style) {
    case 'Primary':
      return '';
    case 'Secondary':
      return 'secondary';
    case 'Destructive':
      return 'destructive';
  }
}

/**
 * Renders a full ScreenModel from core.
 *
 * Layout: optional progress bar, title, subtitle, components, action buttons.
 */
export default function ScreenRenderer(props: ScreenRendererProps) {
  const handleActionPress = (actionId: string) => {
    props.onAction({
      ActionPressed: { action_id: actionId },
    });
  };

  return (
    <div class="core-screen" data-screen-id={props.screen.screen_id}>
      {/* Progress indicator */}
      <Show when={props.screen.progress}>
        {(progress) => (
          <div
            class="core-progress"
            role="progressbar"
            aria-valuenow={progress().current_step}
            aria-valuemin={1}
            aria-valuemax={progress().total_steps}
            aria-label={
              progress().label ?? `Step ${progress().current_step} of ${progress().total_steps}`
            }
          >
            <div class="core-progress-bar">
              <div
                class="core-progress-fill"
                style={{ width: `${(progress().current_step / progress().total_steps) * 100}%` }}
              />
            </div>
            <p class="core-progress-label">
              {progress().label ?? `Step ${progress().current_step} of ${progress().total_steps}`}
            </p>
          </div>
        )}
      </Show>

      {/* Title */}
      <h2 class="core-screen-title">{props.screen.title}</h2>

      {/* Subtitle */}
      <Show when={props.screen.subtitle}>
        {(subtitle) => <p class="core-screen-subtitle">{subtitle()}</p>}
      </Show>

      {/* Components */}
      <div class="core-screen-components">
        <For each={props.screen.components}>
          {(comp) => <ComponentRenderer component={comp} onAction={props.onAction} />}
        </For>
      </div>

      {/* Action buttons */}
      <Show when={props.screen.actions.length > 0}>
        <div class="core-screen-actions step-actions">
          <For each={props.screen.actions}>
            {(action) => (
              <button
                type="button"
                class={actionButtonClass(action)}
                disabled={!action.enabled}
                onClick={() => handleActionPress(action.id)}
              >
                {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
