// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import FieldListPanel from '../FieldListPanel';
import type { FieldListComponent, UserAction } from '../../../types/core-ui';

function makeFieldList(overrides: Partial<FieldListComponent> = {}): FieldListComponent {
  return {
    id: 'fields-1',
    fields: [
      { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41 79 123 45 67', visibility: 'Shown' },
      { id: 'email', field_type: 'Email', label: 'Email', value: 'alice@example.com', visibility: 'Hidden' },
    ],
    visibility_mode: 'ShowHide',
    available_groups: [],
    ...overrides,
  };
}

describe('FieldListPanel', () => {
  it('renders all fields with labels and values', () => {
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList()} onAction={() => {}} />
    ));
    const labels = container.querySelectorAll('.field-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toBe('Phone');
    expect(labels[1].textContent).toBe('Email');

    const values = container.querySelectorAll('.field-value');
    expect(values[0].textContent).toBe('+41 79 123 45 67');
    expect(values[1].textContent).toBe('alice@example.com');
  });

  it('shows Shown/Hidden chips in ShowHide mode', () => {
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList()} onAction={() => {}} />
    ));
    const chips = container.querySelectorAll('.chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toBe('Shown');
    expect(chips[1].textContent).toBe('Hidden');
  });

  it('applies field-hidden class to hidden fields', () => {
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList()} onAction={() => {}} />
    ));
    const rows = container.querySelectorAll('.field-row');
    expect(rows[0].classList.contains('field-hidden')).toBe(false);
    expect(rows[1].classList.contains('field-hidden')).toBe(true);
  });

  it('fires FieldVisibilityChanged on chip click in ShowHide mode', async () => {
    const onAction = vi.fn();
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList()} onAction={onAction} />
    ));
    const chips = container.querySelectorAll('.chip');
    await fireEvent.click(chips[0]); // Click "Shown" chip to toggle off

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    expect(action).toHaveProperty('FieldVisibilityChanged');
    const fvc = (action as { FieldVisibilityChanged: { field_id: string; group_id: string | null; visible: boolean } }).FieldVisibilityChanged;
    expect(fvc.field_id).toBe('phone');
    expect(fvc.group_id).toBeNull();
    expect(fvc.visible).toBe(false); // toggling from Shown -> not visible
  });

  it('renders group chips in PerGroup mode', () => {
    const data = makeFieldList({
      visibility_mode: 'PerGroup',
      available_groups: ['Family', 'Friends'],
      fields: [
        { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41', visibility: { Groups: ['Family'] } },
      ],
    });
    const { container } = render(() => (
      <FieldListPanel data={data} onAction={() => {}} />
    ));
    const chips = container.querySelectorAll('.chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toBe('Family');
    expect(chips[1].textContent).toBe('Friends');
    expect(chips[0].classList.contains('chip-active')).toBe(true);
    expect(chips[1].classList.contains('chip-inactive')).toBe(true);
  });

  it('fires FieldVisibilityChanged with group_id in PerGroup mode', async () => {
    const onAction = vi.fn();
    const data = makeFieldList({
      visibility_mode: 'PerGroup',
      available_groups: ['Family', 'Friends'],
      fields: [
        { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41', visibility: { Groups: ['Family'] } },
      ],
    });
    const { container } = render(() => (
      <FieldListPanel data={data} onAction={onAction} />
    ));
    const chips = container.querySelectorAll('.chip');
    await fireEvent.click(chips[1]); // Click "Friends" chip

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    const fvc = (action as { FieldVisibilityChanged: { field_id: string; group_id: string; visible: boolean } }).FieldVisibilityChanged;
    expect(fvc.field_id).toBe('phone');
    expect(fvc.group_id).toBe('Friends');
    expect(fvc.visible).toBe(true); // Friends was not in Groups, so toggling to visible
  });

  it('renders empty state when no fields', () => {
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList({ fields: [] })} onAction={() => {}} />
    ));
    const rows = container.querySelectorAll('.field-row');
    expect(rows.length).toBe(0);
  });

  it('sets aria-label on wrapper', () => {
    const { container } = render(() => (
      <FieldListPanel data={makeFieldList()} onAction={() => {}} />
    ));
    const wrapper = container.querySelector('[role="list"]');
    expect(wrapper!.getAttribute('aria-label')).toBe('Contact fields');
  });
});
