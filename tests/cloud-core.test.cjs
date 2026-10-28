const test = require('node:test'),
  assert = require('node:assert/strict'),
  C = require('../dist/cloud-core.js');
test('coediting merges independent layer edits and preserves explicit conflicts', () => {
  const base = {
      name: 'A',
      scenes: [{ id: 's', text: 'old', layers: [{ id: 'l', x: 10, y: 20 }] }],
    },
    local = structuredClone(base),
    remote = structuredClone(base);
  local.scenes[0].layers[0].x = 30;
  remote.scenes[0].layers[0].y = 40;
  const merged = C.rebase(base, remote, local);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.document.scenes[0].layers[0].x, 30);
  assert.equal(merged.document.scenes[0].layers[0].y, 40);
  remote.scenes[0].layers[0].x = 90;
  assert.equal(C.rebase(base, remote, local).conflicts.length, 1);
  assert.equal(base.scenes[0].layers[0].x, 10);
});
test('portable cloud documents exclude local selection, cloud session metadata and mirrored scene fields', () => {
  const doc = C.documentOf(
    {
      id: 'id',
      name: 'A',
      cloud: { user: 'secret' },
      activeScene: 's',
      text: 'mirror',
      scenes: [{ id: 's', text: 'real' }],
    },
    ['name', 'text'],
  );
  assert.ok(!('cloud' in doc));
  assert.ok(!('activeScene' in doc));
  assert.ok(!('text' in doc));
  assert.equal(doc.scenes[0].text, 'real');
  assert.equal(
    C.mapMedia({ scenes: [{ asset: 'old' }] }, new Map([['old', 'new']])).scenes[0].asset,
    'new',
  );
});
test('array structural changes produce guarded replacement and deletions remain explicit', () => {
  const changes = C.diff({ layers: [{ id: 'a' }], caption: 'remove' }, { layers: [{ id: 'b' }] });
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0].path, ['layers']);
  assert.equal(changes[1].remove, true);
});
