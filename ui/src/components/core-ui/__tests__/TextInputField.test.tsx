// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import TextInputField from '../TextInputField';
import type { TextInputComponent, UserAction } from '../../../types/core-ui';

function makeInput(overrides: Partial<TextInputComponent> = {}): TextInputComponent {
  return {
    id: 'input-1',
    label: 'Display Name',
    value: '',
    input_type: 'Text',
    ...overrides,
  };
}

describe('TextInputField', () => {
  it('renders a label and input element', () => {
    const { container } = render(() => (
      <TextInputField data={makeInput()} onAction={() => {}} />
    ));
    const label = container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Display Name');

    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input!.type).toBe('text');
  });

  it('sets input type to tel for Phone', () => {
    const { container } = render(() => (
      <TextInputField data={makeInput({ input_type: 'Phone' })} onAction={() => {}} />
    ));
    const input = container.querySelector('input');
    expect(input!.type).toBe('tel');
  });

  it('sets input type to email for Email', () => {
    const { container } = render(() => (
      <TextInputField data={makeInput({ input_type: 'Email' })} onAction={() => {}} />
    ));
    const input = container.querySelector('input');
    expect(input!.type).toBe('email');
  });

  it('displays placeholder text', () => {
    const { container } = render(() => (
      <TextInputField
        data={makeInput({ placeholder: 'Enter name' })}
        onAction={() => {}}
      />
    ));
    const input = container.querySelector('input');
    expect(input!.placeholder).toBe('Enter name');
  });

  it('displays validation error when present', () => {
    const { container } = render(() => (
      <TextInputField
        data={makeInput({ validation_error: 'Name required' })}
        onAction={() => {}}
      />
    ));
    const error = container.querySelector('[role="alert"]');
    expect(error).not.toBeNull();
    expect(error!.textContent).toBe('Name required');

    const wrapper = container.querySelector('.core-text-input');
    expect(wrapper!.classList.contains('has-error')).toBe(true);

    const input = container.querySelector('input');
    expect(input!.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not render error element when no validation error', () => {
    const { container } = render(() => (
      <TextInputField data={makeInput()} onAction={() => {}} />
    ));
    const error = container.querySelector('[role="alert"]');
    expect(error).toBeNull();

    const wrapper = container.querySelector('.core-text-input');
    expect(wrapper!.classList.contains('has-error')).toBe(false);
  });

  it('fires TextChanged action on input', async () => {
    const onAction = vi.fn();
    const { container } = render(() => (
      <TextInputField data={makeInput({ id: 'name-field' })} onAction={onAction} />
    ));
    const input = container.querySelector('input')!;
    await fireEvent.input(input, { target: { value: 'Alice' } });

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    expect(action).toHaveProperty('TextChanged');
    expect((action as { TextChanged: { component_id: string; value: string } }).TextChanged.component_id).toBe('name-field');
  });

  it('sets data-component-id on wrapper', () => {
    const { container } = render(() => (
      <TextInputField data={makeInput({ id: 'my-input' })} onAction={() => {}} />
    ));
    const wrapper = container.querySelector('[data-component-id="my-input"]');
    expect(wrapper).not.toBeNull();
  });

  it('respects maxLength attribute', () => {
    const { container } = render(() => (
      <TextInputField
        data={makeInput({ max_length: 50 })}
        onAction={() => {}}
      />
    ));
    const input = container.querySelector('input');
    expect(input!.maxLength).toBe(50);
  });
});
