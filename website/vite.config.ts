import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** GitHub Pages 项目站 base 为 /仓库名/，由 CI 注入 VITE_BASE_PATH */
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
