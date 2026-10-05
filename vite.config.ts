import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The API has no CORS config, so in dev we proxy /api to the Spring Boot
// server instead of calling it cross-origin from the browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8081',
          changeOrigin: true,
        },
      },
    },
  };
});
