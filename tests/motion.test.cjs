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

test('Motion image/audio sources and numeric data survive settings serialization without embedding private media', () => {
  const input = {
    preset: 'audiogram',
    imageAsset: 'image-1',
    audioAsset: 'audio-1',
    audioStart: 4.5,
    values: [7, 0, 14],
    imageData: 'data:image/png;base64,PRIVATE',
    audioData: 'data:audio/wav;base64,PRIVATE',
  };
  const normalized = M.normalize(input),
    portable = M.parse(M.serialize(input));
  assert.equal(portable.preset, 'audiogram');
  assert.equal(portable.audioStart, 4.5);
  assert.deepEqual(portable.values, [7, 0, 14]);
  assert.equal(portable.imageAsset, 'image-1');
  assert.equal(portable.audioAsset, 'audio-1');
  assert.ok(!M.serialize(input).includes('PRIVATE'));
  assert.equal(normalized.imageData, undefined);
  assert.ok(M.presets.some((p) => p.id === 'photo-motion'));
});
test('Motion chart inputs are nonnegative, bounded and never empty', () => {
  assert.deepEqual(M.normalizeValues('4, 0; -2 8.5'), [4, 0, 0, 8.5]);
  assert.equal(M.normalizeValues(Array.from({ length: 20 }, (_, i) => i)).length, 8);
  assert.deepEqual(M.normalizeValues(['not-a-number', Infinity]), [12, 24, 18, 32]);
  assert.deepEqual(M.normalizeValues([1e30]), [1000000000]);
  assert.deepEqual(M.normalizeValues([0]), [0]);
});
test('Motion audio clipping uses the selected source interval and emits the matching PCM WAV', () => {
  const rate = 16000,
    source = new Float32Array(rate * 4);
  source.fill(0.1, 0, rate);
  source.fill(0.5, rate, rate * 2);
  source.fill(-0.25, rate * 2, rate * 3);
  const clip = M.clipAudio(source, rate, 1, 1);
  assert.equal(clip.duration, 1);
  assert.equal(new DataView(clip.wav).getUint32(40, true), rate * 2);
  const samples = new Int16Array(clip.wav, 44);
  assert.equal(samples[0], Math.round(0.5 * 32767));
  assert.equal(samples.at(-1), Math.round(0.5 * 32767));
  assert.equal(clip.waveform.length, 60);
  const tail = M.clipAudio(source, rate, 3.5, 30);
  assert.equal(tail.duration, 0.5);
  assert.throws(() => M.clipAudio(source, rate, 5, 1));
  assert.throws(() => M.pcmWav(new Float32Array(rate * 31), rate));
});
test('Motion waveform follows actual energy and treats silent input as silent', () => {
  assert.deepEqual(M.waveform(new Float32Array(100), 4), [0, 0, 0, 0]);
  const samples = new Float32Array(400);
  samples.fill(0.1, 0, 100);
  samples.fill(0.5, 100, 200);
  samples.fill(1, 200, 300);
  const bins = M.waveform(samples, 4);
  assert.ok(Math.abs(bins[0] - 0.1) < 0.001);
  assert.ok(Math.abs(bins[1] - 0.5) < 0.001);
  assert.equal(bins[2], 1);
  assert.equal(bins[3], 0);
  assert.ok(
    M.waveform(new Float32Array([NaN, Infinity]), 3).every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    ),
  );
});
test('Motion sandbox media rejects external resources, SVG code and unbounded waveform payloads', () => {
  assert.throws(() => M.validateMedia({ imageData: 'https://example.com/private.png' }));
  assert.throws(() => M.validateMedia({ imageData: 'data:image/svg+xml;base64,PHN2Zz4=' }));
  assert.throws(() => M.validateMedia({ audioData: 'data:audio/mpeg;base64,AAAA' }));
  assert.throws(() => M.validateMedia({ waveform: Array(4097).fill(0.5) }));
  assert.throws(() => M.validateMedia({ waveform: [NaN] }));
  assert.throws(() => M.validateMedia({ waveform: [2] }));
  const allowed = M.validateMedia({
    imageData: 'data:image/png;base64,iVBORw0KGgo=',
    audioData: 'data:audio/wav;base64,UklGRg==',
    waveform: [0, 0.5, 1],
    audioDuration: 60,
  });
  assert.equal(allowed.audioDuration, 30);
  assert.deepEqual(allowed.waveform, [0, 0.5, 1]);
});
test('Motion backup references are deduplicated and restore remaps private source ids', () => {
  assert.deepEqual(M.references({ imageAsset: 'shared', audioAsset: 'shared' }), ['shared']);
  const restored = M.remap(
    { imageAsset: 'image-old', audioAsset: 'audio-missing', values: [3, 8] },
    new Map([['image-old', 'image-new']]),
  );
  assert.equal(restored.imageAsset, 'image-new');
  assert.equal(restored.audioAsset, '');
  assert.deepEqual(restored.values, [3, 8]);
});
