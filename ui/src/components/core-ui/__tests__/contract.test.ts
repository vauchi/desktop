// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CORE_DIR = path.resolve(process.cwd(), '../../core/vauchi-core');
const SCHEMAS_DIR = path.join(CORE_DIR, 'schemas');
const FIXTURES_DIR = path.join(CORE_DIR, 'tests/fixtures/golden');

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const screenModelSchema = loadJson(
  path.join(SCHEMAS_DIR, 'screen-model.schema.json'),
);
const userActionSchema = loadJson(
  path.join(SCHEMAS_DIR, 'user-action.schema.json'),
);
const actionResultSchema = loadJson(
  path.join(SCHEMAS_DIR, 'action-result.schema.json'),
);

const ajv = new Ajv({
  allErrors: true,
  formats: { uint: true, uint8: true },
});

describe('Contract: golden fixtures validate against ScreenModel schema', () => {
  const fixtureFiles = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.json'));

  expect(fixtureFiles.length).toBeGreaterThan(0);

  const validateScreenModel = ajv.compile(screenModelSchema);

  for (const file of fixtureFiles) {
    it(`${file} matches ScreenModel schema`, () => {
      const fixture = loadJson(path.join(FIXTURES_DIR, file));
      const valid = validateScreenModel(fixture);
      if (!valid) {
        expect.fail(
          `Schema validation failed for ${file}:\n${JSON.stringify(validateScreenModel.errors, null, 2)}`,
        );
      }
      expect(valid).toBe(true);
    });
  }
});

describe('Contract: UserAction variants validate against schema', () => {
  const validateUserAction = ajv.compile(userActionSchema);

  const variants = [
    {
      name: 'TextChanged',
      payload: { TextChanged: { component_id: 'name_input', value: 'Alice' } },
    },
    {
      name: 'ItemToggled',
      payload: {
        ItemToggled: { component_id: 'groups_list', item_id: 'family' },
      },
    },
    {
      name: 'ActionPressed',
      payload: { ActionPressed: { action_id: 'continue' } },
    },
    {
      name: 'FieldVisibilityChanged',
      payload: {
        FieldVisibilityChanged: {
          field_id: 'email',
          visible: true,
          group_id: null,
        },
      },
    },
    {
      name: 'FieldVisibilityChanged with group',
      payload: {
        FieldVisibilityChanged: {
          field_id: 'phone',
          visible: false,
          group_id: 'family',
        },
      },
    },
    {
      name: 'GroupViewSelected with group',
      payload: { GroupViewSelected: { group_name: 'Friends' } },
    },
    {
      name: 'GroupViewSelected with null',
      payload: { GroupViewSelected: { group_name: null } },
    },
  ];

  for (const { name, payload } of variants) {
    it(`${name} variant is valid`, () => {
      const valid = validateUserAction(payload);
      if (!valid) {
        expect.fail(
          `Schema validation failed for ${name}:\n${JSON.stringify(validateUserAction.errors, null, 2)}`,
        );
      }
      expect(valid).toBe(true);
    });
  }

  it('rejects unknown variant', () => {
    const invalid = { UnknownAction: { foo: 'bar' } };
    const valid = validateUserAction(invalid);
    expect(valid).toBe(false);
  });

  it('rejects TextChanged missing required field', () => {
    const invalid = { TextChanged: { component_id: 'x' } };
    const valid = validateUserAction(invalid);
    expect(valid).toBe(false);
  });
});

describe('Contract: ActionResult variants validate against schema', () => {
  const validateActionResult = ajv.compile(actionResultSchema);

  it('Complete variant is valid', () => {
    const valid = validateActionResult('Complete');
    if (!valid) {
      expect.fail(
        `Schema validation failed for Complete:\n${JSON.stringify(validateActionResult.errors, null, 2)}`,
      );
    }
    expect(valid).toBe(true);
  });

  it('UpdateScreen variant is valid', () => {
    const screenModel = loadJson(path.join(FIXTURES_DIR, 'welcome.json'));
    const payload = { UpdateScreen: screenModel };
    const valid = validateActionResult(payload);
    if (!valid) {
      expect.fail(
        `Schema validation failed for UpdateScreen:\n${JSON.stringify(validateActionResult.errors, null, 2)}`,
      );
    }
    expect(valid).toBe(true);
  });

  it('NavigateTo variant is valid', () => {
    const screenModel = loadJson(path.join(FIXTURES_DIR, 'default_name.json'));
    const payload = { NavigateTo: screenModel };
    const valid = validateActionResult(payload);
    if (!valid) {
      expect.fail(
        `Schema validation failed for NavigateTo:\n${JSON.stringify(validateActionResult.errors, null, 2)}`,
      );
    }
    expect(valid).toBe(true);
  });

  it('ValidationError variant is valid', () => {
    const payload = {
      ValidationError: {
        component_id: 'display_name',
        message: 'Name cannot be empty',
      },
    };
    const valid = validateActionResult(payload);
    if (!valid) {
      expect.fail(
        `Schema validation failed for ValidationError:\n${JSON.stringify(validateActionResult.errors, null, 2)}`,
      );
    }
    expect(valid).toBe(true);
  });

  it('rejects unknown variant', () => {
    const valid = validateActionResult('UnknownResult');
    expect(valid).toBe(false);
  });

  it('rejects ValidationError missing required field', () => {
    const invalid = { ValidationError: { component_id: 'x' } };
    const valid = validateActionResult(invalid);
    expect(valid).toBe(false);
  });
});
