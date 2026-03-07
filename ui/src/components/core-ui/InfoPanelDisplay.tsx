// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { For, Show } from 'solid-js';
import type { InfoPanelComponent } from '../../types/core-ui';

interface InfoPanelDisplayProps {
  data: InfoPanelComponent;
}

/**
 * Renders a Component::InfoPanel variant.
 *
 * Styled information box with an optional icon, title, and list items.
 */
export default function InfoPanelDisplay(props: InfoPanelDisplayProps) {
  return (
    <div class="core-info-panel" data-component-id={props.data.id} role="region" aria-label={props.data.title}>
      <div class="info-panel-header">
        <Show when={props.data.icon}>
          <span class="info-panel-icon" aria-hidden="true">
            {props.data.icon}
          </span>
        </Show>
        <h3 class="info-panel-title">{props.data.title}</h3>
      </div>
      <ul class="info-panel-items" role="list">
        <For each={props.data.items}>
          {(item) => (
            <li class="info-panel-item">
              <Show when={item.icon}>
                <span class="info-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              </Show>
              <div class="info-item-content">
                <span class="info-item-title">{item.title}</span>
                <span class="info-item-detail">{item.detail}</span>
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
