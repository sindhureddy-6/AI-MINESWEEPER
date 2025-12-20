import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Get repository name from package.json or environment
const getBasePath = () => {
  if (process.env.NODE_ENV !== 'production') return '/';
  
  // Try to get from environment variable first (set in GitHub Actions)
  if (process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}/`;
  }
  
  // Fallback to package name or default
  return '/ai-minesweeper/';
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: getBasePath(),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Enable source maps for debugging
  },
  server: {
    port: 3000,
  }
})