/* Local semantic search and person masks. Media/text never leave this worker. */
let extractor,
  segmenter,
  vectors = new Map(),
  previousMask = null;
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const progress = (id, phase, message, value) =>
  self.postMessage({ id, type: 'progress', phase, message, progress: value });
async function embeddings(id) {
  if (!extractor) {
    const { pipeline, env } =
      await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    extractor = await pipeline('feature-extraction', MODEL, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (p) =>
        progress(
          id,
          'model',
          p.status === 'progress'
            ? `${p.file}: ${Math.round(p.progress || 0)}%`
            : 'Preparing multilingual model…',
          p.status === 'progress' ? (p.progress || 0) / 100 : null,
        ),
    });
  }
  return extractor;
}
function cosine(a, b) {
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
async function hash(value) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function search(m) {
  const pipe = await embeddings(m.id),
    key = await hash(JSON.stringify(m.segments));
  let document = vectors.get(key);
  if (!document) {
    document = [];
    for (let i = 0; i < m.segments.length; i++) {
      const v = await pipe(m.segments[i].text, { pooling: 'mean', normalize: true });
      document.push(Array.from(v.data));
      progress(m.id, 'index', 'Indexing transcript…', (i + 1) / m.segments.length);
    }
    vectors.set(key, document);
    if (vectors.size > 6) vectors.delete(vectors.keys().next().value);
  }
  const query = await pipe(m.query, { pooling: 'mean', normalize: true });
  const results = m.segments
    .map((s, i) => ({ ...s, score: cosine(document[i], query.data) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, m.limit);
  self.postMessage({ id: m.id, type: 'done', segments: results, model: MODEL, local: true });
}
async function prepareSegmenter(id) {
  if (segmenter) return;
  progress(id, 'model', 'Downloading person segmentation model…', null);
  const m =
    await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
  const files = await m.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
  );
  segmenter = await m.ImageSegmenter.createFromOptions(files, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}
async function segment(m) {
  await prepareSegmenter(m.id);
  const result = segmenter.segment(m.bitmap);
  try {
    // The binary selfie model exposes one foreground confidence plane; multiclass models expose a person plane at index 1.
    const person = result.confidenceMasks?.[1] || result.confidenceMasks?.[0];
    if (!person) throw Error('The model did not return a person mask.');
    const raw = person.getAsFloat32Array(),
      width = person.width,
      height = person.height,
      alpha = new Uint8ClampedArray(raw.length);
    const smooth = m.temporal && previousMask?.length === raw.length;
    for (let i = 0; i < raw.length; i++) {
      const value = Math.max(0, Math.min(1, (raw[i] - 0.15) / 0.7));
      alpha[i] = Math.round(255 * (smooth ? value * 0.8 + (previousMask[i] / 255) * 0.2 : value));
    }
    previousMask = m.temporal ? alpha.slice() : null;
    self.postMessage({ id: m.id, type: 'mask', width, height, alpha }, [alpha.buffer]);
  } finally {
    result.close();
    m.bitmap.close();
  }
}
let chain = Promise.resolve();
self.onmessage = ({ data: m }) => {
  chain = chain.then(async () => {
    try {
      if (m.type === 'search') await search(m);
      else if (m.type === 'prepare-mask') {
        await prepareSegmenter(m.id);
        previousMask = null;
        self.postMessage({ id: m.id, type: 'ready' });
      } else if (m.type === 'segment') await segment(m);
    } catch (error) {
      try {
        m.bitmap?.close();
      } catch {}
      self.postMessage({ id: m.id, type: 'error', message: error.message });
    }
  });
};
