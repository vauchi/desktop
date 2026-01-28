// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface SetupProps {
  onComplete: () => void;
}

function Setup(props: SetupProps) {
  const [name, setName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleCreate = async () => {
    if (!name().trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await invoke('create_identity', { name: name() });
      props.onComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="page setup" role="main" aria-labelledby="setup-title">
      <div class="setup-container">
        <h1 id="setup-title">Welcome to Vauchi</h1>
        <p id="setup-description">Privacy-focused contact card exchange</p>

        <form
          class="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          aria-describedby="setup-description"
        >
          <label for="name">Your Display Name</label>
          <input
            id="name"
            type="text"
            placeholder="Enter your name"
            value={name()}
            onInput={(e) => setName(e.target.value)}
            disabled={loading()}
            aria-describedby={error() ? 'name-error' : undefined}
            aria-invalid={error() ? 'true' : undefined}
            aria-required="true"
          />

          {error() && (
            <p id="name-error" class="error" role="alert" aria-live="polite">
              {error()}
            </p>
          )}

          <button
            type="submit"
            disabled={loading()}
            aria-busy={loading()}
            aria-label={
              loading() ? 'Creating your identity' : 'Get started and create your identity'
            }
          >
            {loading() ? 'Creating...' : 'Get Started'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Setup;
