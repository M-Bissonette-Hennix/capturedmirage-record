import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const files = ['app.js', 'sw.js'];
for (const dir of ['src', 'scripts', 'tools', 'gateway']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const entry of fs.readdirSync(abs, {withFileTypes:true})) {
    if (!entry.isFile()) continue;
    if (!['.js', '.mjs'].includes(path.extname(entry.name))) continue;
    files.push(path.join(dir, entry.name).replaceAll(path.sep, '/'));
  }
}
files.sort();
for (const rel of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`JavaScript syntax FAILED: ${rel}`);
    process.exit(result.status ?? 1);
  }
}
console.log(`JavaScript syntax PASS · ${files.length}/${files.length} files`);
