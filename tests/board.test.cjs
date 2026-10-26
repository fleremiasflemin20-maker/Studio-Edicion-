const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../dist/board-core.js');
test('board zoom preserves the world point beneath the pointer', () => {
  for (const zoom of [0.3, 0.5, 1, 1.6]) {
    const camera = { x: 123, y: -94, zoom };
    const pointer = { x: 414, y: 266 };
    const before = B.toWorld(pointer, camera);
    const next = B.zoomAt(camera, zoom * 0.7, pointer);
    const after = B.toWorld(pointer, next);
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
  }
});
test('moving a campaign zone preserves relative positions and contains only fully enclosed cards', () => {
  const nodes = [
    { id: 'zone', type: 'section', x: 0, y: 0, w: 800, h: 600 },
    { id: 'inside', type: 'note', x: 100, y: 100, w: 260, h: 200 },
    { id: 'outside', type: 'note', x: 790, y: 200, w: 260, h: 200 },
  ];
  assert.deepEqual(B.members(nodes, nodes[0]), ['inside']);
  B.move(nodes, ['zone', 'inside'], 143, 77, true);
  assert.equal(nodes[1].x - nodes[0].x, 100);
  assert.equal(nodes[1].y - nodes[0].y, 100);
  assert.equal(nodes[2].x, 790);
});
test('malformed imported boards cannot create unbounded nodes or executable content types', () => {
  const s = B.normalize({
    nodes: [
      {
        id: 'x',
        type: 'tool',
        x: Infinity,
        y: -999999,
        w: 99999,
        h: 99999,
        text: 'a'.repeat(5000),
      },
      { id: 'x', type: 'note' },
      { id: 'z', type: 'script' },
    ],
    camera: { zoom: 99 },
  });
  assert.equal(s.nodes.length, 2);
  assert.notEqual(s.nodes[0].id, s.nodes[1].id);
  assert.equal(s.nodes[0].y, -10000);
  assert.equal(s.nodes[0].w, 1200);
  assert.equal(s.nodes[0].text.length, 4000);
  assert.equal(s.camera.zoom, 1.6);
});
test('fit camera contains a normal board inside the viewport', () => {
  const nodes = [
    { x: 0, y: 0, w: 260, h: 310 },
    { x: 400, y: 200, w: 260, h: 310 },
  ];
  const c = B.fit(nodes, 1000, 700);
  for (const n of nodes) {
    assert.ok(n.x * c.zoom + c.x >= 0);
    assert.ok((n.x + n.w) * c.zoom + c.x <= 1000);
    assert.ok((n.y + n.h) * c.zoom + c.y <= 700);
  }
});
