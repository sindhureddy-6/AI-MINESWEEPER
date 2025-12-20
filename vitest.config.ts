import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
    setupFiles: ['./src/test/setup'],
  },
})