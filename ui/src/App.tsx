// SPDX-FileCopyrightText: 2026 Mattia Egloff <mattia.egloff@pm.me>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createSignal, createResource, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import Setup from './pages/Setup';
import Lock from './pages/Lock';
import Home from './pages/Home';
import Contacts from './pages/Contacts';
import Exchange from './pages/Exchange';
import Settings from './pages/Settings';
import Devices from './pages/Devices';
import Recovery from './pages/Recovery';
import Help from './pages/Help';
import SupportUs from './pages/SupportUs';
import Delivery from './pages/Delivery';
import { initializeTheme } from './services/themeService';
import { initializeLocale } from './services/i18nService';

type Page =
  | 'setup'
  | 'lock'
  | 'home'
  | 'contacts'
  | 'exchange'
  | 'settings'
  | 'devices'
  | 'recovery'
  | 'help'
  | 'support'
  | 'delivery';

interface DuressStatus {
  password_enabled: boolean;
  duress_enabled: boolean;
}

async function checkIdentity(): Promise<boolean> {
  return await invoke('has_identity');
}

async function checkPasswordEnabled(): Promise<boolean> {
  try {
    const status: DuressStatus = await invoke('get_duress_status');
    return status.password_enabled;
  } catch {
    return false;
  }
}

function App() {
  const [page, setPage] = createSignal<Page>('home');
  const [hasIdentity] = createResource(checkIdentity);
  const [passwordEnabled] = createResource(checkPasswordEnabled);
  const [authenticated, setAuthenticated] = createSignal(false);

  // Apply saved settings on app startup
  onMount(async () => {
    // Accessibility settings
    const reduceMotion = localStorage.getItem('a11y-reduce-motion') === 'true';
    const highContrast = localStorage.getItem('a11y-high-contrast') === 'true';
    const largeTouchTargets = localStorage.getItem('a11y-large-touch-targets') === 'true';

    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion));
    document.documentElement.setAttribute('data-high-contrast', String(highContrast));
    document.documentElement.setAttribute('data-large-touch-targets', String(largeTouchTargets));

    // Initialize locale (loads all strings) and theme
    try {
      await initializeLocale();
    } catch (e) {
      console.error('Failed to initialize locale:', e);
    }
    try {
      await initializeTheme();
    } catch (e) {
      console.error('Failed to initialize theme:', e);
    }
  });

  const currentPage = () => {
    if (hasIdentity.loading || passwordEnabled.loading)
      return <div class="loading">Loading...</div>;
    if (!hasIdentity()) return <Setup onComplete={() => location.reload()} />;
    if (passwordEnabled() && !authenticated())
      return <Lock onUnlock={() => setAuthenticated(true)} />;

    switch (page()) {
      case 'home':
        return <Home onNavigate={setPage} />;
      case 'contacts':
        return <Contacts onNavigate={setPage} />;
      case 'exchange':
        return <Exchange onNavigate={setPage} />;
      case 'settings':
        return <Settings onNavigate={setPage} />;
      case 'devices':
        return <Devices onNavigate={setPage} />;
      case 'recovery':
        return <Recovery onNavigate={setPage} />;
      case 'help':
        return <Help onNavigate={setPage} />;
      case 'support':
        return <SupportUs onNavigate={setPage} />;
      case 'delivery':
        return <Delivery onNavigate={setPage} />;
      default:
        return <Home onNavigate={setPage} />;
    }
  };

  return (
    <div class="app">
      <a href="#main-content" class="skip-link">
        Skip to main content
      </a>
      <div id="main-content">{currentPage()}</div>
    </div>
  );
}

export default App;
