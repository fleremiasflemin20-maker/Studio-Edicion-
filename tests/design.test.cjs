const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../dist/design-core.js');
const P = require('../dist/creator-core.js');
const layer = (v) => P.layer({ width: 10, height: 10, size: 40, ...v });
test('alignment respects locked layers and measured boxes', () => {
  const a = layer({ x: 15, y: 30 }),
    b = layer({ x: 70, y: 60, locked: true });
  D.align([a, b], [a.id, b.id], 'right', 'canvas', { [a.id]: { w: 20, h: 10 } });
  assert.equal(a.x, 84);
  assert.equal(b.x, 70);
});
test('distribution keeps outside edges and makes equal gaps', () => {
  const layers = [10, 30, 90].map((x) => layer({ x }));
  D.distribute(
    layers,
    layers.map((l) => l.id),
    'horizontal',
  );
  assert.deepEqual(
    layers.map((l) => l.x),
    [10, 50, 90],
  );
  const before = structuredClone(layers);
  assert.throws(() => D.distribute(layers, [layers[0].id], 'vertical'));
  assert.deepEqual(layers, before);
});
test('auto organization fits a grid without moving locked elements', () => {
  const layers = Array.from({ length: 4 }, () => layer({ width: 70, height: 45, x: 50, y: 50 }));
  const locked = layer({ locked: true, x: 5, y: 5 });
  D.organize(
    [...layers, locked],
    [...layers, locked].map((l) => l.id),
    'grid',
    4,
    2,
  );
  for (const l of layers) {
    assert.ok(l.x - l.width / 2 >= 8);
    assert.ok(l.x + l.width / 2 <= 92);
    assert.ok(l.y - l.height / 2 >= 10);
    assert.ok(l.y + l.height / 2 <= 90);
  }
  assert.equal(locked.x, 5);
});
test('style pasting preserves content, file references, positions and timing', () => {
  const source = layer({
      color: '#abcdef',
      style: 'neon',
      size: 88,
      asset: 'source',
      text: 'Source',
    }),
    dest = layer({ asset: 'keep', text: 'Keep', x: 30, y: 40, startAt: 2, endAt: 5 });
  const style = D.copyStyle(source);
  D.pasteStyle([dest], [dest.id], style);
  assert.equal(dest.color, '#abcdef');
  assert.equal(dest.size, 88);
  assert.equal(dest.asset, 'keep');
  assert.equal(dest.text, 'Keep');
  assert.equal(dest.x, 30);
  assert.equal(dest.startAt, 2);
  assert.equal(dest.endAt, 5);
  assert.ok(!Object.hasOwn(style, 'asset'));
});
test('adapted scenes preserve media and cuts without mutating the source', () => {
  const s = P.scene({
    asset: 'video',
    text: 'Title',
    start: 3,
    end: 10,
    fontSize: 72,
    layers: [layer({ kind: 'image', asset: 'photo', height: 30, x: 90, y: 92 })],
    facePath: [{ t: 0, x: 50 }],
  });
  const before = structuredClone(s);
  const adapted = D.adaptScene(s, '9:16', '1:1');
  assert.deepEqual(s, before);
  assert.equal(adapted.asset, 'video');
  assert.equal(adapted.start, 3);
  assert.equal(adapted.end, 10);
  assert.ok(adapted.fontSize < 72);
  assert.deepEqual(adapted.facePath, []);
  assert.equal(adapted.layers[0].asset, 'photo');
});
test('reusable blocks get fresh IDs and a shared group on every insertion', () => {
  const source = [layer({ text: 'Hello' }), layer({ kind: 'shape' })];
  const block = D.reusable(
    source,
    source.map((l) => l.id),
  );
  const a = D.insertBlock(block),
    b = D.insertBlock(block);
  assert.notEqual(a[0].id, b[0].id);
  assert.equal(a[0].group, a[1].group);
  assert.notEqual(a[0].group, b[0].group);
  assert.throws(() => D.insertBlock(Array(41).fill(source[0])));
});
