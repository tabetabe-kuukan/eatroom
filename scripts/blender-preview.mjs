// .blend を Cycles でレンダリングして見比べる: node scripts/blender-preview.mjs 02 out.png x y z yaw pitch [samples]
import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const la = process.env.LOCALAPPDATA || '';
const wa = join(la, 'Microsoft', 'WindowsApps');
let exe = process.env.BLENDER_PATH || 'blender';
try { for (const d of readdirSync(wa)) if (d.startsWith('BlenderFoundation.Blender')) { const c = join(wa, d, 'blender-launcher.exe'); lstatSync(c); exe = c; } } catch { /* noop */ }
const [id, out, ...rest] = process.argv.slice(2);
spawnSync(exe, ['-b', `blender/space${id}.blend`, '-P', 'blender/tools/preview.py', '--', resolve(out), ...rest], { stdio: 'inherit' });
