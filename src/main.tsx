import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/martian-mono'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './theme.css'
import { App } from './App'
import { AtlasProvider } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AtlasProvider>
      <App />
    </AtlasProvider>
  </StrictMode>,
)
