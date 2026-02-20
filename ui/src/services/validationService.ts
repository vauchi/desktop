// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Field Validation Service
 *
 * Frontend bridge to field validation Tauri commands.
 */

import { invoke } from '@tauri-apps/api/core';

export interface ValidationStatus {
  count: number;
  trust_level: string;
  color: string;
  validated_by_me: boolean;
  display_text: string;
}

export interface FieldValidation {
  contact_id: string;
  field_name: string;
  field_value: string;
  validator_id: string;
  validated_at: number;
}

/**
 * Validate a contact's field (attest that the value is correct).
 */
export async function validateField(
  contactId: string,
  fieldId: string,
  fieldValue: string
): Promise<FieldValidation> {
  return await invoke<FieldValidation>('validate_contact_field', {
    contactId,
    fieldId,
    fieldValue,
  });
}

/**
 * Get the validation status for a contact's field.
 */
export async function getFieldValidationStatus(
  contactId: string,
  fieldId: string,
  fieldValue: string
): Promise<ValidationStatus> {
  return await invoke<ValidationStatus>('get_field_validation_status', {
    contactId,
    fieldId,
    fieldValue,
  });
}

/**
 * Revoke your validation of a field.
 */
export async function revokeFieldValidation(contactId: string, fieldId: string): Promise<boolean> {
  return await invoke<boolean>('revoke_field_validation', {
    contactId,
    fieldId,
  });
}

/**
 * Get the validation count for a field.
 */
export async function getFieldValidationCount(contactId: string, fieldId: string): Promise<number> {
  return await invoke<number>('get_field_validation_count', {
    contactId,
    fieldId,
  });
}

/**
 * List all validations made by the current user.
 */
export async function listMyValidations(): Promise<FieldValidation[]> {
  return await invoke<FieldValidation[]>('list_my_validations');
}
