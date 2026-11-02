// First, before anything that defines a zod schema; see the file for why.
import './lib/zod-csp'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
