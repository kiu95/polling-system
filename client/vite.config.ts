import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiOrigin = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/poll': apiOrigin,
      '/health': apiOrigin,
    },
  },
});
