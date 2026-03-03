// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface LockProps {
  onUnlock: () => void;
}

function Lock(props: LockProps) {
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');
  const [attempts, setAttempts] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const handleUnlock = async () => {
    const value = pin();
    if (!value) return;

    setLoading(true);
    setError('');

    try {
      const result: string = await invoke('authenticate', { pin: value });

      if (result === 'normal' || result === 'duress') {
        setPin('');
        setAttempts(0);
        props.onUnlock();
      } else {
        setPin('');
        setAttempts((a) => a + 1);
        setError(`Invalid PIN (attempt ${attempts() + 1})`);
      }
    } catch (e) {
      setPin('');
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="page setup" aria-labelledby="lock-title">
      <div class="setup-container">
        <h1 id="lock-title">Vauchi is locked</h1>
        <p>Enter your PIN to unlock</p>

        <form
          class="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleUnlock();
          }}
        >
          <label for="pin-input">PIN</label>
          <input
            id="pin-input"
            type="password"
            placeholder="Enter PIN..."
            value={pin()}
            onInput={(e) => {
              setError('');
              setPin(e.target.value);
            }}
            disabled={loading()}
            aria-describedby={error() ? 'pin-error' : undefined}
            aria-invalid={error() ? 'true' : undefined}
            aria-required="true"
            autocomplete="off"
          />

          {error() && (
            <p id="pin-error" class="error" role="alert" aria-live="polite">
              {error()}
            </p>
          )}

          <button type="submit" disabled={loading() || !pin()} aria-busy={loading()}>
            {loading() ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Lock;
