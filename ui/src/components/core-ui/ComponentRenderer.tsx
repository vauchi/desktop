// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Switch, Match } from 'solid-js';
import type {
  Component,
  UserAction,
  TextComponent,
  TextInputComponent,
  ToggleListComponent,
  FieldListComponent,
  CardPreviewComponent,
  InfoPanelComponent,
} from '../../types/core-ui';
import { componentType } from '../../types/core-ui';
import TextDisplay from './TextDisplay';
import TextInputField from './TextInputField';
import ToggleListPanel from './ToggleListPanel';
import FieldListPanel from './FieldListPanel';
import CardPreviewPanel from './CardPreviewPanel';
import InfoPanelDisplay from './InfoPanelDisplay';

interface ComponentRendererProps {
  component: Component;
  onAction: (action: UserAction) => void;
}

/** Extract data from a non-string component by key. */
function getData<K extends string>(comp: Component, key: K): unknown {
  if (typeof comp === 'string') return undefined;
  return (comp as Record<string, unknown>)[key];
}

/**
 * Maps a Component enum variant to the appropriate SolidJS component.
 *
 * This is the central dispatch for core-driven UI rendering.
 * Serde serializes Rust enum variants as { "VariantName": { ...fields } }
 * or plain strings for unit variants like "Divider".
 *
 * Uses SolidJS Switch/Match for idiomatic reactive rendering.
 */
export default function ComponentRenderer(props: ComponentRendererProps) {
  const variant = () => componentType(props.component);

  return (
    <Switch fallback={null}>
      <Match when={variant() === 'Divider'}>
        <hr class="core-divider" />
      </Match>
      <Match when={variant() === 'Text'}>
        <TextDisplay data={getData(props.component, 'Text') as TextComponent} />
      </Match>
      <Match when={variant() === 'TextInput'}>
        <TextInputField
          data={getData(props.component, 'TextInput') as TextInputComponent}
          onAction={props.onAction}
        />
      </Match>
      <Match when={variant() === 'ToggleList'}>
        <ToggleListPanel
          data={getData(props.component, 'ToggleList') as ToggleListComponent}
          onAction={props.onAction}
        />
      </Match>
      <Match when={variant() === 'FieldList'}>
        <FieldListPanel
          data={getData(props.component, 'FieldList') as FieldListComponent}
          onAction={props.onAction}
        />
      </Match>
      <Match when={variant() === 'CardPreview'}>
        <CardPreviewPanel
          data={getData(props.component, 'CardPreview') as CardPreviewComponent}
          onAction={props.onAction}
        />
      </Match>
      <Match when={variant() === 'InfoPanel'}>
        <InfoPanelDisplay data={getData(props.component, 'InfoPanel') as InfoPanelComponent} />
      </Match>
    </Switch>
  );
}
