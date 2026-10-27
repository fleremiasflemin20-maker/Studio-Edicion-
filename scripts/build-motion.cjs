const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
async function build() {
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../src/motion/engine.jsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    outfile: path.resolve(__dirname, '../dist/motion/engine.js'),
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'external',
    logLevel: 'info',
  });
  fs.copyFileSync(
    path.resolve(__dirname, '../node_modules/remotion/LICENSE.md'),
    path.resolve(__dirname, '../dist/motion/REMOTION-LICENSE.txt'),
  );
}
build().catch(() => (process.exitCode = 1));
