// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import ToggleListPanel from '../ToggleListPanel';
import type { ToggleListComponent, UserAction } from '../../../types/core-ui';

function makeToggleList(overrides: Partial<ToggleListComponent> = {}): ToggleListComponent {
  return {
    id: 'groups-list',
    label: 'Select Groups',
    items: [
      { id: 'family', label: 'Family', selected: true },
      { id: 'friends', label: 'Friends', selected: false },
      { id: 'coworkers', label: 'Coworkers', selected: false, subtitle: 'Work contacts' },
    ],
    ...overrides,
  };
}

describe('ToggleListPanel', () => {
  it('renders legend with label', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const legend = container.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toBe('Select Groups');
  });

  it('renders all toggle items', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
  });

  it('checks selected items and unchecks unselected', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[2] as HTMLInputElement).checked).toBe(false);
  });

  it('displays subtitles when present', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const subtitles = container.querySelectorAll('.toggle-item-subtitle');
    expect(subtitles.length).toBe(1);
    expect(subtitles[0].textContent).toBe('Work contacts');
  });

  it('fires ItemToggled action on checkbox change', async () => {
    const onAction = vi.fn();
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={onAction} />
    ));
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    await fireEvent.change(checkboxes[1]);

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    expect(action).toHaveProperty('ItemToggled');
    const toggled = (action as { ItemToggled: { component_id: string; item_id: string } }).ItemToggled;
    expect(toggled.component_id).toBe('groups-list');
    expect(toggled.item_id).toBe('friends');
  });

  it('renders empty list when no items', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList({ items: [] })} onAction={() => {}} />
    ));
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('applies selected class to selected items', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const items = container.querySelectorAll('.toggle-item');
    expect(items[0].classList.contains('selected')).toBe(true);
    expect(items[1].classList.contains('selected')).toBe(false);
  });

  it('has aria-label on fieldset', () => {
    const { container } = render(() => (
      <ToggleListPanel data={makeToggleList()} onAction={() => {}} />
    ));
    const fieldset = container.querySelector('fieldset');
    expect(fieldset!.getAttribute('aria-label')).toBe('Select Groups');
  });
});
