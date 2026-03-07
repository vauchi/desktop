// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Switch, Match } from 'solid-js';
import type { TextComponent, TextStyle } from '../../types/core-ui';

interface TextDisplayProps {
  data: TextComponent;
}

function styleClass(style: TextStyle): string {
  switch (style) {
    case 'Title':
      return 'core-text-title';
    case 'Subtitle':
      return 'core-text-subtitle';
    case 'Body':
      return 'core-text-body';
    case 'Caption':
      return 'core-text-caption';
  }
}

/**
 * Renders a Component::Text variant.
 *
 * Maps TextStyle to semantic HTML elements using SolidJS Switch/Match.
 */
export default function TextDisplay(props: TextDisplayProps) {
  return (
    <div class={`core-text ${styleClass(props.data.style)}`} data-component-id={props.data.id}>
      <Switch>
        <Match when={props.data.style === 'Title'}>
          <h2>{props.data.content}</h2>
        </Match>
        <Match when={props.data.style === 'Subtitle'}>
          <h3>{props.data.content}</h3>
        </Match>
        <Match when={props.data.style === 'Caption'}>
          <small>{props.data.content}</small>
        </Match>
        <Match when={props.data.style === 'Body'}>
          <p>{props.data.content}</p>
        </Match>
      </Switch>
    </div>
  );
}
