// Blender をバックグラウンドで起動して空間をビルドする。
//   node scripts/blender-build.mjs 01 [02 ...] [--fast]
// Blender の場所は環境変数 BLENDER_PATH で指定できる（未指定なら自動で探す）。
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  const cands = [];
  const la = process.env.LOCALAPPDATA;
  if (la) {
    const wa = join(la, 'Microsoft', 'WindowsApps');
    if (existsSync(wa)) {
      for (const d of readdirSync(wa)) {
        if (d.startsWith('BlenderFoundation.Blender')) cands.push(join(wa, d, 'blender-launcher.exe'));
      }
    }
  }
  const pf = 'C:\Program Files\Blender Foundation';
  if (existsSync(pf)) for (const d of readdirSync(pf)) cands.push(join(pf, d, 'blender.exe'));
  cands.push('/Applications/Blender.app/Contents/MacOS/Blender');
  // Microsoft Store 版の実行エイリアスは existsSync では見えないので lstat で確かめる
  const ok = (c) => { try { lstatSync(c); return true; } catch { return false; } };
  return cands.find(ok) || 'blender';
}

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--')).map((a) => a.slice(2));
const ids = args.filter((a) => !a.startsWith('--'));
const exe = findBlender();
let failed = false;
for (const id of ids) {
  const t = Date.now();
  console.log(`[blender] space${id} を ${exe} でビルド中...`);
  spawnSync(exe, ['-b', '--factory-startup', '-P', 'blender/build.py', '--', id, ...flags], { stdio: 'inherit' });
  const log = join('blender', 'logs', `space${id}.log`);
  const text = existsSync(log) ? readFileSync(log, 'utf8') : '(ログなし)';
  console.log(text.split('\n').slice(-25).join('\n'));
  console.log(`[blender] space${id} ${((Date.now() - t) / 1000).toFixed(0)}s`);
  if (!/EXIT 0/.test(text)) failed = true;
}
process.exit(failed ? 1 : 0);
