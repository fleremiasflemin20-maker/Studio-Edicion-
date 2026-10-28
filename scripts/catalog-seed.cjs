/** Generates reviewed original catalog seed SQL. Does not connect or deploy. */
const fs = require('node:fs'),
  path = require('node:path'),
  L = require('../dist/library-assets.js');
const quote = (value) => "'" + String(value).replace(/'/g, "''") + "'";
const destination = path.resolve(
  process.argv[2] || path.join(__dirname, '../cloudflare/catalog-seed.sql'),
);
const schema = fs.readFileSync(path.join(__dirname, '../cloudflare/catalog-schema.sql'), 'utf8');
const sql = [schema, '-- Original procedural catalog only; private project media is never seeded.'];
for (const item of L.catalog) {
  const fields = [
    item.id,
    item.type,
    item.name,
    item.nameEn,
    JSON.stringify(item.tags),
    item.license,
    item.version,
    item.preview,
    JSON.stringify(item),
    L.normalize([item.name, item.nameEn, ...item.tags].join(' ')),
  ];
  sql.push(
    'INSERT INTO resources (id,type,name,name_en,tags,license,version,preview,metadata,search_text,published) VALUES (' +
      fields.map(quote).join(',') +
      ',1) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,name_en=excluded.name_en,tags=excluded.tags,license=excluded.license,version=excluded.version,preview=excluded.preview,metadata=excluded.metadata,search_text=excluded.search_text,published=1,updated_at=CURRENT_TIMESTAMP;',
  );
}
fs.writeFileSync(destination, sql.join('\n') + '\n');
console.log('Generated ' + L.catalog.length + ' original catalog entries: ' + destination);
