const test = require('node:test'),
  assert = require('node:assert/strict');
const K = require('../dist/editor-kit-core.js'),
  P = require('../dist/creator-core.js'),
  Pro = require('../dist/pro-core.js');
function cube(size = 2, invert = false) {
  const rows = [];
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++)
        rows.push([r, g, b].map((v) => (invert ? 1 - v / (size - 1) : v / (size - 1))).join(' '));
  return 'TITLE "Test"\nLUT_3D_SIZE ' + size + '\n' + rows.join('\n');
}
test('3D LUT trilinear sampling retains identity values and alpha', () => {
  const lut = K.parseCube(cube());
  assert.deepEqual(lut.domainMin, [0, 0, 0]);
  const pixels = new Uint8ClampedArray([31, 85, 190, 123, 255, 0, 128, 255]);
  assert.deepEqual(K.applyLUT(pixels.slice(), lut), pixels);
  assert.deepEqual(
    K.sampleLUT(lut, 0.2, 0.3, 0.4).map((v) => Math.round(v * 100)),
    [20, 30, 40],
  );
  const invert = K.parseCube(cube(2, true));
  assert.deepEqual(
    [...K.applyLUT(new Uint8ClampedArray([0, 255, 51, 88]), invert)],
    [255, 0, 204, 88],
  );
});
test('LUT import refuses incomplete, oversized, 1D and invalid domains', () => {
  assert.throws(() => K.parseCube('LUT_3D_SIZE 2\n0 0 0'));
  assert.throws(() => K.parseCube('LUT_3D_SIZE 64'));
  assert.throws(() => K.parseCube('LUT_1D_SIZE 2'));
  assert.throws(() => K.parseCube(cube() + '\nDOMAIN_MAX 0 0 0'));
  assert.throws(() => K.parseCube(cube().replace('0 0 0', 'NaN 0 0')));
  assert.throws(() => K.parseCube('x'.repeat(4000001)));
});
test('filter normalization clamps values and deterministic color math preserves opacity', () => {
  const f = K.normalizeFilter({
    exposure: 99,
    paintColor: 'url(bad)',
    gamma: -4,
    intensity: 99,
    texture: 'evil',
    lut: { size: 99 },
  });
  assert.equal(f.exposure, 2);
  assert.equal(f.gamma, 0.2);
  assert.equal(f.intensity, 1);
  assert.equal(f.texture, 'none');
  assert.equal(f.lut, null);
  const input = new Uint8ClampedArray([80, 120, 160, 74]);
  assert.deepEqual(K.gradePixels(input.slice(), {}), input);
  assert.deepEqual(K.gradePixels(input.slice(), { exposure: 1, intensity: 0 }), input);
  assert.equal(K.gradePixels(input.slice(), { exposure: 1 })[3], 74);
  assert.equal(K.gradePixels(input.slice(), { exposure: 1 })[0], 160);
});
test('keyframes interpolate sparse channels with easing, clamping and duplicate-time merge', () => {
  const frames = K.normalizeKeyframes([
    { t: 0, x: 10, easing: 'ease-in-out' },
    { t: 2, x: 90, opacity: 0 },
    { t: 2, scale: 2 },
    { t: 1, y: 30 },
    { t: Infinity, x: 5 },
  ]);
  assert.equal(frames.length, 3);
  const v = K.interpolateKeyframes(frames, 1, { opacity: 1, rotation: 45 });
  assert.equal(v.x, 50);
  assert.equal(v.y, 30);
  assert.equal(v.rotation, 45);
  assert.equal(v.opacity, 0.5);
  assert.equal(
    K.interpolateKeyframes(
      [
        { t: 0, x: 0, easing: 'hold' },
        { t: 1, x: 100 },
      ],
      0.9,
    ).x,
    0,
  );
  assert.equal(K.interpolateKeyframes(frames, 120).x, 90);
});
test('scene normalization and activation preserve custom LUT and layer animation', () => {
  const scene = P.scene({
    customFilter: { name: 'Original', lut: K.parseCube(cube()) },
    layers: [
      {
        text: 'Hello',
        autoFit: true,
        keyframes: [
          { t: 0, x: 10 },
          { t: 2, x: 80 },
        ],
      },
    ],
  });
  const project = { scenes: [scene], activeScene: scene.id };
  P.activate(project, scene.id, false);
  assert.equal(project.customFilter.lut.size, 2);
  assert.equal(project.layers[0].autoFit, true);
  project.customFilter.exposure = 1;
  P.mirror(project);
  assert.equal(project.scenes[0].customFilter.exposure, 1);
  const restored = P.scene(JSON.parse(JSON.stringify(scene)));
  assert.equal(restored.layers[0].keyframes.length, 2);
});
test('splitting a scene preserves keyframe motion at the cut boundary', () => {
  const scene = P.scene({
    duration: 6,
    customFilter: { texture: 'paint', motion: 'paint-fall', timeOffset: 2 },
    layers: [
      {
        text: 'Move',
        x: 0,
        keyframes: [
          { t: 0, x: 0 },
          { t: 6, x: 100 },
        ],
      },
    ],
  });
  const [left, right] = Pro.splitScene(scene, 3);
  assert.equal(right.customFilter.timeOffset, 5);
  assert.equal(K.interpolateKeyframes(left.layers[0].keyframes, 3).x, 50);
  assert.equal(K.interpolateKeyframes(right.layers[0].keyframes, 0).x, 50);
  assert.equal(K.interpolateKeyframes(right.layers[0].keyframes, 3).x, 100);
});
test('adaptive copies remain inside safe bounds and do not mutate original projects', () => {
  const project = {
    name: 'Source',
    format: '9:16',
    scenes: [
      P.scene({
        layers: [
          { kind: 'image', width: 90, height: 90, x: 98, y: 99 },
          { text: 'A long heading', size: 120, x: 2, y: 3 },
        ],
        facePath: [{ t: 0, x: 40 }],
      }),
    ],
  };
  const original = structuredClone(project),
    out = K.adaptProject(project, '16:9');
  assert.deepEqual(project, original);
  assert.equal(out.format, '16:9');
  assert.equal(out.scenes[0].facePath.length, 0);
  for (const layer of out.scenes[0].layers) {
    assert.ok(layer.x - layer.width / 2 >= 6);
    assert.ok(layer.x + layer.width / 2 <= 94);
    assert.ok(layer.y - layer.height / 2 >= 6);
    assert.ok(layer.y + layer.height / 2 <= 94);
  }
  assert.equal(out.scenes[0].layers[1].autoFit, true);
});
test('layout leaves locked layers untouched and text fitting reports irreducible overflow', () => {
  const layers = [
      P.layer({ locked: true, x: 91 }),
      P.layer({ text: 'Hello' }),
      P.layer({ text: 'World' }),
    ],
    out = K.layoutLayers(layers, { direction: 'column' });
  assert.deepEqual(out[0], layers[0]);
  assert.notEqual(out[1].y, out[2].y);
  assert.ok(
    K.fitText('Many words in a small box', 100, 40, { fontSize: 40, minSize: 8 }).size < 40,
  );
  assert.ok(K.fitText('xxxxxxxxxxxxxxxxxxxxxxxx', 1, 1, { fontSize: 8, minSize: 8 }).overflow);
});
test('review detects missing media, off-canvas text, unsafe geometry, caption speed and clipping', () => {
  const scene = P.scene({
    asset: 'missing',
    text: 'Hello',
    textY: 0,
    subtitles: '1\n00:00:00,000 --> 00:00:00,100\nToo many characters to read',
    layers: [
      { kind: 'shape', x: 99, y: 99, width: 50, height: 50 },
      { kind: 'text', text: 'long '.repeat(40), width: 10, height: 2, size: 100 },
    ],
  });
  const codes = new Set(
    K.review(
      { format: '9:16', audio: 'missing-audio', scenes: [scene] },
      { assetIds: [], audioPeaks: [1] },
    ).map((i) => i.code),
  );
  for (const code of [
    'missing-media',
    'outside',
    'safe-area',
    'fast-captions',
    'text-overflow',
    'audio-clipping',
    'missing-audio',
  ])
    assert.ok(codes.has(code), code);
});
