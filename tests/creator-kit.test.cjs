const test = require('node:test'),
  assert = require('node:assert/strict'),
  P = require('../dist/creator-core.js'),
  K = require('../dist/creator-kit-core.js');
test('saved recipes retain visual settings but never capture source media, tracks or arbitrary layer payloads', () => {
  const scene = P.scene({
    asset: 'private-video',
    text: 'Private main title',
    filter: 'warm',
    brightness: 110,
    layers: [],
  });
  scene.layers = [
    {
      kind: 'text',
      text: 'Reusable title',
      asset: 'hidden-image',
      audio: 'private-audio',
      src: 'data:video/private',
      blob: { private: true },
      x: 50,
      y: 30,
    },
    { kind: 'shape', asset: 'private-shape-file', fill: '#123456' },
    { kind: 'image', asset: 'private-image' },
    { kind: 'video', asset: 'private-overlay' },
  ];
  scene.adjust = { contrast: 110, network: 'private-upload' };
  const project = {
    format: '9:16',
    activeScene: scene.id,
    scenes: [scene],
    audio: 'private-music',
    audioTracks: [{ asset: 'private-track' }],
  };
  const recipe = K.recipe(project, 'Saved style'),
    raw = JSON.stringify(recipe);
  assert.equal(recipe.layers.length, 2);
  assert.ok(recipe.layers.every((l) => l.asset === null));
  for (const value of [
    'private-video',
    'private-audio',
    'private-image',
    'private-overlay',
    'private-music',
    'private-track',
    'data:video/private',
    'private-upload',
    'hidden-image',
  ])
    assert.ok(!raw.includes(value), value);
  scene.adjust.contrast = 70;
  assert.equal(recipe.settings.adjust.contrast, 110);
  assert.equal(project.audioTracks[0].asset, 'private-track');
});
test('recipe import validates envelopes, filters nonvisual layers and bounds visual parameters', () => {
  assert.throws(() => K.normalizeRecipe({ version: 2, name: 'x', settings: {} }));
  assert.throws(() => K.normalizeRecipe({ version: 1, name: 'x', settings: [] }));
  const value = K.normalizeRecipe({
    version: 1,
    name: 'x'.repeat(100),
    format: 'unknown',
    settings: {
      asset: 'secret',
      brightness: 9999,
      fontSize: -2,
      bg: 'javascript:bad',
      adjust: null,
      customFilter: { exposure: 999, lut: { size: 100, values: [] } },
    },
    layers: [
      null,
      { kind: 'video', asset: 'secret' },
      { kind: 'text', text: 'Safe', x: 10000, width: -2, asset: 'secret', code: 'alert(1)' },
    ],
    musicVolume: 8,
    quality: 999,
  });
  assert.equal(value.name.length, 80);
  assert.equal(value.format, '9:16');
  assert.equal(value.settings.brightness, 180);
  assert.equal(value.settings.fontSize, 20);
  assert.match(value.settings.bg, /^#[a-f0-9]{6}$/i);
  assert.equal(value.settings.customFilter.exposure, 2);
  assert.equal(value.settings.customFilter.lut, null);
  assert.equal(value.settings.asset, undefined);
  assert.equal(value.layers.length, 1);
  assert.equal(value.layers[0].x, 100);
  assert.equal(value.layers[0].width, 5);
  assert.equal(value.layers[0].code, undefined);
  assert.equal(value.musicVolume, 1);
  assert.equal(value.quality, 720);
});
test('applying a recipe preserves source cuts, original text and media while giving inserted layers fresh ids', () => {
  const original = P.scene({
    asset: 'source',
    start: 2,
    end: 5,
    text: 'Keep my content',
    layers: [{ kind: 'image', asset: 'existing-overlay' }],
  });
  const project = {
    format: '16:9',
    scenes: [original],
    audio: 'music',
    audioTracks: [{ asset: 'voice' }],
  };
  const recipe = K.normalizeRecipe({
    version: 1,
    name: 'look',
    settings: { brightness: 120 },
    layers: [{ kind: 'text', text: 'CTA' }],
    quality: 1080,
  });
  K.applyRecipe(project, recipe, P.scene, P.layer);
  assert.equal(original.asset, 'source');
  assert.equal(original.start, 2);
  assert.equal(original.end, 5);
  assert.equal(original.text, 'Keep my content');
  assert.equal(original.layers[0].asset, 'existing-overlay');
  assert.equal(original.layers[1].text, 'CTA');
  assert.equal(original.layers[1].asset, null);
  assert.notEqual(original.layers[1].id, recipe.layers[0].id);
  assert.equal(project.audio, 'music');
  assert.equal(project.audioTracks[0].asset, 'voice');
  assert.equal(project.format, '16:9');
  assert.equal(project.exportQuality, 1080);
  assert.equal(original.brightness, 120);
});
test('waveform uses real energy, reports clipping peaks and cannot return NaN or unbounded bins', () => {
  assert.deepEqual(K.waveform([], 120), []);
  assert.deepEqual(K.waveform(new Float32Array(4), 2), [
    { rms: 0, peak: 0 },
    { rms: 0, peak: 0 },
  ]);
  const wave = K.waveform(new Float32Array([0.5, -0.5, 1.2, -1.2]), 2);
  assert.equal(wave[0].rms, 0.5);
  assert.ok(wave[1].peak > 1);
  assert.equal(
    K.waveform(new Float32Array([NaN, Infinity]), 2).every((v) => v.rms === 0 && v.peak === 0),
    true,
  );
  assert.equal(K.waveform(new Float32Array(8), 1e9).length, 2048);
  assert.equal(K.waveform(new Float32Array(8), -5).length, 1);
  assert.deepEqual(wave, K.waveform(new Float32Array([0.5, -0.5, 1.2, -1.2]), 2));
});
test('sentence grouping normalizes timestamps and reordering rejects duplicated or unknown selections', () => {
  const groups = K.sentences([
    { text: 'Second.', start: '10', end: '11' },
    { text: 'First', start: '2', end: '3' },
    { text: 'sentence.', start: 3, end: 4 },
    { text: 'bad', start: -1, end: 0 },
    { text: 'bad', start: 8, end: 7 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].text, 'First sentence.');
  assert.equal(groups[0].start, 2);
  assert.equal(groups[0].end, 4);
  assert.deepEqual(
    K.reorder(groups, [1, 0]).map((g) => g.text),
    ['Second.', 'First sentence.'],
  );
  assert.deepEqual(
    K.reorder(groups, [1]).map((g) => g.id),
    [1],
  );
  assert.throws(() => K.reorder(groups, [0, 0]));
  assert.throws(() => K.reorder(groups, [99]));
  assert.deepEqual(
    groups.map((g) => g.id),
    [0, 1],
  );
});
test('package manifests use editor durations and are deterministic for the same project state', () => {
  const scenes = [
    P.scene({ name: 'Still', duration: 4, speed: 2 }),
    P.scene({ name: 'Video', asset: 'source', start: 2, end: 8, speed: 2 }),
    { name: 'Fallback still', duration: 5 },
  ];
  const project = {
    name: 'Campaign',
    caption: 'Caption',
    format: '9:16',
    platform: 'Instagram',
    created: 0,
    scenes,
  };
  const manifest = K.manifest(project);
  assert.deepEqual(
    manifest.scenes.map((s) => s.duration),
    [4, 3, 5],
  );
  assert.equal(manifest.created, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(manifest, K.manifest(project));
  assert.equal(K.manifest({ ...project, created: 'invalid' }).created, manifest.created);
  assert.ok(!JSON.stringify(manifest).includes('source'));
});
test('word editing cuts removed speech ranges and redistributes corrected caption tokens without fabricating audio time', () => {
  const words = [
    { text: 'Hello', start: 0, end: 0.5 },
    { text: 'um', start: 0.5, end: 0.7 },
    { text: 'world', start: 0.7, end: 1.2 },
  ];
  const out = K.editWords(words, [
    { text: 'Hola', keep: true },
    { keep: false },
    { text: 'gran mundo', keep: true },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].end, 0.5);
  assert.equal(out[1].start, 0.7);
  assert.equal(out[1].words.length, 2);
  assert.equal(out[1].words[1].end, 1.2);
  assert.equal(words[1].text, 'um');
  assert.deepEqual(
    K.editWords(
      words,
      words.map(() => ({ keep: false })),
    ),
    [],
  );
});
