// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { For, Show } from 'solid-js';
import type {
  FieldListComponent,
  FieldDisplay,
  UiFieldVisibility,
  UserAction,
} from '../../types/core-ui';

interface FieldListPanelProps {
  data: FieldListComponent;
  onAction: (action: UserAction) => void;
}

function isShown(visibility: UiFieldVisibility): boolean {
  return visibility === 'Shown';
}

function isHidden(visibility: UiFieldVisibility): boolean {
  return visibility === 'Hidden';
}

function visibleGroups(visibility: UiFieldVisibility): string[] {
  if (typeof visibility === 'object' && 'Groups' in visibility) {
    return visibility.Groups;
  }
  return [];
}

/**
 * Renders a Component::FieldList variant.
 *
 * In ShowHide mode: each field has a Shown/Hidden toggle chip.
 * In PerGroup mode: each field has group name chips for visibility.
 */
export default function FieldListPanel(props: FieldListPanelProps) {
  const handleShowHideToggle = (field: FieldDisplay) => {
    props.onAction({
      FieldVisibilityChanged: {
        field_id: field.id,
        group_id: null,
        visible: !isShown(field.visibility),
      },
    });
  };

  const handleGroupToggle = (field: FieldDisplay, groupName: string) => {
    const groups = visibleGroups(field.visibility);
    const isInGroup = groups.includes(groupName);
    props.onAction({
      FieldVisibilityChanged: {
        field_id: field.id,
        group_id: groupName,
        visible: !isInGroup,
      },
    });
  };

  return (
    <div
      class="core-field-list"
      data-component-id={props.data.id}
      role="list"
      aria-label="Contact fields"
    >
      <For each={props.data.fields}>
        {(field) => (
          <div
            class={`field-row ${isHidden(field.visibility) ? 'field-hidden' : ''}`}
            role="listitem"
          >
            <div class="field-info">
              <span class="field-label">{field.label}</span>
              <span class="field-value">{field.value}</span>
            </div>
            <div class="field-visibility" role="group" aria-label={`Visibility for ${field.label}`}>
              <Show when={props.data.visibility_mode === 'ShowHide'}>
                <button
                  type="button"
                  class={`chip ${isShown(field.visibility) ? 'chip-active' : 'chip-inactive'}`}
                  onClick={() => handleShowHideToggle(field)}
                  aria-pressed={isShown(field.visibility)}
                >
                  {isShown(field.visibility) ? 'Shown' : 'Hidden'}
                </button>
              </Show>
              <Show when={props.data.visibility_mode === 'PerGroup'}>
                <For each={props.data.available_groups}>
                  {(group) => {
                    const groups = () => visibleGroups(field.visibility);
                    const active = () => groups().includes(group);
                    return (
                      <button
                        type="button"
                        class={`chip ${active() ? 'chip-active' : 'chip-inactive'}`}
                        onClick={() => handleGroupToggle(field, group)}
                        aria-pressed={active()}
                      >
                        {group}
                      </button>
                    );
                  }}
                </For>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
