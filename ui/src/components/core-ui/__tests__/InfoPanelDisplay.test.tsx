// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import InfoPanelDisplay from '../InfoPanelDisplay';
import type { InfoPanelComponent } from '../../../types/core-ui';

function makeInfoPanel(overrides: Partial<InfoPanelComponent> = {}): InfoPanelComponent {
  return {
    id: 'info-1',
    title: 'Security Info',
    items: [
      { title: 'End-to-end encrypted', detail: 'Your data is encrypted on your device' },
      { title: 'No tracking', detail: 'We never track you', icon: 'privacy' },
    ],
    ...overrides,
  };
}

describe('InfoPanelDisplay', () => {
  it('renders the title', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel()} />
    ));
    const title = container.querySelector('.info-panel-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Security Info');
  });

  it('renders all info items', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel()} />
    ));
    const items = container.querySelectorAll('.info-panel-item');
    expect(items.length).toBe(2);

    expect(items[0].querySelector('.info-item-title')!.textContent).toBe('End-to-end encrypted');
    expect(items[0].querySelector('.info-item-detail')!.textContent).toBe('Your data is encrypted on your device');
    expect(items[1].querySelector('.info-item-title')!.textContent).toBe('No tracking');
  });

  it('renders icon when present on panel', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel({ icon: 'shield' })} />
    ));
    const icon = container.querySelector('.info-panel-icon');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('shield');
  });

  it('does not render icon when absent on panel', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel()} />
    ));
    const icon = container.querySelector('.info-panel-icon');
    expect(icon).toBeNull();
  });

  it('renders item icons when present', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel()} />
    ));
    const itemIcons = container.querySelectorAll('.info-item-icon');
    // Only the second item has an icon
    expect(itemIcons.length).toBe(1);
    expect(itemIcons[0].textContent).toBe('privacy');
  });

  it('sets data-component-id on wrapper', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel({ id: 'sec-panel' })} />
    ));
    const wrapper = container.querySelector('[data-component-id="sec-panel"]');
    expect(wrapper).not.toBeNull();
  });

  it('has aria-label matching the title', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel({ title: 'Privacy' })} />
    ));
    const region = container.querySelector('[role="region"]');
    expect(region!.getAttribute('aria-label')).toBe('Privacy');
  });

  it('renders empty state with no items', () => {
    const { container } = render(() => (
      <InfoPanelDisplay data={makeInfoPanel({ items: [] })} />
    ));
    const items = container.querySelectorAll('.info-panel-item');
    expect(items.length).toBe(0);
    // Title should still be present
    const title = container.querySelector('.info-panel-title');
    expect(title!.textContent).toBe('Security Info');
  });
});
