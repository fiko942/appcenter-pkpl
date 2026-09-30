import { defineConfig } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: path.resolve(__dirname, '../public'),
  plugins: [
    svelte({
      preprocess: vitePreprocess()
    })
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/member': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/payment': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/device': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/css': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/js': {
        target: 'http://localhost:4829',
        changeOrigin: true
      },
      '/images': {
        target: 'http://localhost:4829',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
