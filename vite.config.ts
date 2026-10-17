import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev we proxy /api to the Spring Boot server, so the browser calls the same origin (no CORS needed). A production
// build calls the API directly at VITE_API_BASE_URL instead (see src/api/client.ts).
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
