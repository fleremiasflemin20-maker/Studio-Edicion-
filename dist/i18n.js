(function (root) {
  'use strict';
  const key = 'fleremahias-language';
  const translator = root.FleremahiasLocaleCore.create(root.FleremahiasEnglish || {});
  let chosen = null;
  try {
    chosen = localStorage.getItem(key);
  } catch {}
  let locale = chosen === 'en' ? 'en' : 'es';
  document.documentElement.lang = locale;
  const originals = new WeakMap(),
    attributes = new WeakMap();
  let observer,
    languageDialog,
    changing = false;
  const t = (value) => translator.translate(value, locale);
  const protectedSelector =
    'script,style,textarea,input,code,pre,canvas,svg,.pro-saved-grid strong,.pro-saved-grid article > p,[translate="no"],[data-i18n-ignore],#script,#promptContent,#flow-prompter,.project .poster,.project .info strong,.media-tiles small,.asset-name,.board-project h3,.board-project-preview strong';
  function userValues() {
    const values = new Set();
    if (typeof projects !== 'undefined')
      for (const project of projects) {
        values.add(project.name);
        for (const scene of project.scenes || []) {
          if (scene.name && !/^Escena \d+$/.test(scene.name)) values.add(scene.name);
          for (const layer of scene.layers || []) if (layer.text) values.add(layer.text);
        }
      }
    if (typeof assets !== 'undefined') for (const asset of assets) values.add(asset.name);
    return values;
  }
  function sourceFor(store, object, current) {
    const saved = store.get(object);
    return saved && current === saved.output ? saved.source : current;
  }
  function apply(node = document.body) {
    if (!node || changing) return;
    changing = true;
    observer?.disconnect();
    try {
      const own = userValues();
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const nodes = node.nodeType === Node.TEXT_NODE ? [node] : [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const textNode of nodes) {
        const parent = textNode.parentElement;
        if (!parent || parent.closest(protectedSelector) || !textNode.nodeValue.trim()) continue;
        const current = textNode.nodeValue;
        const source = sourceFor(originals, textNode, current);
        if (
          own.has(source.trim()) &&
          parent.closest(
            'h1,.project,.asset,.media-tiles,.flow-media-grid,.scene-card,.board-node,.pro-saved-grid,.flow-job,.layer-row,option,.design-selection',
          )
        )
          continue;
        // Translating a label must not change the option's implicit application value.
        if (parent.tagName === 'OPTION' && !parent.hasAttribute('value'))
          parent.setAttribute('value', parent.value);
        const translated = t(source);
        const output =
          translated === source
            ? source
            : (source.match(/^\s*/)?.[0] || '') +
              translated.trim() +
              (source.match(/\s*$/)?.[0] || '');
        if (output !== current) textNode.nodeValue = output;
        originals.set(textNode, { source, output });
      }
      const elements =
        node.nodeType === Node.ELEMENT_NODE
          ? [
              node,
              ...node.querySelectorAll(
                '[aria-label],[title],[placeholder],[data-help-description]',
              ),
            ]
          : [];
      for (const el of elements) {
        if (el.closest('[translate="no"],[data-i18n-ignore]')) continue;
        let saved = attributes.get(el);
        if (!saved) {
          saved = {};
          attributes.set(el, saved);
        }
        for (const attr of ['aria-label', 'title', 'placeholder', 'data-help-description']) {
          if (!el.hasAttribute(attr)) continue;
          const current = el.getAttribute(attr),
            old = saved[attr];
          const source = old && current === old.output ? old.source : current;
          let output = t(source);
          if (
            ['aria-label', 'title'].includes(attr) &&
            el.matches('.board-project,.board-media,.project') &&
            own.has(source.trim())
          )
            output = source;
          const addTool = source.match(/^Añadir (.+) al tablero$/);
          if (locale === 'en' && addTool && el.closest('[data-board-source="tool"]'))
            output = 'Add ' + t(addTool[1]) + ' to board';
          if (current !== output) el.setAttribute(attr, output);
          saved[attr] = { source, output };
        }
      }
    } finally {
      changing = false;
      observer?.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'title', 'placeholder', 'data-help-description'],
      });
    }
  }
  function setLocale(next) {
    if (!['es', 'en'].includes(next)) return;
    locale = next;
    chosen = next;
    try {
      localStorage.setItem(key, next);
    } catch {}
    document.documentElement.lang = next;
    apply();
    document.querySelectorAll('[data-studio-language]').forEach((button) => {
      button.textContent = next === 'en' ? 'EN / ES' : 'ES / EN';
      button.setAttribute(
        'aria-label',
        next === 'en' ? 'Change language: English or Spanish' : 'Cambiar idioma: español o inglés',
      );
    });
    document.dispatchEvent(new CustomEvent('studio:languagechange', { detail: { locale: next } }));
  }
  function choose() {
    if (!languageDialog) {
      languageDialog = document.createElement('dialog');
      languageDialog.className = 'language-dialog';
      languageDialog.setAttribute('aria-labelledby', 'language-title');
      languageDialog.setAttribute('translate', 'no');
      languageDialog.innerHTML =
        '<img src="brand-mark.svg" width="48" height="48" alt=""><p>FLEREMAHIAS STUDIO</p><h2 id="language-title">Tu estudio. Tu idioma.<br><span>Your studio. Your language.</span></h2><p>Elige cómo quieres crear.<br>Choose your workspace language.</p><div class="language-options"><button type="button" data-language="es"><strong>Español</strong><span>Crear en español →</span></button><button type="button" data-language="en"><strong>English</strong><span>Create in English →</span></button></div><small>Puedes cambiarlo cuando quieras con ES / EN.<br>You can switch anytime using ES / EN.</small>';
      languageDialog.addEventListener('click', (event) => {
        const button = event.target.closest('[data-language]');
        if (!button) return;
        setLocale(button.dataset.language);
        languageDialog.close();
      });
      languageDialog.addEventListener('cancel', (event) => {
        if (!chosen) event.preventDefault();
      });
      document.body.append(languageDialog);
    }
    if (!languageDialog.open) languageDialog.showModal();
  }
  // Translate native UI messages as well as custom dialogs. User-entered defaults stay unchanged.
  for (const name of ['alert', 'confirm', 'prompt']) {
    const original = root[name].bind(root);
    root[name] = (message, ...args) => original(t(message), ...args);
  }
  root.StudioI18n = {
    t,
    apply,
    setLocale,
    choose,
    locale: () => locale,
    hasChosen: () => !!chosen,
  };
  document.addEventListener('DOMContentLoaded', () => {
    observer = new MutationObserver((records) => {
      // Only revisit changed subtrees. This avoids scanning the editor on every playback tick.
      const targets = new Set(
        records.map((record) =>
          record.type === 'childList'
            ? record.target
            : record.target.parentElement || record.target,
        ),
      );
      for (const target of targets) if (target.isConnected) apply(target);
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-studio-language]')) choose();
    });
    apply();
    document.querySelectorAll('[data-studio-language]').forEach((button) => {
      button.textContent = locale === 'en' ? 'EN / ES' : 'ES / EN';
    });
    if (!chosen) choose();
  });
})(window);
