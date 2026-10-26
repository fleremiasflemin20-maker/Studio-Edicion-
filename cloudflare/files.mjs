/* Bounded temporary files in SQLite-backed Durable Object storage. No R2. */
const PART = 64 * 1024,
  MAX_FILE = 8 * 1024 * 1024,
  MAX_TOTAL = 64 * 1024 * 1024;
export class DurableFiles {
  constructor(storage) {
    this.storage = storage;
  }
  async usage() {
    const entries = [...(await this.storage.list({ prefix: 'file-meta:' })).values()];
    return {
      usedBytes: entries.reduce((n, m) => n + m.size, 0),
      limitBytes: MAX_TOTAL,
      maxFileBytes: MAX_FILE,
      files: entries.length,
      type: 'Durable Object temporal · sin R2',
    };
  }
  async put(key, value, options = {}) {
    const bytes =
      typeof value === 'string'
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
          ? value
          : new Uint8Array(await new Response(value).arrayBuffer());
    if (bytes.length > MAX_FILE) throw Error('Máximo 8 MB por archivo temporal');
    const old = await this.head(key),
      usage = await this.usage();
    if (usage.usedBytes - (old?.size || 0) + bytes.length > MAX_TOTAL)
      throw Error('Almacenamiento temporal lleno: 64 MB');
    if (old) await this.delete(key);
    const count = Math.ceil(bytes.length / PART);
    try {
      for (let i = 0; i < count; i++)
        await this.storage.put('file-body:' + key + ':' + i, bytes.slice(i * PART, (i + 1) * PART));
      await this.storage.put('file-meta:' + key, {
        key,
        size: bytes.length,
        count,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
        created: Date.now(),
      });
    } catch (e) {
      for (let i = 0; i < count; i++) await this.storage.delete('file-body:' + key + ':' + i);
      throw e;
    }
  }
  async head(key) {
    return (await this.storage.get('file-meta:' + key)) || null;
  }
  async get(key) {
    const meta = await this.head(key);
    if (!meta) return null;
    let index = 0;
    const storage = this.storage,
      body = new ReadableStream({
        async pull(controller) {
          if (index >= meta.count) {
            controller.close();
            return;
          }
          const part = await storage.get('file-body:' + key + ':' + index++);
          if (!part) {
            controller.error(Error('Archivo incompleto'));
            return;
          }
          controller.enqueue(new Uint8Array(part));
        },
      });
    return { ...meta, body, json: async () => JSON.parse(await new Response(body).text()) };
  }
  async delete(key) {
    const meta = await this.head(key);
    if (!meta) return;
    for (let i = 0; i < meta.count; i++) await this.storage.delete('file-body:' + key + ':' + i);
    await this.storage.delete('file-meta:' + key);
  }
  async clear() {
    for (const meta of (await this.storage.list({ prefix: 'file-meta:' })).values())
      await this.delete(meta.key);
  }
}

/* Private R2 with an application quota; state stays in the Durable Object. */
export class R2Files {
  constructor(bucket, storage) {
    this.bucket = bucket;
    this.storage = storage;
  }
  async usage() {
    const entries = [...(await this.storage.list({ prefix: 'r2-meta:' })).values()];
    return {
      usedBytes: entries.reduce((n, m) => n + m.size, 0),
      limitBytes: 512 * 1024 * 1024,
      maxFileBytes: 64 * 1024 * 1024,
      files: entries.length,
      type: 'R2 privado · límite interno de 512 MB',
    };
  }
  async put(key, value, options = {}) {
    const usage = await this.usage(),
      size =
        options.size ??
        (typeof value === 'string'
          ? new TextEncoder().encode(value).length
          : value.byteLength || 0),
      old = await this.storage.get('r2-meta:' + key);
    if (size > 64 * 1024 * 1024 || usage.usedBytes - (old?.size || 0) + size > usage.limitBytes)
      throw Error('Se superó el límite interno de archivos de Luma');
    const { size: ignored, ...settings } = options;
    const result = await this.bucket.put(key, value, settings);
    await this.storage.put('r2-meta:' + key, {
      key,
      size: result?.size || size,
      created: Date.now(),
    });
    return result;
  }
  head(key) {
    return this.bucket.head(key);
  }
  get(key) {
    return this.bucket.get(key);
  }
  async delete(key) {
    await this.bucket.delete(key);
    await this.storage.delete('r2-meta:' + key);
  }
  async clear() {
    for (const meta of (await this.storage.list({ prefix: 'r2-meta:' })).values())
      await this.delete(meta.key);
  }
}
