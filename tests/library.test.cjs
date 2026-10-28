const test = require('node:test'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  fs = require('node:fs'),
  path = require('node:path'),
  L = require('../dist/library-assets.js');
test('original catalog contains the promised independent resource families and portable provenance', () => {
  assert.deepEqual(L.counts(), {
    background: 60,
    element: 80,
    style: 24,
    title: 20,
    transition: 12,
    sound: 40,
    recipe: 12,
  });
  assert.equal(new Set(L.catalog.map((i) => i.id)).size, 248);
  for (const item of L.catalog) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(item.name && item.nameEn);
    assert.equal(item.version, 1);
    assert.equal(item.provenance.generatedWithAI, false);
    assert.equal(item.license, L.provenance.license);
    assert.match(item.preview, /^library\/[a-z0-9-]+\.(svg|wav)$/);
  }
  assert.equal(
    L.catalog.filter((i) => i.type === 'background').reduce((s, i) => s.add(i.family), new Set())
      .size,
    10,
  );
  assert.equal(
    L.catalog.filter((i) => i.type === 'element').reduce((s, i) => s.add(i.family), new Set()).size,
    16,
  );
});
test('catalog search handles accents, bilingual synonyms, exclusions and pagination', () => {
  const paint = L.search('fondo oscuro con pintura');
  assert.equal(paint.length, 6);
  assert.ok(paint.every((i) => i.family === 'paint'));
  assert.deepEqual(
    L.search('dark paint background').map((i) => i.id),
    paint.map((i) => i.id),
  );
  assert.equal(L.search('título elegante podcast', { type: 'title' }).length, 20);
  assert.equal(L.search('transición breve sin destello', { type: 'transition' }).length, 12);
  assert.deepEqual(
    L.search('', { type: 'element', limit: 3, offset: 3 }).map((i) => i.id),
    L.search('', { type: 'element', limit: 6 })
      .slice(3)
      .map((i) => i.id),
  );
  assert.equal(L.get(null), null);
});
test('SVG resources are deterministic, bounded, escaped and independent of the network', () => {
  const hashes = new Set();
  for (const item of L.catalog.filter((i) => i.type !== 'sound')) {
    const svg = L.svg(item);
    assert.equal(svg, L.svg(item));
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /(<script|<foreignObject|href=|url\(https?:|NaN|Infinity)/i);
    hashes.add(crypto.createHash('sha256').update(svg).digest('hex'));
  }
  assert.equal(hashes.size, 208);
  const unsafe = L.svg('el-seal-1', { accent: '" onload="alert(1)', text: '<script>&"' });
  assert.doesNotMatch(unsafe, /<script|onload=/);
  assert.match(unsafe, /&lt;script&gt;&amp;&quot;/);
  assert.match(L.svg('bg-paint-1', { width: 1e9, height: -100 }), /width="4096" height="64"/);
  assert.throws(() => L.svg('missing'));
});
test('all synthesized effects are distinct finite PCM WAV files with safe amplitude and duration', () => {
  const hashes = new Set();
  for (const item of L.catalog.filter((i) => i.type === 'sound')) {
    const buffer = L.sound(item),
      v = new DataView(buffer),
      samples = new Int16Array(buffer, 44);
    assert.equal(v.getUint32(24, true), 24000);
    assert.equal(v.getUint16(22, true), 1);
    assert.equal(v.getUint16(34, true), 16);
    assert.equal(v.getUint32(40, true), samples.byteLength);
    assert.ok(samples.some((x) => Math.abs(x) > 100));
    assert.ok(samples.every((x) => Math.abs(x) <= 29491));
    assert.ok(Math.abs(samples[0]) < 3);
    assert.ok(Math.abs(samples[samples.length - 1]) < 400);
    assert.ok(buffer.byteLength < 100000);
    assert.equal(
      crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex'),
      crypto
        .createHash('sha256')
        .update(Buffer.from(L.sound(item)))
        .digest('hex'),
    );
    hashes.add(crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex'));
  }
  assert.equal(hashes.size, 40);
});
test('transitions and recipes reference existing compatible reusable resources', () => {
  for (const i of L.catalog.filter((i) => i.type === 'transition'))
    assert.equal(L.get(i.settings.soundId)?.type, 'sound');
  for (const i of L.catalog.filter((i) => i.type === 'recipe')) {
    assert.equal(L.get(i.recipe.styleId)?.type, 'style');
    assert.equal(L.get(i.recipe.titleId)?.type, 'title');
    assert.equal(L.get(i.recipe.transitionId)?.type, 'transition');
  }
  for (const i of L.catalog.filter((i) => i.type === 'style')) {
    assert.ok(i.settings.brightness >= 0);
    assert.ok(i.settings.adjust.contrast > 0);
  }
});
test('built previews have matching catalog ids and no undeclared private content', () => {
  const directory = path.resolve(__dirname, '../dist/library');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'));
  assert.equal(manifest.items.length, 248);
  for (const item of L.catalog) {
    const buffer = fs.readFileSync(path.join(directory, path.basename(item.preview)));
    assert.ok(buffer.length > 100);
    if (item.type === 'sound') assert.equal(buffer.subarray(0, 4).toString(), 'RIFF');
    else assert.match(buffer.toString(), /<svg /);
  }
  assert.ok(fs.existsSync(path.join(directory, 'LICENSE.txt')));
});
