const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../dist/i18n-core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/i18n-catalog.js'), 'utf8'), context);
const catalog = context.window.FleremahiasEnglish;
const { translate: t } = core.create(catalog);
test('English uses consistent professional interface terms', () => {
  for (const [es, en] of [
    ['Vista general', 'Overview'],
    ['Nuevo proyecto', 'New project'],
    ['Composición Pro', 'Advanced composition'],
    ['Guardado local', 'Saved locally'],
    ['Subtítulos', 'Captions'],
    ['Calendario', 'Calendar'],
  ])
    assert.equal(t(es, 'en'), en);
});
test('icons, counters and dates localize without changing their data', () => {
  assert.equal(t('＋ Nuevo proyecto', 'en'), '＋ New project');
  assert.equal(t('Ver todos los proyectos ↗', 'en'), 'View all projects ↗');
  assert.equal(t('4 escenas · 12.0 s', 'en'), '4 scenes · 12.0 s');
  assert.equal(t('26 de octubre de 2026', 'en'), 'October 26, 2026');
  assert.equal(t('Mover escena 2 a la derecha', 'en'), 'Move scene 2 right');
});
test('Spanish and unknown creator content remain unchanged', () => {
  for (const s of [
    '  Nuevo proyecto  ',
    'Mi campaña personal — 2026',
    'tutorial-español.mp4',
    '{{titulo}}',
    'const text = "Guardar";',
    'Mi título: Nuevo proyecto',
  ]) {
    assert.equal(t(s, 'es'), s);
    if (s.trim() !== 'Nuevo proyecto') assert.equal(t(s, 'en'), s);
  }
});
test('all guide chapters, steps and control explanations have English entries', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/help-content.js'), 'utf8'), ctx);
  for (const chapter of ctx.window.FleremahiasHelpContent.chapters) {
    for (const text of [
      chapter.title,
      chapter.intro,
      ...(chapter.steps || []),
      ...chapter.controls.flat(),
    ].filter(Boolean))
      assert.ok(Object.hasOwn(catalog, core.normalize(text)), 'Missing: ' + text);
  }
});
