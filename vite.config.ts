import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/my-decision-app/',  // REQUIRED for GitHub Pages under MooMoo27UCD.github.io/my-decision-app/
})
