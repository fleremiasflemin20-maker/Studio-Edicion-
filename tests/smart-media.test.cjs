const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const S = require('../dist/smart-media.js');
const timed = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    text: i % 12 === 11 ? 'idea.' : 'palabra',
    start: i * 0.5,
    end: i * 0.5 + 0.45,
  }));
test('semantic passages retain every word and exact source boundaries', () => {
  const words = timed(60),
    segments = S.segmentTranscript(words);
  assert.equal(segments.map((s) => s.text).join(' '), words.map((w) => w.text).join(' '));
  assert.equal(segments[0].start, 0);
  assert.equal(segments.at(-1).end, words.at(-1).end);
  assert.ok(segments.every((s) => s.end > s.start && s.end - s.start <= 24));
});
test('semantic search refuses invalid timings, oversized input and empty topic', async () => {
  assert.throws(() => S.segmentTranscript([{ text: 'bad', start: 5, end: 2 }]));
  assert.throws(() =>
    S.segmentTranscript([
      { text: 'a', start: 3, end: 4 },
      { text: 'b', start: 1, end: 2 },
    ]),
  );
  assert.throws(() => S.segmentTranscript(Array(15001).fill({})));
  await assert.rejects(S.search(timed(), ''), /topic/);
  await assert.rejects(S.search([], 'tema'), /Transcribe/);
});
test('brush erasing and restoration interpolate the entire stroke without changing original alpha', () => {
  const original = new Uint8ClampedArray(32 * 32).fill(255);
  const erased = S.editMask(original, 32, 32, [
    {
      mode: 'erase',
      radius: 0.06,
      points: [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    },
  ]);
  assert.ok(original.every((v) => v === 255));
  assert.equal(erased[16 * 32 + 16], 0);
  assert.equal(erased[0], 255);
  const restored = S.editMask(erased, 32, 32, [
    { mode: 'restore', radius: 0.1, points: [{ x: 0.5, y: 0.5 }] },
  ]);
  assert.equal(restored[16 * 32 + 16], 255);
});
test('mask editing rejects invalid shape and out-of-bounds normalized strokes', () => {
  assert.throws(() => S.editMask(new Uint8ClampedArray(12), 3.5, 3));
  assert.throws(() =>
    S.editMask(new Uint8ClampedArray(9), 3, 3, [{ mode: 'erase', points: [{ x: 2, y: 0.5 }] }]),
  );
  assert.throws(() =>
    S.editMask(new Uint8ClampedArray(9), 3, 3, Array(201).fill({ mode: 'erase', points: [] })),
  );
});
function harness() {
  const instances = [];
  class Worker extends EventTarget {
    constructor() {
      super();
      instances.push(this);
    }
    postMessage(data) {
      this.message = data;
    }
    terminate() {
      this.stopped = true;
    }
    reply(data) {
      this.dispatchEvent(new MessageEvent('message', { data: { id: this.message.id, ...data } }));
    }
  }
  const scope = {
    globalThis: null,
    Worker,
    DOMException,
    AbortController,
    Blob,
    Uint8ClampedArray,
    EventTarget,
    MessageEvent,
    setTimeout,
    clearTimeout,
  };
  scope.globalThis = scope;
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/smart-media.js'), 'utf8'), scope);
  return { api: scope.FleremahiasSmartMedia, instances };
}
test('search progress and response use a dedicated worker without uploading the transcript', async () => {
  const { api, instances } = harness(),
    progress = [];
  const pending = api.search(timed(), 'consejos', {
      limit: 3,
      onProgress: (p) => progress.push(p),
    }),
    w = instances[0];
  assert.equal(w.message.type, 'search');
  assert.equal(w.message.query, 'consejos');
  assert.equal(w.message.limit, 3);
  w.reply({ type: 'progress', phase: 'index', progress: 0.5 });
  w.reply({
    type: 'done',
    segments: [{ text: 'result', start: 0, end: 2, score: 0.7 }],
    local: true,
  });
  const result = await pending;
  assert.equal(result.segments[0].score, 0.7);
  assert.equal(progress.length, 1);
  assert.equal(result.local, true);
});
test('canceling a search terminates inference and next search can create a fresh worker', async () => {
  const { api, instances } = harness(),
    controller = new AbortController();
  const pending = api.search(timed(), 'tema', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (e) => e.name === 'AbortError');
  assert.equal(instances[0].stopped, true);
  const next = api.search(timed(), 'otro');
  assert.equal(instances.length, 2);
  instances[1].reply({ type: 'done', segments: [] });
  await next;
});
test('a canceled request never initializes a model worker', async () => {
  const { api, instances } = harness(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    api.search(timed(), 'tema', { signal: controller.signal }),
    (e) => e.name === 'AbortError',
  );
  assert.equal(instances.length, 0);
});

test('WebM finalization inserts finite duration while preserving unknown cluster data', () => {
  const info = Uint8Array.from([
    0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40,
  ]);
  const cluster = Uint8Array.from([0x1f, 0x43, 0xb6, 0x75, 0xff, 1, 2, 3, 4, 5]);
  const input = new Uint8Array(5 + info.length + cluster.length);
  input.set([0x18, 0x53, 0x80, 0x67, 0xff]);
  input.set(info, 5);
  input.set(cluster, 5 + info.length);
  const output = S.addWebmDuration(input, 1.5);
  assert.equal(output.length, input.length + 11);
  assert.deepEqual(output.slice(-cluster.length), cluster);
  assert.deepEqual(input.slice(5, 17), info);
  const durationAt = output.findIndex(
    (v, i) => v === 0x44 && output[i + 1] === 0x89 && output[i + 2] === 0x88,
  );
  assert.ok(durationAt > 0);
  assert.equal(new DataView(output.buffer).getFloat64(durationAt + 3, false), 1500);
});
test('WebM finalization fails closed for truncated or indexed files and invalid duration', () => {
  assert.throws(() => S.addWebmDuration(new Uint8Array([0]), 1));
  assert.throws(
    () =>
      S.addWebmDuration(
        new Uint8Array([0x18, 0x53, 0x80, 0x67, 0xff, 0x11, 0x4d, 0x9b, 0x74, 0x80]),
        1,
      ),
    /Indexed/,
  );
  assert.throws(() => S.addWebmDuration(new Uint8Array(), Infinity));
  assert.throws(
    () => S.addWebmDuration(new Uint8Array([0x18, 0x53, 0x80, 0x67, 0x8a, 1]), 1),
    /exceeds/,
  );
});
