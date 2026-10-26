const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../dist/flow-core.js'),
  P = require('../dist/creator-core.js'),
  C = require('../dist/core.js');
test('CSV conserva comillas, saltos, separador y cabeceras', () => {
  assert.deepEqual(F.csv('titulo,precio\n"Una, dos",19\n"Con ""comillas""",20'), [
    { titulo: 'Una, dos', precio: '19' },
    { titulo: 'Con "comillas"', precio: '20' },
  ]);
  assert.equal(F.csv('titulo;cta\nHola;Comprar')[0].cta, 'Comprar');
  assert.throws(() => F.csv('a,a\n1,2'));
  assert.throws(() => F.csv('a\n"sin cerrar'));
  assert.equal(F.fill('{{titulo}} · {{precio}}', { titulo: 'Hola', precio: '20' }), 'Hola · 20');
});
test('Silencios se detectan sobre señal y los rangos conservan contenido', () => {
  const samples = new Float32Array(3000);
  samples.fill(0.3, 0, 1000);
  samples.fill(0.3, 2000);
  const gaps = F.silence(samples, 1000);
  assert.equal(gaps.length, 1);
  assert.ok(gaps[0].start > 1 && gaps[0].end < 2);
  assert.deepEqual(
    F.keepRanges(5, [
      { start: 1, end: 2 },
      { start: 1.5, end: 3 },
    ]),
    [
      { start: 0, end: 1 },
      { start: 3, end: 5 },
    ],
  );
});
test('Golpes detectados corresponden a pulsos de la señal', () => {
  const s = new Float32Array(6000);
  for (let i = 500; i < 6000; i += 500) s.fill(0.8, i, i + 25);
  const beats = F.beats(s, 1000);
  assert.ok(beats.length >= 8);
  assert.ok(beats.every((v, i) => !i || v > beats[i - 1]));
});
test('Cortar conserva recortes, velocidad y SRT sin tiempos negativos', () => {
  const s = P.scene({
    asset: 'v',
    start: 2,
    end: 12,
    sourceDuration: 15,
    speed: 2,
    subtitles: '1\n00:00:01,000 --> 00:00:04,000\nHola',
    layers: [{ kind: 'video', asset: 'b', startAt: 1, endAt: 4, sourceStart: 3 }],
  });
  const cut = F.slice(s, 2, 4);
  assert.equal(cut.start, 6);
  assert.equal(cut.end, 10);
  assert.equal(P.length(cut), 2);
  assert.equal(C.parseSRT(cut.subtitles)[0].start, 0);
  assert.equal(cut.layers[0].sourceStart, 4);
  assert.equal(cut.layers[0].kind, 'video');
});
test('Subtítulos y clips usan tiempos de palabras reales', () => {
  const words = F.normalizeWords([
    { text: 'hola', start: 1, end: 1.4 },
    { text: 'mundo.', start: 1.5, end: 2 },
    { text: 'nueva', start: 2, end: 2.5 },
  ]);
  const srt = C.parseSRT(F.wordsToSrt(words));
  assert.equal(srt[0].start, 1);
  assert.equal(srt[0].end, 2.5);
  assert.equal(F.candidates(words)[0].start, 1);
  assert.deepEqual(F.normalizeWords([{ text: 'mal', start: 3, end: 2 }]), []);
});
test('Zonas seguras y seguimiento se acotan e interpolan', () => {
  const s = P.scene({ textX: 95, textY: 98, layers: [{ x: 95, y: 99, width: 90 }] });
  F.safe(s, 'tiktok');
  assert.ok(s.textY < 70);
  assert.ok(s.layers[0].x + s.layers[0].width / 2 <= 78);
  assert.equal(s.subtitleY, 64);
  assert.equal(
    F.interpolate(
      [
        { t: 0, x: 20 },
        { t: 2, x: 80 },
      ],
      1,
    ),
    50,
  );
  assert.equal(F.interpolate([], 1, 35), 35);
});
test('Referencias y restauración incluyen audio adicional y video superpuesto', () => {
  const x = {
    audioTracks: [{ asset: 'a' }],
    scenes: [P.scene({ layers: [{ kind: 'video', asset: 'b' }] })],
  };
  assert.deepEqual(P.references(x).sort(), ['a', 'b']);
  P.ensure(x);
  P.remap(
    x,
    new Map([
      ['a', 'new-a'],
      ['b', 'new-b'],
    ]),
  );
  assert.equal(x.audioTracks[0].asset, 'new-a');
  assert.equal(x.scenes[0].layers[0].asset, 'new-b');
});
