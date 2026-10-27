import React from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import * as Remotion from 'remotion';
import * as Three from 'three';
import * as Fiber from '@react-three/fiber';
import * as RemotionThree from '@remotion/three';
import * as Media from '@remotion/media';
import { renderMediaOnWeb, renderStillOnWeb, canRenderMediaOnWeb } from '@remotion/web-renderer';
import { transform } from 'sucrase';
import { components, withAudio, starter } from './scenes.jsx';
import Core from '../../dist/motion-core.js';
// Opaque-origin frames use ephemeral SDK preferences, never the host's storage.
const memoryStore = new Map();
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key) => memoryStore.get(String(key)) ?? null,
    setItem: (key, value) => memoryStore.set(String(key), String(value)),
    removeItem: (key) => memoryStore.delete(String(key)),
    clear: () => memoryStore.clear(),
    key: (index) => [...memoryStore.keys()][index] ?? null,
    get length() {
      return memoryStore.size;
    },
  },
});
let nonce = '',
  videoConfig,
  Scene,
  draft,
  audioURL,
  renderAbort,
  activeRender = null;
const player = React.createRef(),
  root = createRoot(document.getElementById('root'));
const send = (type, data = {}, id) =>
  parent.postMessage({ source: 'fleremahias-motion', nonce, type, id, ...data }, '*');
const fetchLocal = globalThis.fetch.bind(globalThis),
  licenseRequests = new Map();
