// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * TypeScript types matching the Rust core UI types.
 *
 * Serde serializes Rust enums with named fields as:
 *   { "VariantName": { "field": "value" } }
 * Unit variants serialize as strings: "Divider"
 */

// === Screen types ===

export interface ScreenModel {
  screen_id: string;
  title: string;
  subtitle?: string;
  components: Component[];
  actions: ScreenAction[];
  progress?: Progress;
}

export interface Progress {
  current_step: number;
  total_steps: number;
  label?: string;
}

export interface ScreenAction {
  id: string;
  label: string;
  style: ActionStyle;
  enabled: boolean;
}

export type ActionStyle = 'Primary' | 'Secondary' | 'Destructive';

// === Component types ===

/**
 * Matches the Rust `Component` enum serialized by serde.
 *
 * Serde default (externally tagged) produces:
 *   { "Text": { "id": "...", "content": "...", "style": "Body" } }
 *   "Divider"
 */
export type Component =
  | { Text: TextComponent }
  | { TextInput: TextInputComponent }
  | { ToggleList: ToggleListComponent }
  | { FieldList: FieldListComponent }
  | { CardPreview: CardPreviewComponent }
  | { InfoPanel: InfoPanelComponent }
  | 'Divider';

export interface TextComponent {
  id: string;
  content: string;
  style: TextStyle;
}

export type TextStyle = 'Title' | 'Subtitle' | 'Body' | 'Caption';

export interface TextInputComponent {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  max_length?: number;
  validation_error?: string;
  input_type: InputType;
}

export type InputType = 'Text' | 'Phone' | 'Email';

export interface ToggleListComponent {
  id: string;
  label: string;
  items: ToggleItem[];
}

export interface ToggleItem {
  id: string;
  label: string;
  selected: boolean;
  subtitle?: string;
}

export interface FieldListComponent {
  id: string;
  fields: FieldDisplay[];
  visibility_mode: VisibilityMode;
  available_groups: string[];
}

export type VisibilityMode = 'ShowHide' | 'PerGroup';

export interface FieldDisplay {
  id: string;
  field_type: string;
  label: string;
  value: string;
  visibility: UiFieldVisibility;
}

/**
 * Serde serializes this as:
 *   "Shown" | "Hidden" | { "Groups": ["Family", "Friends"] }
 */
export type UiFieldVisibility = 'Shown' | 'Hidden' | { Groups: string[] };

export interface CardPreviewComponent {
  name: string;
  fields: FieldDisplay[];
  group_views: GroupCardView[];
  selected_group?: string;
}

export interface GroupCardView {
  group_name: string;
  display_name: string;
  visible_fields: FieldDisplay[];
}

export interface InfoPanelComponent {
  id: string;
  icon?: string;
  title: string;
  items: InfoItem[];
}

export interface InfoItem {
  icon?: string;
  title: string;
  detail: string;
}

// === Action types ===

/**
 * Matches the Rust `UserAction` enum (externally tagged serde).
 */
export type UserAction =
  | { TextChanged: { component_id: string; value: string } }
  | { ItemToggled: { component_id: string; item_id: string } }
  | { ActionPressed: { action_id: string } }
  | {
      FieldVisibilityChanged: {
        field_id: string;
        group_id?: string;
        visible: boolean;
      };
    }
  | { GroupViewSelected: { group_name?: string } };

/**
 * Matches the Rust `ActionResult` enum (externally tagged serde).
 */
export type ActionResult =
  | { UpdateScreen: ScreenModel }
  | { NavigateTo: ScreenModel }
  | { ValidationError: { component_id: string; message: string } }
  | 'Complete';

// === Helper functions ===

/** Extract the variant key from a Component. */
export function componentType(
  comp: Component
): 'Text' | 'TextInput' | 'ToggleList' | 'FieldList' | 'CardPreview' | 'InfoPanel' | 'Divider' {
  if (typeof comp === 'string') return 'Divider';
  const keys = Object.keys(comp) as (keyof Exclude<Component, string>)[];
  return keys[0];
}

/** Extract the data from a Component by variant name. */
export function componentData<K extends keyof Exclude<Component, string>>(
  comp: Component,
  key: K
): Exclude<Component, string>[K] | undefined {
  if (typeof comp === 'string') return undefined;
  return (comp as Record<string, unknown>)[key] as Exclude<Component, string>[K] | undefined;
}
