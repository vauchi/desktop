// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import ComponentRenderer from '../ComponentRenderer';
import type { Component } from '../../../types/core-ui';

describe('ComponentRenderer', () => {
  it('renders a Divider as <hr>', () => {
    const { container } = render(() => (
      <ComponentRenderer component={'Divider' as Component} onAction={() => {}} />
    ));
    const hr = container.querySelector('hr.core-divider');
    expect(hr).not.toBeNull();
  });

  it('renders a Text component', () => {
    const comp: Component = {
      Text: { id: 'txt-1', content: 'Hello', style: 'Body' },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('Hello');
  });

  it('renders a TextInput component', () => {
    const comp: Component = {
      TextInput: {
        id: 'inp-1',
        label: 'Name',
        value: 'Bob',
        input_type: 'Text',
      },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input!.value).toBe('Bob');
  });

  it('renders a ToggleList component', () => {
    const comp: Component = {
      ToggleList: {
        id: 'tgl-1',
        label: 'Groups',
        items: [{ id: 'a', label: 'Item A', selected: false }],
      },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const legend = container.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toBe('Groups');
  });

  it('renders an InfoPanel component', () => {
    const comp: Component = {
      InfoPanel: {
        id: 'info-1',
        title: 'Info',
        items: [{ title: 'Fact', detail: 'Details' }],
      },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const title = container.querySelector('.info-panel-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Info');
  });

  it('renders a FieldList component', () => {
    const comp: Component = {
      FieldList: {
        id: 'fl-1',
        fields: [{ id: 'f1', field_type: 'Text', label: 'Name', value: 'X', visibility: 'Shown' }],
        visibility_mode: 'ShowHide',
        available_groups: [],
      },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const fieldLabel = container.querySelector('.field-label');
    expect(fieldLabel).not.toBeNull();
    expect(fieldLabel!.textContent).toBe('Name');
  });

  it('renders a CardPreview component', () => {
    const comp: Component = {
      CardPreview: {
        name: 'Eve',
        fields: [],
        group_views: [],
      },
    };
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    const name = container.querySelector('.card-name');
    expect(name).not.toBeNull();
    expect(name!.textContent).toBe('Eve');
  });

  it('renders nothing for unknown variant', () => {
    // Use an object with an unknown key to test fallback
    const comp = { UnknownThing: { id: 'x' } } as unknown as Component;
    const { container } = render(() => (
      <ComponentRenderer component={comp} onAction={() => {}} />
    ));
    // Switch fallback is null, so container should only have the wrapper div
    expect(container.children.length).toBe(0);
  });
});
