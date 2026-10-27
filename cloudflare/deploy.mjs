import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('.', import.meta.url));
const wrangler = fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url));
for (const config of ['wrangler.backend.jsonc', 'wrangler.jsonc']) {
  const result = spawnSync(
    process.execPath,
    [wrangler, 'deploy', '--config', config, ...process.argv.slice(2)],
    { cwd, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
