import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Use relative asset paths so deployments under subpaths (e.g. Vercel)
  // don't break the production bundle.
  base: './',
  plugins: [react()],
})
