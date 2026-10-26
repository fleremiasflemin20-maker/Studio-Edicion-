const fs = require('node:fs'),
  path = require('node:path'),
  { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'dist')).filter((n) => n.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(root, 'dist', name)], { stdio: 'inherit' });
}
for (const name of fs.readdirSync(path.join(root, 'backend')).filter((n) => n.endsWith('.cjs')))
  execFileSync(process.execPath, ['--check', path.join(root, 'backend', name)], {
    stdio: 'inherit',
  });
for (const name of fs.readdirSync(path.join(root, 'cloudflare')).filter((n) => n.endsWith('.mjs')))
  execFileSync(process.execPath, ['--check', path.join(root, 'cloudflare', name)], {
    stdio: 'inherit',
  });
console.log('JavaScript syntax checked.');
