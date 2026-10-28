(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasLibrary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const version = 1;
  const provenance = Object.freeze({
    author: 'Fleremahias Studio',
    source: 'Original procedural artwork and synthesis',
    license: 'Fleremahias Original Content License 1.0',
    rights:
      'Use and adapt in personal and commercial finished content. Redistribution as a standalone competing asset library is not permitted.',
    generatedWithAI: false,
  });
  const backgroundFamilies = [
    [
      'paint',
      'Pintura libre',
      'Free paint',
      'pintura paint gotas drops pinceladas brush oscuro dark',
    ],
    [
      'aurora',
      'Aurora fluida',
      'Flowing aurora',
      'aurora fluid gradiente gradient suave soft oscuro dark',
    ],
    [
      'paper',
      'Papel editorial',
      'Editorial paper',
      'papel paper editorial textura texture elegante elegant',
    ],
    [
      'grid',
      'Retícula futura',
      'Future grid',
      'tecnologia technology grid cuadricula datos data oscuro dark',
    ],
    ['orbit', 'Órbitas', 'Orbits', 'orbitas orbits geometric geometria circular espacio space'],
    [
      'ribbon',
      'Cintas de color',
      'Color ribbons',
      'cinta ribbon arcoiris rainbow color curva curve',
    ],
    [
      'contour',
      'Mapas de líneas',
      'Contour maps',
      'lineas lines contour topografia topography elegante elegant',
    ],
    ['halftone', 'Puntos impresos', 'Printed dots', 'puntos dots halftone comic impresion print'],
    ['tiles', 'Mosaico', 'Mosaic', 'mosaico mosaic geometrico geometric bloques tiles'],
    [
      'stage',
      'Escenario de producto',
      'Product stage',
      'producto product escenario stage pedestal oferta sale',
    ],
  ];
  const elementFamilies = [
    ['arrow', 'Flecha de autor', 'Signature arrow', 'flecha arrow direccion direction'],
    ['brush', 'Trazo de pintura', 'Paint stroke', 'pintura paint pincel brush subrayado underline'],
    ['drop', 'Gotas de tinta', 'Ink drops', 'gotas drops pintura paint tinta ink'],
    ['seal', 'Sello editorial', 'Editorial seal', 'sello seal badge oferta sale'],
    ['label', 'Etiqueta flexible', 'Flexible label', 'etiqueta label titulo title'],
    ['spark', 'Destello gráfico', 'Graphic spark', 'estrella star destello spark acento accent'],
    ['frame', 'Marco de enfoque', 'Focus frame', 'marco frame foco focus camara camera'],
    ['speech', 'Globo de diálogo', 'Speech bubble', 'dialogo speech comentario comment podcast'],
    ['underline', 'Subrayado gestual', 'Gestural underline', 'subrayado underline texto text'],
    ['corner', 'Esquinas', 'Corners', 'esquinas corners encuadre framing'],
    ['blob', 'Forma orgánica', 'Organic shape', 'forma shape organica organic fondo background'],
    ['wave', 'Onda de sonido', 'Sound wave', 'onda wave audio podcast musica music'],
    ['check', 'Marca de logro', 'Achievement mark', 'check correcto success tutorial paso step'],
    ['pointer', 'Cursor de acción', 'Action cursor', 'cursor pointer click llamada action'],
    ['burst', 'Explosión editorial', 'Editorial burst', 'burst explosion comic oferta offer'],
    [
      'progress',
      'Indicador de progreso',
      'Progress marker',
      'progreso progress paso step tutorial',
    ],
  ];
  const styleNames = [
    ['Grafito', 'Graphite'],
    ['Aurora', 'Aurora'],
    ['Tinta Viva', 'Living Ink'],
    ['Cobre', 'Copper'],
    ['Papel Editorial', 'Editorial Paper'],
    ['Prisma Suave', 'Soft Prism'],
    ['Noche Neón', 'Neon Night'],
    ['Luz de Estudio', 'Studio Light'],
    ['Cine Ámbar', 'Amber Cinema'],
    ['Océano', 'Ocean'],
    ['Retrato Suave', 'Soft Portrait'],
    ['Verde Botánico', 'Botanical Green'],
    ['Blanco Editorial', 'Editorial White'],
    ['Sol de Tarde', 'Afternoon Sun'],
    ['Azul Profundo', 'Deep Blue'],
    ['Terracota', 'Terracotta'],
    ['Contraste Urbano', 'Urban Contrast'],
    ['Pastel Limpio', 'Clean Pastel'],
    ['Plata', 'Silver'],
    ['Violeta de Tinta', 'Ink Violet'],
    ['Bosque Mate', 'Matte Forest'],
    ['Luz Dorada', 'Golden Light'],
    ['Rojo Editorial', 'Editorial Red'],
    ['Minimal Noche', 'Minimal Night'],
  ];
  const titleNames = [
    ['Editorial', 'Editorial'],
    ['Impacto', 'Impact'],
    ['Subrayado', 'Underline'],
    ['Etiqueta', 'Label'],
    ['Escalera', 'Staircase'],
    ['Cita', 'Quote'],
    ['Marco', 'Frame'],
    ['Cápsula', 'Capsule'],
    ['Dos líneas', 'Two lines'],
    ['Contador', 'Counter'],
    ['Capítulo', 'Chapter'],
    ['Respuesta', 'Answer'],
    ['Producto', 'Product'],
    ['Aviso', 'Announcement'],
    ['Tarjeta', 'Card'],
    ['Firma', 'Signature'],
    ['Lista', 'List'],
    ['Dato', 'Data'],
    ['Podcast', 'Podcast'],
    ['Cierre', 'Outro'],
  ];
  const transitions = [
    ['soft-fade', 'Fundido suave', 'Soft fade', 'swell', 0.45],
    ['paper-slide', 'Deslizar papel', 'Paper slide', 'paper', 0.38],
    ['brush-wipe', 'Barrido de pincel', 'Brush wipe', 'brush', 0.5],
    ['orbit-push', 'Impulso orbital', 'Orbital push', 'whoosh', 0.36],
    ['clean-cut', 'Corte preciso', 'Precise cut', 'tick', 0.12],
    ['ribbon-reveal', 'Revelado de cinta', 'Ribbon reveal', 'sweep', 0.55],
    ['soft-zoom', 'Acercamiento suave', 'Soft zoom', 'air', 0.42],
    ['ink-dissolve', 'Disolución de tinta', 'Ink dissolve', 'water', 0.6],
    ['frame-shift', 'Cambio de marco', 'Frame shift', 'click', 0.28],
    ['wave-flow', 'Flujo de onda', 'Wave flow', 'bubble', 0.48],
    ['page-turn', 'Paso de página', 'Page turn', 'paper', 0.46],
    ['gentle-rise', 'Ascenso ligero', 'Gentle rise', 'rise', 0.5],
  ];
  const soundFamilies = [
    ['whoosh', 'Barrido', 'Whoosh'],
    ['click', 'Clic', 'Click'],
    ['pop', 'Pop', 'Pop'],
    ['tick', 'Pulso breve', 'Tick'],
    ['rise', 'Ascenso', 'Rise'],
    ['swell', 'Apertura suave', 'Soft swell'],
    ['paper', 'Papel', 'Paper'],
    ['brush', 'Pincel', 'Brush'],
    ['bubble', 'Burbuja', 'Bubble'],
    ['water', 'Gota', 'Drop'],
    ['chime', 'Campana', 'Chime'],
    ['impact', 'Impacto', 'Impact'],
    ['air', 'Aire', 'Air'],
    ['sweep', 'Deslizamiento', 'Sweep'],
    ['success', 'Logro', 'Success'],
    ['tap', 'Toque', 'Tap'],
    ['shimmer', 'Brillo sonoro', 'Shimmer'],
    ['pulse', 'Pulso', 'Pulse'],
    ['wood', 'Madera', 'Wood'],
    ['glass', 'Cristal', 'Glass'],
  ];
  const recipeNames = [
    [
      'podcast',
      'Podcast a clips',
      'Podcast to clips',
      'podcast entrevista interview frases speech',
    ],
    ['product', 'Producto a anuncio', 'Product to ad', 'producto product oferta sale anuncio ad'],
    [
      'tutorial',
      'Tutorial por pasos',
      'Step-by-step tutorial',
      'tutorial paso step educativo educational',
    ],
    [
      'audiogram',
      'Audio a publicación',
      'Audio to post',
      'audio podcast waveform onda musica music',
    ],
    [
      'photo-story',
      'Fotos a historia',
      'Photos to story',
      'foto photo imagen image historia story',
    ],
    ['data-3d', 'Datos a vídeo 3D', 'Data to 3D video', 'datos data cifras numbers 3d'],
    ['quote', 'Cita a vídeo', 'Quote to video', 'cita quote editorial texto text'],
    [
      'before-after',
      'Antes y después',
      'Before and after',
      'antes before despues after comparacion comparison',
    ],
    ['list', 'Lista de consejos', 'Tips list', 'lista list consejos tips educativo educational'],
    [
      'event',
      'Anuncio de evento',
      'Event announcement',
      'evento event fecha date anuncio announcement',
    ],
    [
      'portfolio',
      'Portafolio creativo',
      'Creative portfolio',
      'portfolio portafolio arte art fotografia photo',
    ],
    ['brand-outro', 'Cierre de marca', 'Brand outro', 'marca brand cierre outro llamada cta'],
  ];
  const catalog = [];
  function entry(type, id, name, nameEn, tags, extra = {}) {
    return {
      id,
      type,
      name,
      nameEn,
      license: provenance.license,
      tags: tags.split(' '),
      version,
      provenance,
      ...extra,
    };
  }
  for (const [family, es, en, tags] of backgroundFamilies)
    for (let variant = 0; variant < 6; variant++)
      catalog.push(
        entry(
          'background',
          `bg-${family}-${variant + 1}`,
          `${es} ${variant + 1}`,
          `${en} ${variant + 1}`,
          `fondo background textura texture ${tags}`,
          {
            family,
            variant,
            width: 1080,
            height: 1350,
            preview: `library/bg-${family}-${variant + 1}.svg`,
            supports: ['image', 'video'],
          },
        ),
      );
  for (const [family, es, en, tags] of elementFamilies)
    for (let variant = 0; variant < 5; variant++)
      catalog.push(
        entry(
          'element',
          `el-${family}-${variant + 1}`,
          `${es} ${variant + 1}`,
          `${en} ${variant + 1}`,
          `elemento element svg editable ${tags}`,
          {
            family,
            variant,
            width: 512,
            height: 512,
            preview: `library/el-${family}-${variant + 1}.svg`,
            supports: ['image', 'video'],
          },
        ),
      );
  const accentColors = ['#97edc7', '#f3b787', '#9cbffd', '#f1a8bc', '#e4da8a', '#a9ded9'];
  const colorLooks = [
    { contrast: 116, saturation: 18, temperature: -6, grain: 10 },
    { contrast: 101, saturation: 116, temperature: -9 },
    { contrast: 128, saturation: 114, grain: 18 },
    { contrast: 112, saturation: 92, temperature: 31 },
    { contrast: 92, saturation: 71, temperature: 14, grain: 18 },
    { contrast: 93, saturation: 112, temperature: -3 },
    { contrast: 128, saturation: 136, temperature: -20, vignette: 30 },
    { contrast: 105, saturation: 103, exposure: 8 },
    { contrast: 118, saturation: 88, temperature: 24, vignette: 22 },
    { contrast: 109, saturation: 102, temperature: -27 },
    { contrast: 91, saturation: 92, exposure: 8 },
    { contrast: 108, saturation: 101, temperature: 3 },
    { contrast: 106, saturation: 75, exposure: 15 },
    { contrast: 101, saturation: 118, temperature: 23 },
    { contrast: 121, saturation: 88, temperature: -32, vignette: 25 },
    { contrast: 105, saturation: 93, temperature: 27 },
    { contrast: 138, saturation: 81, grain: 13 },
    { contrast: 88, saturation: 82, exposure: 12 },
    { contrast: 116, saturation: 0, temperature: -7 },
    { contrast: 113, saturation: 110, hue: 13 },
    { contrast: 88, saturation: 74, temperature: -8, grain: 9 },
    { contrast: 98, saturation: 104, temperature: 35 },
    { contrast: 120, saturation: 114, temperature: 6 },
    { contrast: 110, saturation: 65, exposure: -10, vignette: 20 },
  ];
  styleNames.forEach(([es, en], i) =>
    catalog.push(
      entry('style', `style-${i + 1}`, es, en, 'estilo style filtro filter color look original', {
        variant: i,
        effects: {
          exposure: 0,
          contrast: 100,
          saturation: 100,
          temperature: 0,
          hue: 0,
          grain: 0,
          vignette: 0,
          ...colorLooks[i],
        },
        accent: accentColors[i % 6],
        preview: `library/style-${i + 1}.svg`,
        supports: ['image', 'video'],
      }),
    ),
  );
  titleNames.forEach(([es, en], i) =>
    catalog.push(
      entry(
        'title',
        `title-${i + 1}`,
        `${es} animado`,
        `${en} animated`,
        'titulo title texto text animado animated elegante elegant podcast cta',
        {
          family: ['editorial', 'impact', 'underline', 'label', 'step'][i % 5],
          variant: i,
          animation: ['rise', 'pop', 'type', 'slide', 'fade'][Math.floor(i / 4) % 5],
          duration: 0.6 + (i % 4) * 0.1,
          accent: accentColors[i % 6],
          preview: `library/title-${i + 1}.svg`,
          supports: ['image', 'video'],
        },
      ),
    ),
  );
  transitions.forEach(([id, es, en, sound, duration], i) =>
    catalog.push(
      entry(
        'transition',
        `tr-${id}`,
        es,
        en,
        'transicion transition breve short suave soft sin-destello noflash sonido sound',
        {
          variant: i,
          visual: ['fade', 'slide', 'slide', 'zoom'][i % 4],
          soundFamily: sound,
          duration,
          preview: `library/tr-${id}.svg`,
          supports: ['video'],
        },
      ),
    ),
  );
  soundFamilies.forEach(([family, es, en], i) => {
    for (let variant = 0; variant < 2; variant++) {
      const id = `sfx-${family}-${variant + 1}`;
      catalog.push(
        entry(
          'sound',
          id,
          `${es} ${variant + 1}`,
          `${en} ${variant + 1}`,
          `sonido sound sfx efecto effect original ${family} ${es.toLowerCase()} ${en.toLowerCase()}`,
          {
            family,
            variant,
            duration: ['rise', 'swell', 'shimmer'].includes(family)
              ? 1.2 + variant * 0.6
              : ['click', 'tick', 'tap', 'wood'].includes(family)
                ? 0.16 + variant * 0.1
                : 0.4 + variant * 0.2,
            sampleRate: 24000,
            preview: `library/${id}.wav`,
            supports: ['audio', 'video'],
          },
        ),
      );
    }
  });
  recipeNames.forEach(([id, es, en, tags], i) =>
    catalog.push(
      entry('recipe', `recipe-${id}`, es, en, `receta recipe plantilla template ${tags}`, {
        objective: id,
        variant: i,
        accent: accentColors[i % 6],
        preview: `library/recipe-${id}.svg`,
        supports: ['image', 'video'],
        steps: [
          'Select source media',
          'Review text and timing',
          'Apply identity',
          'Preview and export',
        ],
      }),
    ),
  );
  for (const item of catalog) {
    if (item.type === 'style')
      item.settings = {
        brightness: 100 + item.effects.exposure,
        saturation: item.effects.saturation,
        filter: 'original',
        adjust: {
          contrast: item.effects.contrast,
          temperature: item.effects.temperature,
          hue: item.effects.hue,
          grain: item.effects.grain,
          vignette: item.effects.vignette,
        },
      };
    if (item.type === 'title')
      item.settings = {
        style: ['editorial', 'poster', 'highlight', 'label', 'mono'][item.variant % 5],
        animation: item.animation,
        size: 64 + (item.variant % 4) * 10,
        x: 50,
        y: 45 + (item.variant % 3) * 8,
        color: '#f3f7f6',
        fill: item.accent,
      };
    if (item.type === 'transition')
      item.settings = {
        transition: item.visual,
        transitionDuration: item.duration,
        soundId: 'sfx-' + item.soundFamily + '-1',
      };
    if (item.type === 'recipe')
      item.recipe = {
        objective: item.objective,
        format: '9:16',
        styleId: 'style-' + (item.variant * 2 + 1),
        titleId: 'title-' + (item.variant + 1),
        transitionId:
          'tr-' + ['soft-fade', 'paper-slide', 'brush-wipe', 'orbit-push'][item.variant % 4],
        duration: item.objective === 'product' ? 12 : item.objective === 'tutorial' ? 20 : 15,
        requires:
          item.objective === 'audiogram'
            ? ['audio']
            : item.objective === 'data-3d'
              ? ['numbers']
              : ['media'],
      };
  }
  for (const item of catalog.filter((i) => i.type === 'style'))
    item.customFilter = {
      name: item.name,
      exposure: Math.log2((100 + item.effects.exposure) / 100),
      contrast: item.effects.contrast,
      saturation: item.effects.saturation,
      temperature: item.effects.temperature,
      gamma: 1,
      shadows: 0,
      highlights: 0,
      intensity: 1,
      texture: item.effects.grain ? 'grain' : 'none',
      textureStrength: item.effects.grain / 100,
      paintColor: item.accent,
      seed: 142 + item.variant,
      motion: 'none',
      lut: null,
    };
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const normalize = (text) =>
    String(text ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, ' ')
      .trim();
  const synonyms = {
    dark: 'oscuro',
    black: 'oscuro',
    negro: 'oscuro',
    paint: 'pintura',
    brush: 'pincel',
    title: 'titulo',
    background: 'fondo',
    photo: 'foto',
    image: 'imagen',
    sound: 'sonido',
    transition: 'transicion',
    short: 'breve',
    elegant: 'elegante',
    texture: 'textura',
    wave: 'onda',
    brand: 'marca',
    ad: 'anuncio',
    sale: 'oferta',
  };
  const canonical = (word) => synonyms[word] || word;
  function search(query = '', options = {}) {
    const noflash = /\b(sin destello|without flash|no flash)\b/.test(normalize(query));
    const terms = normalize(query)
      .replace(/\b(sin destello|without flash|no flash)\b/g, '')
      .split(' ')
      .filter(
        (w) =>
          w &&
          ![
            'con',
            'de',
            'para',
            'el',
            'la',
            'un',
            'una',
            'y',
            'with',
            'for',
            'the',
            'a',
            'and',
          ].includes(w),
      )
      .map(canonical);
    const type = typeof options === 'string' ? options : options.type;
    return catalog
      .filter((item) => !type || type === 'all' || item.type === type)
      .map((item) => {
        const hay = normalize([item.name, item.nameEn, ...item.tags].join(' '))
          .split(' ')
          .map(canonical);
        const score = terms.reduce(
          (n, t) => n + (hay.some((w) => w === t || w.startsWith(t)) ? 1 : 0),
          0,
        );
        return { item, score };
      })
      .filter(
        ({ item, score }) =>
          (!terms.length || score === terms.length) && (!noflash || item.tags.includes('noflash')),
      )
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
      .slice(
        Math.max(0, Math.min(300, Number(options.offset) || 0)),
        Math.max(0, Math.min(300, Number(options.offset) || 0)) +
          Math.max(1, Math.min(300, options.limit || 300)),
      )
      .map(({ item }) => item);
  }
  function get(id) {
    return byId.get(id && typeof id === 'object' ? id.id : String(id)) || null;
  }
  return {
    version,
    provenance,
    catalog,
    items: catalog,
    get,
    search,
    normalize,
    counts: () =>
      Object.fromEntries(
        ['background', 'element', 'style', 'title', 'transition', 'sound', 'recipe'].map((type) => [
          type,
          catalog.filter((i) => i.type === type).length,
        ]),
      ),
  };
});
