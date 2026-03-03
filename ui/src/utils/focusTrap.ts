// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Creates a focus trap within a container element.
 * Tab and Shift+Tab cycle through focusable elements.
 * Returns a cleanup function.
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus the first focusable element
  const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
  if (firstFocusable) {
    requestAnimationFrame(() => firstFocusable.focus());
  }

  return () => container.removeEventListener('keydown', handleKeyDown);
}
