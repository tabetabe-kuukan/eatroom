import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// 開発用：ページから POST した画面の画像を v2/.shots/ に保存する（見た目の確認用）
const shots = {
  name: 'dev-shots',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const { name, data } = JSON.parse(body);
        mkdirSync('v2/.shots', { recursive: true });
        writeFileSync(`v2/.shots/${name.replace(/[^\w-]/g, '_')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
        res.end('ok');
      });
    });
  },
};

// v2（改良版）。リポジトリ直下から `npm run dev:v2` で起動する。
// 静的ファイルとしてどこにでも置けるよう相対パスでビルドする
export default defineConfig({
  root: 'v2',
  base: './',
  publicDir: 'public',
  plugins: [shots],
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
