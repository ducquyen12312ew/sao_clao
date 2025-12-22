import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
<<<<<<< Updated upstream
=======
      // Proxy API calls to backend
>>>>>>> Stashed changes
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
<<<<<<< Updated upstream
=======
      // Serve backend static assets during dev
>>>>>>> Stashed changes
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
<<<<<<< Updated upstream
      },
      '/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
=======
>>>>>>> Stashed changes
      }
    }
  }
})
