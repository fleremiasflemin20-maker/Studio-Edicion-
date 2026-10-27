const test = require('node:test'),
  assert = require('node:assert/strict'),
  M = require('../dist/motion-core.js');
test('Motion clamps untrusted input and keeps encoder dimensions even', () => {
  for (const format of ['9:16', '16:9', '4:5', '1:1']) {
    const c = M.config({ format, quality: 2160, fps: 60, duration: 1 });
    assert.equal(c.width % 2, 0);
    assert.equal(c.height % 2, 0);
    assert.equal(c.durationInFrames, 60);
  }
  const d = M.normalize({
    duration: 999,
    quality: 999,
    code: 'x'.repeat(100001),
    accent: 'javascript:bad',
  });
  assert.equal(d.duration, 30);
  assert.equal(d.quality, 720);
  assert.equal(d.code.length, 100000);
  assert.equal(d.accent, '#9aefc4');
});
test('Motion project preserves editable code and rejects unrelated JSON', () => {
  const d = M.normalize({ title: 'A < B', code: 'export default function Video() {}' });
  assert.deepEqual(M.parse(M.serialize(d)), d);
  assert.throws(() => M.parse('{}'));
  assert.throws(() => M.parse('x'.repeat(130001)));
});
test('Motion original soundtrack is a nonempty PCM WAV of exact length', () => {
  const data = M.score(1, 'pulse'),
    v = new DataView(data);
  assert.equal(v.getUint32(24, true), 24000);
  assert.equal(v.getUint32(40, true), 48000);
  assert.equal(data.byteLength, 48044);
  assert.ok(new Int16Array(data, 44).some((v) => v !== 0));
});
