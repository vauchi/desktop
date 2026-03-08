// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import TextDisplay from '../TextDisplay';
import type { TextComponent, TextStyle } from '../../../types/core-ui';

function makeText(overrides: Partial<TextComponent> = {}): TextComponent {
  return {
    id: 'text-1',
    content: 'Hello World',
    style: 'Body',
    ...overrides,
  };
}

describe('TextDisplay', () => {
  it('renders body text in a <p> element', () => {
    const { container } = render(() => <TextDisplay data={makeText()} />);
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('Hello World');
  });

  it('renders title text in an <h2> element', () => {
    const { container } = render(() => (
      <TextDisplay data={makeText({ style: 'Title', content: 'My Title' })} />
    ));
    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2!.textContent).toBe('My Title');
  });

  it('renders subtitle text in an <h3> element', () => {
    const { container } = render(() => (
      <TextDisplay data={makeText({ style: 'Subtitle', content: 'Sub' })} />
    ));
    const h3 = container.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe('Sub');
  });

  it('renders caption text in a <small> element', () => {
    const { container } = render(() => (
      <TextDisplay data={makeText({ style: 'Caption', content: 'Fine print' })} />
    ));
    const small = container.querySelector('small');
    expect(small).not.toBeNull();
    expect(small!.textContent).toBe('Fine print');
  });

  it('sets data-component-id attribute', () => {
    const { container } = render(() => (
      <TextDisplay data={makeText({ id: 'txt-42' })} />
    ));
    const wrapper = container.querySelector('[data-component-id="txt-42"]');
    expect(wrapper).not.toBeNull();
  });

  it('applies correct style class for each variant', () => {
    const styles: TextStyle[] = ['Title', 'Subtitle', 'Body', 'Caption'];
    const expectedClasses = [
      'core-text-title',
      'core-text-subtitle',
      'core-text-body',
      'core-text-caption',
    ];

    styles.forEach((style, i) => {
      const { container } = render(() => (
        <TextDisplay data={makeText({ style })} />
      ));
      const wrapper = container.querySelector('.core-text');
      expect(wrapper).not.toBeNull();
      expect(wrapper!.classList.contains(expectedClasses[i])).toBe(true);
    });
  });
});
