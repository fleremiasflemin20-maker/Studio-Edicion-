const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const P = require('../dist/creator-core.js');
function previewFixture(video = false) {
  const scene = {
    id: 'project',
    activeScene: 'one',
    asset: video ? 'clip' : null,
    start: video ? 2 : 0,
    end: video ? 4 : 0,
    sourceDuration: 10,
    duration: 6,
    speed: 1,
    musicLoop: true,
  };
  const nodes = {
    '#canvas': { width: 720, getContext: () => ({}) },
    '#playBtn': {},
    '#seek': {},
    '#time': {},
  };
  let now = 0,
    next = 0;
  const frames = new Map();
  const media = video
    ? {
        readyState: 3,
        currentTime: 2,
        duration: 10,
        paused: true,
        play: async function () {
          this.paused = false;
        },
        pause() {
          this.paused = true;
        },
      }
    : null;
  const ctx = {
    P,
    p: () => scene,
    $: (s) => nodes[s],
    rendering: false,
    previewMedia: media,
    previewMusic: null,
    previewSeconds: 0,
    selectedLayer: null,
    imageObj: null,
    hitBoxes: [],
    paintScene: () => [],
    performance: { now: () => now },
    toast: (message) => {
      throw Error(message);
    },
    seekMedia: async (m, t) => (m.currentTime = t),
    requestAnimationFrame: (cb) => {
      frames.set(++next, cb);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  vm.createContext(ctx);
  const code = fs
    .readFileSync(require.resolve('../dist/creator-render.js'), 'utf8')
    .split('async function preloadSequence')[0];
  vm.runInContext(code, ctx);
  return {
    ctx,
    nodes,
    scene,
    media,
    frame(t) {
      now = t;
      const cb = [...frames.values()][0];
      frames.clear();
      cb?.(now);
    },
    pending: () => frames.size,
  };
}
test('still preview updates the playhead and resumes from pause instead of restarting', async () => {
  const f = previewFixture();
  await f.ctx.togglePreview();
  f.frame(1500);
  assert.equal(f.ctx.previewSeconds, 1.5);
  assert.equal(f.nodes['#seek'].value, 1.5);
  assert.equal(f.nodes['#time'].textContent, '1.5 / 6.0 s');
  await f.ctx.togglePreview();
  assert.equal(f.pending(), 0);
  await f.ctx.togglePreview();
  f.frame(2000);
  assert.equal(f.ctx.previewSeconds, 2);
});
test('video preview stops at trim boundary independently of native timeupdate events', async () => {
  const f = previewFixture(true);
  await f.ctx.togglePreview();
  f.media.currentTime = 4.1;
  f.frame(100);
  assert.equal(f.media.paused, true);
  assert.equal(f.pending(), 0);
  assert.equal(f.ctx.previewSeconds, 2);
  assert.equal(f.nodes['#seek'].value, 4);
});
test('changing the active scene stops an old preview loop', async () => {
  const f = previewFixture();
  await f.ctx.togglePreview();
  f.scene.activeScene = 'two';
  f.frame(100);
  assert.equal(f.pending(), 0);
  assert.match(f.nodes['#playBtn'].textContent, /Reproducir/);
});
function captureFixture(options = {}) {
  const nodes = { '#flow-record-video': {}, '#flow-prompter': { dataset: {} }, '#flow-clock': {} };
  let stopped = 0;
  const track = {
    stop() {
      stopped++;
    },
    addEventListener() {},
  };
  const stream = { getTracks: () => [track] };
  const saves = [],
    messages = [],
    recorders = [];
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    constructor(_stream, settings) {
      if (options.encoderError) throw Error('Encoder unavailable');
      this.mimeType = settings?.mimeType || 'video/webm';
      this.state = 'inactive';
      recorders.push(this);
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.stopped = this.onstop?.();
    }
    chunk() {
      this.ondataavailable({ data: new Blob(['capture'], { type: this.mimeType }) });
    }
  }
  const abort = new AbortController();
  const ctx = {
    Blob,
    MediaRecorder: Recorder,
    navigator: {
      mediaDevices: {
        getUserMedia: options.permission || (async () => stream),
        getDisplayMedia: async () => stream,
      },
    },
    value: (key) => (key === 'source' ? 'camera' : 'script'),
    abort,
    stream: null,
    recorder: null,
    clock: null,
    busy: false,
    $: (s) => nodes[s],
    status: (m) => messages.push(m),
    recorderType: () => 'video/webm',
    storeAsset: async (blob) => {
      saves.push(blob);
      return { url: 'blob:take' };
    },
    setTimeout: (fn) => queueMicrotask(fn),
    setInterval: () => 1,
    clearInterval() {},
    Date,
    Error,
  };
  vm.createContext(ctx);
  const code = fs.readFileSync(require.resolve('../dist/flow.js'), 'utf8');
  vm.runInContext(
    code.slice(
      code.indexOf('  async function record()'),
      code.indexOf('  async function runJobs()'),
    ),
    ctx,
  );
  return { ctx, abort, stream, recorders, saves, messages, stopped: () => stopped };
}
test('canceling capture discards partial data and stops the device', async () => {
  const f = captureFixture();
  await f.ctx.record();
  const r = f.recorders[0];
  r.chunk();
  f.abort.abort();
  await r.stopped;
  assert.equal(f.saves.length, 0);
  assert.equal(f.stopped(), 1);
  assert.equal(f.ctx.recorder, null);
  assert.match(f.messages.at(-1), /cancelada/);
});
test('finishing a capture saves one playable blob and releases the device', async () => {
  const f = captureFixture();
  await f.ctx.record();
  const r = f.recorders[0];
  r.chunk();
  r.stop();
  await r.stopped;
  assert.equal(f.saves.length, 1);
  assert.equal(f.saves[0].type, 'video/webm');
  assert.equal(f.stopped(), 1);
  assert.equal(f.ctx.busy, false);
});
test('encoder initialization failures release the acquired device', async () => {
  const f = captureFixture({ encoderError: true });
  await assert.rejects(f.ctx.record(), /Encoder unavailable/);
  assert.equal(f.stopped(), 1);
  assert.equal(f.ctx.stream, null);
});
test('permission arriving after cancellation cannot start a recording', async () => {
  let grant;
  const permission = new Promise((resolve) => {
    grant = resolve;
  });
  const f = captureFixture({ permission: () => permission });
  const pending = f.ctx.record();
  f.abort.abort();
  grant(f.stream);
  await assert.rejects(pending, /cancelada/);
  assert.equal(f.recorders.length, 0);
  assert.equal(f.stopped(), 1);
});
test('empty capture is rejected instead of creating an unusable library item', async () => {
  const f = captureFixture();
  await f.ctx.record();
  const r = f.recorders[0];
  r.stop();
  await r.stopped;
  assert.equal(f.saves.length, 0);
  assert.match(f.messages.at(-1), /vacía/);
});
