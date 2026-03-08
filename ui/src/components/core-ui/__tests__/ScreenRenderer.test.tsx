// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import ScreenRenderer from '../ScreenRenderer';
import type { ScreenModel, UserAction } from '../../../types/core-ui';

function makeScreen(overrides: Partial<ScreenModel> = {}): ScreenModel {
  return {
    screen_id: 'welcome',
    title: 'Welcome',
    components: [],
    actions: [],
    ...overrides,
  };
}

describe('ScreenRenderer', () => {
  it('renders screen title', () => {
    const { container } = render(() => (
      <ScreenRenderer screen={makeScreen()} onAction={() => {}} />
    ));
    const title = container.querySelector('.core-screen-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Welcome');
  });

  it('renders subtitle when present', () => {
    const { container } = render(() => (
      <ScreenRenderer screen={makeScreen({ subtitle: 'Get started' })} onAction={() => {}} />
    ));
    const subtitle = container.querySelector('.core-screen-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toBe('Get started');
  });

  it('does not render subtitle when absent', () => {
    const { container } = render(() => (
      <ScreenRenderer screen={makeScreen()} onAction={() => {}} />
    ));
    const subtitle = container.querySelector('.core-screen-subtitle');
    expect(subtitle).toBeNull();
  });

  it('renders progress bar when progress is set', () => {
    const screen = makeScreen({
      progress: { current_step: 2, total_steps: 5 },
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar!.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar!.getAttribute('aria-valuemax')).toBe('5');
  });

  it('renders progress with custom label', () => {
    const screen = makeScreen({
      progress: { current_step: 1, total_steps: 3, label: 'Step 1: Name' },
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const label = container.querySelector('.core-progress-label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Step 1: Name');
  });

  it('does not render progress when absent', () => {
    const { container } = render(() => (
      <ScreenRenderer screen={makeScreen()} onAction={() => {}} />
    ));
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeNull();
  });

  it('renders action buttons', () => {
    const screen = makeScreen({
      actions: [
        { id: 'next', label: 'Next', style: 'Primary', enabled: true },
        { id: 'skip', label: 'Skip', style: 'Secondary', enabled: true },
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const buttons = container.querySelectorAll('.step-actions button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('Next');
    expect(buttons[1].textContent).toBe('Skip');
  });

  it('disables buttons when enabled is false', () => {
    const screen = makeScreen({
      actions: [
        { id: 'next', label: 'Next', style: 'Primary', enabled: false },
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const button = container.querySelector('.step-actions button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('fires ActionPressed on button click', async () => {
    const onAction = vi.fn();
    const screen = makeScreen({
      actions: [
        { id: 'continue', label: 'Continue', style: 'Primary', enabled: true },
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={onAction} />
    ));
    const button = container.querySelector('.step-actions button')!;
    await fireEvent.click(button);

    expect(onAction).toHaveBeenCalledOnce();
    const action: UserAction = onAction.mock.calls[0][0];
    expect(action).toHaveProperty('ActionPressed');
    expect((action as { ActionPressed: { action_id: string } }).ActionPressed.action_id).toBe('continue');
  });

  it('applies secondary class for Secondary style', () => {
    const screen = makeScreen({
      actions: [
        { id: 'skip', label: 'Skip', style: 'Secondary', enabled: true },
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const button = container.querySelector('.step-actions button')!;
    expect(button.classList.contains('secondary')).toBe(true);
  });

  it('applies destructive class for Destructive style', () => {
    const screen = makeScreen({
      actions: [
        { id: 'delete', label: 'Delete', style: 'Destructive', enabled: true },
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const button = container.querySelector('.step-actions button')!;
    expect(button.classList.contains('destructive')).toBe(true);
  });

  it('renders components via ComponentRenderer', () => {
    const screen = makeScreen({
      components: [
        { Text: { id: 'desc', content: 'Welcome text', style: 'Body' } },
        'Divider',
      ],
    });
    const { container } = render(() => (
      <ScreenRenderer screen={screen} onAction={() => {}} />
    ));
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('Welcome text');

    const hr = container.querySelector('hr.core-divider');
    expect(hr).not.toBeNull();
  });

  it('sets data-screen-id on wrapper', () => {
    const { container } = render(() => (
      <ScreenRenderer screen={makeScreen({ screen_id: 'onboarding-1' })} onAction={() => {}} />
    ));
    const wrapper = container.querySelector('[data-screen-id="onboarding-1"]');
    expect(wrapper).not.toBeNull();
  });
});