// Broker only the SDK's technical render counter. User code has no general network access.
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return fetchLocal(input, init);
  if (url === 'https://www.remotion.pro/api/track/register-usage-point' && activeRender) {
    const data = JSON.parse(init.body || '{}');
    if (data.event !== 'web-render') return Promise.reject(Error('Unsupported request'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      licenseRequests.set(id, { resolve, reject });
      send(
        'license',
        {
          renderId: activeRender,
          succeeded: data.succeeded === true,
          isStill: data.isStill === true,
          isProduction: data.isProduction !== false,
          idempotencyKey: String(data.idempotencyKey || id).slice(0, 80),
        },
        id,
      );
    });
  }
  return Promise.reject(Error('Network access is disabled in creative code.'));
};
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    send('error', { message: error.message }, this.props.requestId);
  }
  render() {
    return this.state.error ? (
      <div style={{ color: '#f6b3a9', padding: 24, fontFamily: 'Arial' }}>
        {this.state.error.message}
      </div>
    ) : (
      this.props.children
    );
  }
}
function compile(code) {
  if (code.length > 100000) throw Error('Code exceeds 100 KB.');
  if (
    /\b(?:while|for)\s*\(|\b(?:eval|fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(|\bimport\s*\(/.test(
      code,
    )
  )
    throw Error(
      'Use frame-based animation and array.map(); loops and network access are disabled.',
    );
  const modules = {
    react: React,
    remotion: Remotion,
    three: Three,
    '@react-three/fiber': Fiber,
    '@remotion/three': RemotionThree,
    '@remotion/media': Media,
  };
  const require = (name) => {
    if (!Object.hasOwn(modules, name)) throw Error('Unsupported import: ' + name);
    return modules[name];
  };
  const exports = {};
  const js = transform(code, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  }).code;
  new Function('require', 'exports', 'module', js)(require, exports, { exports });
  if (typeof exports.default !== 'function')
    throw Error('Export a React component using export default function.');
  return exports.default;
}
async function load(message) {
  draft = Core.normalize(message.draft);
  videoConfig = Core.config(draft);
  const Component = draft.code ? compile(draft.code) : components[draft.preset];
  if (audioURL) URL.revokeObjectURL(audioURL);
  audioURL =
    draft.sound === 'off'
      ? null
      : URL.createObjectURL(
          new Blob([Core.score(draft.duration, draft.sound)], { type: 'audio/wav' }),
        );
  Scene = withAudio(Component, draft, audioURL);
  root.render(
    <Boundary key={message.id} requestId={message.id}>
      <Player
        ref={player}
        component={Scene}
        durationInFrames={videoConfig.durationInFrames}
        fps={videoConfig.fps}
        compositionWidth={videoConfig.width}
        compositionHeight={videoConfig.height}
        controls={false}
        clickToPlay={false}
        style={{ width: '100%', height: '100%' }}
        inputProps={{}}
      />
    </Boundary>,
  );
  const videoOptions = {
    width: videoConfig.width,
    height: videoConfig.height,
    muted: draft.sound === 'off',
  };
  const [mp4, webm] = await Promise.all([
    canRenderMediaOnWeb({
      ...videoOptions,
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: draft.sound === 'off' ? null : 'aac',
    }),
    canRenderMediaOnWeb({
      ...videoOptions,
      container: 'webm',
      videoCodec: 'vp8',
      audioCodec: draft.sound === 'off' ? null : 'opus',
    }),
  ]);
  send(
    'loaded',
    {
      capabilities: {
        mp4: mp4.canRender,
        webm: webm.canRender,
        issues: [...mp4.issues, ...webm.issues].map((i) => i.message),
      },
      config: videoConfig,
      starter,
    },
    message.id,
  );
}
async function render(message) {
  if (!Scene) throw Error('Open a composition first.');
  if (activeRender) throw Error('A render is already running.');
  player.current?.pause();
  activeRender = message.id;
  renderAbort = new AbortController();
  try {
    const composition = { ...videoConfig, component: Scene };
    let blob;
    const common = {
      composition,
      inputProps: {},
      signal: renderAbort.signal,
      licenseKey: message.licenseKey || null,
      isProduction: message.isProduction !== false,
    };
    if (message.kind === 'png') {
      const image = await renderStillOnWeb({
        ...common,
        frame: Math.max(0, Math.min(videoConfig.durationInFrames - 1, message.frame || 0)),
      });
      blob = await image.blob({ format: 'png' });
    } else {
      const result = await renderMediaOnWeb({
        ...common,
        container: message.container,
        videoCodec: message.container === 'mp4' ? 'h264' : 'vp8',
        audioCodec: draft.sound === 'off' ? null : message.container === 'mp4' ? 'aac' : 'opus',
        muted: draft.sound === 'off',
        videoBitrate: videoConfig.width * videoConfig.height > 2200000 ? 16000000 : 6000000,
        pageResponsiveness: 'high',
        onProgress: ({ progress, encodedFrames }) =>
          send('progress', { progress, encodedFrames }, message.id),
      });
      blob = await result.getBlob();
    }
    if (renderAbort.signal.aborted) throw Error('Render canceled.');
    if (!blob.size || blob.size > 200 * 1024 * 1024)
      throw Error('The render is empty or exceeds 200 MB.');
    const bytes = await blob.arrayBuffer();
    parent.postMessage(
      {
        source: 'fleremahias-motion',
        nonce,
        type: 'result',
        id: message.id,
        mime: blob.type,
        bytes,
      },
      '*',
      [bytes],
    );
  } finally {
    activeRender = null;
    renderAbort = null;
  }
}
window.addEventListener('message', async (event) => {
  if (event.source !== parent) return;
  const m = event.data;
  if (m?.source !== 'fleremahias-studio') return;
  if (m.type === 'init') nonce = m.nonce;
  if (!nonce || m.nonce !== nonce) return;
  try {
    if (m.type === 'init' || m.type === 'load') await load(m);
    if (m.type === 'play') player.current?.toggle();
    if (m.type === 'seek') player.current?.seekTo(Number(m.frame) || 0);
    if (m.type === 'render') await render(m);
    if (m.type === 'cancel') renderAbort?.abort();
    if (m.type === 'license-result') {
      const pending = licenseRequests.get(m.id);
      if (pending) {
        licenseRequests.delete(m.id);
        pending.resolve(
          new Response(m.body || '{}', {
            status: m.status || 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
    }
  } catch (error) {
    send('error', { message: error.message }, m.id);
  }
});
setInterval(() => {
  if (player.current)
    send('frame', { frame: player.current.getCurrentFrame(), playing: player.current.isPlaying() });
}, 120);
send('engine-ready');
