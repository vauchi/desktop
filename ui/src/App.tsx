import { createSignal, createResource, Show, onMount } from 'solid-js'
import { invoke } from '@tauri-apps/api/core'
import Setup from './pages/Setup'
import Home from './pages/Home'
import Contacts from './pages/Contacts'
import Exchange from './pages/Exchange'
import Settings from './pages/Settings'
import Devices from './pages/Devices'
import Recovery from './pages/Recovery'

type Page = 'setup' | 'home' | 'contacts' | 'exchange' | 'settings' | 'devices' | 'recovery'

async function checkIdentity(): Promise<boolean> {
  return await invoke('has_identity')
}

function App() {
  const [page, setPage] = createSignal<Page>('home')
  const [hasIdentity] = createResource(checkIdentity)

  // Apply saved accessibility settings on app startup
  onMount(() => {
    const reduceMotion = localStorage.getItem('a11y-reduce-motion') === 'true'
    const highContrast = localStorage.getItem('a11y-high-contrast') === 'true'
    const largeTouchTargets = localStorage.getItem('a11y-large-touch-targets') === 'true'

    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion))
    document.documentElement.setAttribute('data-high-contrast', String(highContrast))
    document.documentElement.setAttribute('data-large-touch-targets', String(largeTouchTargets))
  })

  const currentPage = () => {
    if (hasIdentity.loading) return <div class="loading">Loading...</div>
    if (!hasIdentity()) return <Setup onComplete={() => location.reload()} />

    switch (page()) {
      case 'home':
        return <Home onNavigate={setPage} />
      case 'contacts':
        return <Contacts onNavigate={setPage} />
      case 'exchange':
        return <Exchange onNavigate={setPage} />
      case 'settings':
        return <Settings onNavigate={setPage} />
      case 'devices':
        return <Devices onNavigate={setPage} />
      case 'recovery':
        return <Recovery onNavigate={setPage} />
      default:
        return <Home onNavigate={setPage} />
    }
  }

  return (
    <div class="app">
      {currentPage()}
    </div>
  )
}

export default App
