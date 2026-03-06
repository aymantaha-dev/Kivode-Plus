import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react()],

    root: path.resolve(__dirname, 'src/renderer'),
    base: './',

    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true,
      sourcemap: false,
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        mangle: true,
      } : undefined,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },

    resolve: {
      alias: {
        '@renderer': path.resolve(__dirname, 'src/renderer/src'),
        '@': path.resolve(__dirname, 'src/renderer/src'),
      },
    },

    css: {
      devSourcemap: false,
    },

    esbuild: {
      drop: isProduction ? ['console', 'debugger'] : [],
    },
  };
});