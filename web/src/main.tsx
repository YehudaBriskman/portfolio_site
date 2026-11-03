// First, before anything that defines a zod schema; see the file for why.
import './lib/zod-csp'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncTheme } from './lib/theme'

/* theme-boot.js has already set the theme before the first paint; this hands
   it to the store that owns it from here (#247). Same answer, so no repaint,
   unless the boot script was blocked. */
syncTheme()

createRoot(document.getElementById("root")!).render(<App />);
