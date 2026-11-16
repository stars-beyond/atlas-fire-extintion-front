import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/martian-mono'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './styles/index.css'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AtlasProvider } from './state'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AtlasProvider>
        <App />
      </AtlasProvider>
    </ErrorBoundary>
  </StrictMode>,
)
