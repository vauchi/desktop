// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import CardPreviewPanel from '../CardPreviewPanel';
import type { CardPreviewComponent, UserAction } from '../../../types/core-ui';

function makeCard(overrides: Partial<CardPreviewComponent> = {}): CardPreviewComponent {
  return {
    name: 'Alice',
    fields: [
      { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41 79 123', visibility: 'Shown' },
      { id: 'email', field_type: 'Email', label: 'Email', value: 'alice@test.ch', visibility: 'Shown' },
      { id: 'addr', field_type: 'Text', label: 'Address', value: '123 Main St', visibility: 'Hidden' },
    ],
    group_views: [],
    ...overrides,
  };
}

describe('CardPreviewPanel', () => {
  it('renders the card name', () => {
    const { container } = render(() => (
      <CardPreviewPanel data={makeCard()} onAction={() => {}} />
    ));
    const name = container.querySelector('.card-name');
    expect(name).not.toBeNull();
    expect(name!.textContent).toBe('Alice');
  });

  it('shows non-hidden fields', () => {
    const { container } = render(() => (
      <CardPreviewPanel data={makeCard()} onAction={() => {}} />
    ));
    const fields = container.querySelectorAll('.card-field');
    // Only Shown fields (Phone, Email), not Hidden (Address)
    expect(fields.length).toBe(2);
    expect(fields[0].querySelector('.card-field-label')!.textContent).toBe('Phone');
    expect(fields[1].querySelector('.card-field-label')!.textContent).toBe('Email');
  });

  it('shows empty message when all fields are hidden', () => {
    const data = makeCard({
      fields: [
        { id: 'f1', field_type: 'Text', label: 'X', value: 'Y', visibility: 'Hidden' },
      ],
    });
    const { container } = render(() => (
      <CardPreviewPanel data={data} onAction={() => {}} />
    ));
    const empty = container.querySelector('.card-empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe('No fields to show');
  });

  it('does not render group selector when no group views', () => {
    const { container } = render(() => (
      <CardPreviewPanel data={makeCard()} onAction={() => {}} />
    ));
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeNull();
  });

  it('renders group selector tabs when group views exist', () => {
    const data = makeCard({
      group_views: [
        {
          group_name: 'Family',
          display_name: 'Alice (Family)',
          visible_fields: [
            { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41 79 123', visibility: 'Shown' },
          ],
        },
        {
          group_name: 'Friends',
          display_name: 'Alice',
          visible_fields: [],
        },
      ],
    });
    const { container } = render(() => (
      <CardPreviewPanel data={data} onAction={() => {}} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    // "All" + "Family" + "Friends"
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toBe('All');
    expect(tabs[1].textContent).toBe('Family');
    expect(tabs[2].textContent).toBe('Friends');
  });

  it('fires GroupViewSelected when group tab is clicked', async () => {
    const onAction = vi.fn();
    const data = makeCard({
      group_views: [
        {
          group_name: 'Family',
          display_name: 'Alice',
          visible_fields: [],
        },
      ],
    });
    const { container } = render(() => (
      <CardPreviewPanel data={data} onAction={onAction} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    await fireEvent.click(tabs[1]); // Click "Family" tab

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    expect(action).toHaveProperty('GroupViewSelected');
    expect((action as { GroupViewSelected: { group_name?: string } }).GroupViewSelected.group_name).toBe('Family');
  });

  it('fires GroupViewSelected with undefined when All tab is clicked', async () => {
    const onAction = vi.fn();
    const data = makeCard({
      group_views: [
        { group_name: 'Family', display_name: 'Alice', visible_fields: [] },
      ],
    });
    const { container } = render(() => (
      <CardPreviewPanel data={data} onAction={onAction} />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    await fireEvent.click(tabs[0]); // Click "All" tab

    expect(onAction).toHaveBeenCalledOnce();
    const action = onAction.mock.calls[0][0] as { GroupViewSelected: { group_name?: string } };
    expect(action.GroupViewSelected.group_name).toBeUndefined();
  });

  it('shows group-specific fields when a group is selected', () => {
    const data = makeCard({
      selected_group: 'Family',
      group_views: [
        {
          group_name: 'Family',
          display_name: 'Alice (Family)',
          visible_fields: [
            { id: 'phone', field_type: 'Phone', label: 'Phone', value: '+41', visibility: 'Shown' },
          ],
        },
      ],
    });
    const { container } = render(() => (
      <CardPreviewPanel data={data} onAction={() => {}} />
    ));
    const name = container.querySelector('.card-name');
    expect(name!.textContent).toBe('Alice (Family)');

    const fields = container.querySelectorAll('.card-field');
    expect(fields.length).toBe(1);
  });

  it('has aria-label on card preview region', () => {
    const { container } = render(() => (
      <CardPreviewPanel data={makeCard()} onAction={() => {}} />
    ));
    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-label')).toBe('Card preview');
  });
});
