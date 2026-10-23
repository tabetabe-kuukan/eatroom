import { defineConfig } from 'vite';

// 静的ファイルとしてどこにでも置けるよう相対パスでビルドする
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
