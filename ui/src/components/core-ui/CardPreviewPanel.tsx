// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { For, Show, createMemo } from 'solid-js';
import type { CardPreviewComponent, FieldDisplay, UserAction } from '../../types/core-ui';

interface CardPreviewPanelProps {
  data: CardPreviewComponent;
  onAction: (action: UserAction) => void;
}

/**
 * Renders a Component::CardPreview variant.
 *
 * Shows a card layout with the user's name and fields.
 * If group views are available, shows a group selector to preview
 * what each group sees.
 */
export default function CardPreviewPanel(props: CardPreviewPanelProps) {
  const hasGroups = () => props.data.group_views.length > 0;

  const selectedView = createMemo(() => {
    if (!props.data.selected_group) return null;
    return props.data.group_views.find((v) => v.group_name === props.data.selected_group) ?? null;
  });

  const displayName = () => {
    const view = selectedView();
    return view ? view.display_name : props.data.name;
  };

  const displayFields = createMemo((): FieldDisplay[] => {
    const view = selectedView();
    if (view) return view.visible_fields;
    // Show all non-hidden fields when no group is selected
    return props.data.fields.filter((f) => f.visibility !== 'Hidden');
  });

  const handleGroupSelect = (groupName: string | undefined) => {
    props.onAction({
      GroupViewSelected: {
        group_name: groupName,
      },
    });
  };

  return (
    <div class="core-card-preview">
      {/* Group view selector */}
      <Show when={hasGroups()}>
        <div class="card-group-selector" role="tablist" aria-label="Group views">
          <button
            type="button"
            class={`chip ${!props.data.selected_group ? 'chip-active' : 'chip-inactive'}`}
            role="tab"
            aria-selected={!props.data.selected_group}
            onClick={() => handleGroupSelect(undefined)}
          >
            All
          </button>
          <For each={props.data.group_views}>
            {(view) => (
              <button
                type="button"
                class={`chip ${props.data.selected_group === view.group_name ? 'chip-active' : 'chip-inactive'}`}
                role="tab"
                aria-selected={props.data.selected_group === view.group_name}
                onClick={() => handleGroupSelect(view.group_name)}
              >
                {view.group_name}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Card preview */}
      <div class="card-preview-content" role="region" aria-label="Card preview">
        <div class="card-name">{displayName()}</div>
        <Show when={displayFields().length > 0} fallback={<p class="card-empty">No fields to show</p>}>
          <ul class="card-fields" role="list">
            <For each={displayFields()}>
              {(field) => (
                <li class="card-field">
                  <span class="card-field-label">{field.label}</span>
                  <span class="card-field-value">{field.value}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </div>
  );
}
