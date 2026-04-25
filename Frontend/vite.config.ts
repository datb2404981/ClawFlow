import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Trong Docker Compose: set VITE_BACKEND_HOST=backend (tên service).
  // Chạy host thường: để trống -> mặc định 127.0.0.1.
  const backendHost = env.VITE_BACKEND_HOST?.trim() || '127.0.0.1'
  const backendPort = env.VITE_BACKEND_PORT?.trim() || '8080'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      proxy: {
        '/api/v1/': {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
