// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import type { TextInputComponent, InputType, UserAction } from '../../types/core-ui';

interface TextInputFieldProps {
  data: TextInputComponent;
  onAction: (action: UserAction) => void;
}

function inputTypeAttr(inputType: InputType): string {
  switch (inputType) {
    case 'Phone':
      return 'tel';
    case 'Email':
      return 'email';
    case 'Text':
    default:
      return 'text';
  }
}

/**
 * Renders a Component::TextInput variant.
 *
 * Sends UserAction::TextChanged on input change.
 */
export default function TextInputField(props: TextInputFieldProps) {
  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    props.onAction({
      TextChanged: {
        component_id: props.data.id,
        value: target.value,
      },
    });
  };

  return (
    <div
      class={`core-text-input ${props.data.validation_error ? 'has-error' : ''}`}
      data-component-id={props.data.id}
    >
      <label for={`input-${props.data.id}`}>{props.data.label}</label>
      <input
        id={`input-${props.data.id}`}
        type={inputTypeAttr(props.data.input_type)}
        value={props.data.value}
        placeholder={props.data.placeholder ?? ''}
        maxLength={props.data.max_length}
        onInput={handleInput}
        aria-describedby={props.data.validation_error ? `error-${props.data.id}` : undefined}
        aria-invalid={props.data.validation_error ? 'true' : undefined}
      />
      {props.data.validation_error && (
        <p id={`error-${props.data.id}`} class="error" role="alert" aria-live="polite">
          {props.data.validation_error}
        </p>
      )}
    </div>
  );
}
