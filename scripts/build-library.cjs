const fs = require('node:fs'),
  path = require('node:path'),
  L = require('../dist/library-assets.js');
const directory = path.resolve(__dirname, '../dist/library');
fs.mkdirSync(directory, { recursive: true });
for (const item of L.catalog) {
  const target = path.join(directory, path.basename(item.preview));
  if (item.type === 'sound') fs.writeFileSync(target, Buffer.from(L.sound(item.id)));
  else
    fs.writeFileSync(
      target,
      L.svg(item.id, {
        width: item.type === 'element' ? 512 : 540,
        height: item.type === 'element' ? 512 : 675,
      }),
    );
}
fs.writeFileSync(
  path.join(directory, 'catalog.json'),
  JSON.stringify(
    { version: L.version, provenance: L.provenance, counts: L.counts(), items: L.catalog },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(
  path.join(directory, 'LICENSE.txt'),
  `Fleremahias Original Content License 1.0\n\nOriginal procedural resources created for Fleremahias Studio.\nYou may use, modify and include these resources in personal and commercial finished designs, videos and social posts. Attribution is appreciated but not required. You may not redistribute these resources as an unchanged standalone asset collection or sell access to them as a competing stock library. Third-party logos, photographs and music are not included.\n\nAuthor: Fleremahias Studio by fleremiasflemin\nVersion: 1\n`,
);
console.log('Built original Fleremahias catalog:', L.counts());
