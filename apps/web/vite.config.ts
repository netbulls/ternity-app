import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

function appVersion(): string {
  // Prefer build arg (set by deploy.sh in Docker builds where git is unavailable)
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;

  // Read semver from root package.json, append short commit hash for traceability
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
  const semver = pkg.version || '0.0.0';
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    return `${semver}+${hash}`;
  } catch {
    return semver;
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['motion/react'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
