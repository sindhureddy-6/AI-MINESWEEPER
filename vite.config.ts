import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/ai-minesweeper/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/models': path.resolve(__dirname, './src/models'),
      '@/ai': path.resolve(__dirname, './src/ai'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/controllers': path.resolve(__dirname, './src/controllers'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/workers': path.resolve(__dirname, './src/workers'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})