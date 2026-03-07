// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { For } from 'solid-js';
import type { ToggleListComponent, UserAction } from '../../types/core-ui';

interface ToggleListPanelProps {
  data: ToggleListComponent;
  onAction: (action: UserAction) => void;
}

/**
 * Renders a Component::ToggleList variant.
 *
 * Each item is a checkbox/toggle. Sends UserAction::ItemToggled on change.
 */
export default function ToggleListPanel(props: ToggleListPanelProps) {
  const handleToggle = (itemId: string) => {
    props.onAction({
      ItemToggled: {
        component_id: props.data.id,
        item_id: itemId,
      },
    });
  };

  return (
    <fieldset
      class="core-toggle-list"
      data-component-id={props.data.id}
      role="group"
      aria-label={props.data.label}
    >
      <legend>{props.data.label}</legend>
      <ul class="toggle-items" role="list">
        <For each={props.data.items}>
          {(item) => (
            <li class={`toggle-item ${item.selected ? 'selected' : ''}`}>
              <label class="toggle-label" for={`toggle-${props.data.id}-${item.id}`}>
                <input
                  id={`toggle-${props.data.id}-${item.id}`}
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => handleToggle(item.id)}
                  role="switch"
                  aria-checked={item.selected}
                />
                <span class="toggle-text">
                  <span class="toggle-item-label">{item.label}</span>
                  {item.subtitle && <span class="toggle-item-subtitle">{item.subtitle}</span>}
                </span>
              </label>
            </li>
          )}
        </For>
      </ul>
    </fieldset>
  );
}
