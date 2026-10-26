/* The recording remains on-device; only public model files are downloaded. */
let transcriber;
self.onmessage = async ({ data }) => {
  try {
    const { pipeline, env } =
      await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    transcriber ||= await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (p) =>
        self.postMessage({
          type: 'progress',
          message:
            p.status === 'progress'
              ? `${p.file}: ${Math.round(p.progress || 0)}%`
              : 'Preparando modelo de voz…',
        }),
    });
    const result = await transcriber(data.samples, {
      language: data.language || 'spanish',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 25,
      stride_length_s: 4,
    });
    self.postMessage({
      type: 'done',
      words: (result.chunks || []).map((c) => ({
        text: c.text.trim(),
        start: c.timestamp[0] ?? 0,
        end: c.timestamp[1] ?? c.timestamp[0] + 0.2,
      })),
    });
  } catch (e) {
    self.postMessage({ type: 'error', message: e.message });
  }
};
