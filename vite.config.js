import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000', // Changed from localhost to 127.0.0.1
        changeOrigin: true
      }
    }
  }
})
