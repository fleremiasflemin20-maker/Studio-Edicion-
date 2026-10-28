const esbuild = require('esbuild');
esbuild
  .build({
    entryPoints: ['src/accounts/browser.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'chrome110',
    outfile: 'dist/passkeys.js',
    legalComments: 'external',
  })
  .catch(() => (process.exitCode = 1));
