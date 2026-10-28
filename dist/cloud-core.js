(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasCloudCore = api;
})(globalThis, function () {
  'use strict';
  const blocked = new Set(['__proto__', 'constructor', 'prototype']);
  function documentOf(project, sceneKeys = []) {
    const doc = structuredClone(project);
    delete doc.cloud;
    delete doc.flowVersions;
    delete doc.activeScene;
    for (const key of sceneKeys) if (key !== 'name') delete doc[key];
    return doc;
  }
  function diff(before, after, path = [], output = []) {
    if (JSON.stringify(before) === JSON.stringify(after)) return output;
    if (
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (blocked.has(key) || ['id', 'created'].includes(key)) continue;
        diff(before[key], after[key], [...path, key], output);
      }
    } else if (
      Array.isArray(before) &&
      Array.isArray(after) &&
      before.every((x) => x && typeof x === 'object' && typeof x.id === 'string') &&
      after.every((x) => x && typeof x === 'object' && typeof x.id === 'string') &&
      before.length === after.length &&
      before.every((x, i) => x.id === after[i].id)
    ) {
      for (let i = 0; i < before.length; i++)
        diff(before[i], after[i], [...path, before[i].id], output);
    } else
      output.push({
        path,
        before: structuredClone(before),
        ...(after === undefined ? { remove: true } : { value: structuredClone(after) }),
      });
    return output;
  }
  function rebase(base, remote, local) {
    const next = structuredClone(remote),
      conflicts = [];
    for (const change of diff(base, local)) {
      let obj = next;
      for (const key of change.path.slice(0, -1))
        obj = Array.isArray(obj) ? obj.find((v) => v.id === key) : obj?.[key];
      const key = change.path.at(-1);
      if (
        !obj ||
        (JSON.stringify(obj[key]) !== JSON.stringify(change.before) &&
          JSON.stringify(obj[key]) !== JSON.stringify(change.value))
      ) {
        conflicts.push(change.path.join('.'));
        continue;
      }
      if (change.remove) delete obj[key];
      else obj[key] = structuredClone(change.value);
    }
    return { document: next, conflicts };
  }
  function mapMedia(document, mapping) {
    const out = structuredClone(document);
    const walk = (value) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, item] of Object.entries(value)) {
        if (['asset', 'audio', 'transcriptAsset'].includes(key) && typeof item === 'string')
          value[key] = mapping.get(item) || item;
        else if (typeof item === 'object') walk(item);
      }
    };
    walk(out);
    return out;
  }
  return { documentOf, diff, rebase, mapMedia };
});
