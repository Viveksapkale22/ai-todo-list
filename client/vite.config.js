import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ai-todo-list-client-kg07feyc7-vivek-s-projects-ed4a97bd.vercel.app/',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
