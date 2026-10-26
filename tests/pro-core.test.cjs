const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../dist/creator-core.js');
const C = require('../dist/core.js');
const Pro = require('../dist/pro-core.js');

test('El corte respeta velocidad, tiempos SRT y capas', () => {
  const scene = P.scene({
    name: 'Clip',
    asset: 'video',
    sourceDuration: 10,
    start: 1,
    end: 9,
    speed: 2,
    subtitles: '1\n00:00:00,000 --> 00:00:04,000\nHola',
    layers: [P.layer({ text: 'Rótulo', style: 'neon', startAt: 1, endAt: 3 })],
  });
  const [left, right] = Pro.splitScene(scene, 1.5);
  assert.equal(P.length(left), 1.5);
  assert.equal(P.length(right), 2.5);
  assert.equal(left.end, 4);
  assert.equal(right.start, 4);
  assert.equal(C.parseSRT(left.subtitles)[0].end, 1.5);
  assert.equal(C.parseSRT(right.subtitles)[0].end, 2.5);
  assert.equal(left.layers[0].style, 'neon');
  assert.equal(right.layers[0].startAt, 0);
  assert.equal(right.layers[0].endAt, 1.5);
  assert.notEqual(left.id, right.id);
  assert.notEqual(left.layers[0].id, right.layers[0].id);
});

test('El corte rechaza bordes y divide imágenes sin perder duración', () => {
  const scene = P.scene({ name: 'Imagen', duration: 6 });
  assert.throws(() => Pro.splitScene(scene, 0));
  assert.throws(() => Pro.splitScene(scene, 6));
  const parts = Pro.splitScene(scene, 2);
  assert.deepEqual(parts.map(P.length), [2, 4]);
});

test('Los bloques cortos cubren la duración del guion', () => {
  const srt = Pro.timedCaptions('Una idea muy clara ayuda a crear mejor contenido cada día', 6, 4);
  const blocks = C.parseSRT(srt);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].start, 0);
  assert.equal(blocks.at(-1).end, 6);
  assert.ok(blocks.every((b) => b.text.split(' ').length <= 4));
  assert.throws(() => Pro.timedCaptions('', 4));
});

test('El ajuste por BPM conserva los clips más cortos', () => {
  assert.equal(Pro.beatDuration(120, 4), 2);
  assert.throws(() => Pro.beatDuration(0, 4));
  const clip = P.scene({ asset: 'clip', sourceDuration: 4, start: 1, speed: 2 });
  const result = Pro.fitToBeat(clip, 120, 4);
  assert.equal(result.end, 4);
  assert.equal(P.length(result), 1.5);
  const image = P.scene({ duration: 8 });
  assert.equal(Pro.fitToBeat(image, 120, 4).duration, 2);
});

test('Los campos visuales importados se normalizan y acotan', () => {
  const scene = P.scene({
    speed: 99,
    rotation: 17,
    adjust: { contrast: 999, blur: -3 },
    titleStyle: '<script>',
  });
  assert.equal(scene.speed, 3);
  assert.equal(scene.rotation, 0);
  assert.equal(scene.adjust.contrast, 180);
  assert.equal(scene.adjust.blur, 0);
  assert.equal(scene.titleStyle, 'clean');
  const layer = P.layer({
    kind: 'counter',
    style: 'neon',
    startAt: -4,
    endAt: 999,
    animationDuration: 20,
  });
  assert.equal(layer.kind, 'counter');
  assert.equal(layer.style, 'neon');
  assert.equal(layer.startAt, 0);
  assert.equal(layer.endAt, 120);
  assert.equal(layer.animationDuration, 4);
});

test('La revisión encuentra archivos ausentes, SRT inválido y poco contraste', () => {
  const scene = P.scene({
    asset: null,
    bg: '#ffffff',
    color: '#ffffff',
    subtitles: 'esto no es SRT',
  });
  const report = Pro.audit({ name: 'Prueba', audio: 'missing', caption: '', scenes: [scene] }, []);
  assert.ok(report.errors.some((e) => e.includes('archivo')));
  assert.ok(report.errors.some((e) => e.includes('SRT')));
  assert.ok(report.warnings.some((e) => e.includes('contraste')));
  assert.ok(report.warnings.some((e) => e.includes('descripción')));
  assert.ok(report.score < 100);
});

test('Los catálogos tienen IDs únicos y composiciones válidas', () => {
  assert.equal(Pro.textStyles.length, 16);
  assert.equal(Pro.compositions.length, 12);
  assert.equal(new Set(Pro.extraFilters.map((f) => f.id)).size, 12);
  for (const block of Pro.compositions) {
    assert.ok(block.layers.length > 0 && block.layers.length <= 4);
    assert.ok(block.layers.map(P.layer).every((l) => Number.isFinite(l.x) && Number.isFinite(l.y)));
  }
});
