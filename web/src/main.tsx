// First, before anything that defines a zod schema; see the file for why.
import './lib/zod-csp'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { syncTheme } from './lib/theme'
import { loadContent } from './content/store'
import { bootLang } from './i18n/routing'

/* theme-boot.js has already set the theme before the first paint; this hands
   it to the store that owns it from here (#247). Same answer, so no repaint,
   unless the boot script was blocked. */
syncTheme()

/* The site's content from the store (#163). The page paints from the data
   files first and this swaps in what the API serves, if it differs. */
void loadContent();

/* The language, from the address, before the first render (#248). */
bootLang();

createRoot(document.getElementById("root")!).render(<App />);
