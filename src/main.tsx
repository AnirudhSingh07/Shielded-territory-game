import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (no CDN at runtime) display fonts — Rajdhani for the condensed
// military-HUD headings/labels, Orbitron for the big cinematic event numbers.
// Latin-only subsets: the app is English-only, so the devanagari/etc. subsets
// @fontsource ships alongside latin would just be dead weight in the bundle.
import '@fontsource/rajdhani/latin-500.css'
import '@fontsource/rajdhani/latin-600.css'
import '@fontsource/rajdhani/latin-700.css'
import '@fontsource/orbitron/latin-700.css'
import '@fontsource/orbitron/latin-800.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
