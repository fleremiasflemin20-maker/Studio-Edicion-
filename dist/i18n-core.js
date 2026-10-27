(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FleremahiasLocaleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = (text) =>
    String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  function create(catalog = {}) {
    const entries = new Map(Object.entries(catalog).map(([k, v]) => [normalize(k), v]));
    function translate(value, locale = 'es') {
      const input = String(value ?? '');
      if (locale !== 'en') return input;
      const text = normalize(input);
      if (entries.has(text)) return entries.get(text);
      // Icons are presentation, not translation keys. Never rewrite arbitrary substrings.
      const icon = text.match(/^([^\p{L}\p{N}{]+\s*)(.+)$/u);
      if (icon && entries.has(normalize(icon[2]))) return icon[1] + entries.get(normalize(icon[2]));
      const arrow = text.match(/^(.+?)(\s*[↗↥↓←→＋✦]+)$/u);
      if (arrow && entries.has(normalize(arrow[1])))
        return entries.get(normalize(arrow[1])) + arrow[2];
      if (icon && arrow) {
        const inner = text
          .slice(icon[1].length)
          .replace(/\s*[↗↥↓←→＋✦]+$/u, '')
          .trim();
        if (entries.has(inner)) return icon[1] + entries.get(inner) + arrow[2];
      }
      const monthNames = {
        enero: 'January',
        febrero: 'February',
        marzo: 'March',
        abril: 'April',
        mayo: 'May',
        junio: 'June',
        julio: 'July',
        agosto: 'August',
        septiembre: 'September',
        octubre: 'October',
        noviembre: 'November',
        diciembre: 'December',
      };
      const fullDate = text.match(/^(\d{1,2}) de (\w+) de (\d{4})$/);
      if (fullDate && monthNames[fullDate[2]])
        return monthNames[fullDate[2]] + ' ' + fullDate[1] + ', ' + fullDate[3];
      const monthYear = text.match(/^(\w+) de (\d{4})$/);
      if (monthYear && monthNames[monthYear[1]])
        return monthNames[monthYear[1]] + ' ' + monthYear[2];
      const sceneCount = text.match(/^(\d+) escenas · ([\d.]+) s$/);
      if (sceneCount)
        return (
          sceneCount[1] +
          (sceneCount[1] === '1' ? ' scene · ' : ' scenes · ') +
          sceneCount[2] +
          ' s'
        );
      const transition = text.match(/^([\d.]+ s) · (Corte|Fundido|Deslizar|Acercar)$/);
      if (transition) return transition[1] + ' · ' + translate(transition[2], locale);
      if (text.startsWith('Escena ')) return 'Scene ' + translate(text.slice(7), locale);
      const targetFormat = text.match(
        /^(.*) (9:16|1:1|16:9|4:5) · (todas las escenas PNG|primera escena PNG|montaje completo)$/,
      );
      if (targetFormat)
        return (
          translate(targetFormat[1], locale) +
          ' ' +
          targetFormat[2] +
          ' · ' +
          translate(targetFormat[3], locale)
        );
      const genericSceneCount = text.match(/^(\d+) escenas · (.+)$/);
      if (genericSceneCount)
        return (
          genericSceneCount[1] +
          (genericSceneCount[1] === '1' ? ' scene · ' : ' scenes · ') +
          genericSceneCount[2]
        );
      const layerCount = text.match(/^(\d+) capas seleccionadas$/);
      if (layerCount)
        return layerCount[1] + (layerCount[1] === '1' ? ' layer selected' : ' layers selected');
      const sceneSummary = text.match(/^([\d.]+ s) · (\d+) escenas$/);
      if (sceneSummary)
        return (
          sceneSummary[1] +
          ' · ' +
          sceneSummary[2] +
          (sceneSummary[2] === '1' ? ' scene' : ' scenes')
        );
      const patterns = [
        [/^Falta el archivo de (.+)$/, 'Missing media for $1'],
        [/^Revisa el recorte de (.+)$/, 'Review the trim range for $1'],
        [/^Recorte no válido en (.+)$/, 'Invalid trim range in $1'],
        [/^Imagen no compatible en (.+)$/, 'Unsupported image in $1'],
        [/^Selecciona una imagen o video en (.+)$/, 'Select an image or video in $1'],
        [
          /^(.+) aplicado\. Puedes deshacer desde el tablero\.$/,
          '$1 applied. You can undo this from the board.',
        ],
        [/^(.+) escenas · (.+)$/, '$1 scenes · $2'],
        [/^(.+) listas para subir · (.+)$/, '$1 ready to upload · $2'],
        [/^(.+) preparadas · (.+)$/, '$1 prepared · $2'],
        [/^Paquete listo · (.+)$/, 'Package ready · $1'],
        [/^Video terminado · (.+)$/, 'Video complete · $1'],
        [/^Duraciones ajustadas a (.+) BPM\.$/, 'Durations matched to $1 BPM.'],
        [/^Montaje creado con (.+)$/, 'Sequence created with $1'],
        [/^(\d+) piezas · primeras 8 filas$/, '$1 projects · first 8 rows'],

        [/^(\d+) escenas$/, '$1 scenes'],
        [/^(\d+) escena$/, '$1 scene'],
        [/^(\d+) capas editables$/, '$1 editable layers'],
        [
          /^(\d+) preparadas · (\d+) listas para subir · (\d+) tareas$/,
          '$1 prepared · $2 ready to upload · $3 tasks',
        ],
        [
          /^(\d+) versiones creadas sin cambiar el proyecto de origen\.$/,
          '$1 versions created without changing the source project.',
        ],
        [
          /^(\d+) proyectos restaurados con sus archivos\.$/,
          '$1 projects restored with their media.',
        ],
        [
          /^(\d+) frases con posibles muletillas\. Revisa antes de cortar\.$/,
          '$1 phrases with possible fillers. Review before cutting.',
        ],
        [/^Grabación en (.+)$/, 'Recording in $1'],
        [/^Tiempo SRT no válido en el bloque (.+)$/, 'Invalid SRT time in block $1'],
        [/^Intervalo no válido en bloque (.+)$/, 'Invalid time range in block $1'],
        [/^No se pudo reproducir: (.+)$/, 'Unable to play: $1'],
        [/^No se pudo exportar: (.+)$/, 'Unable to export: $1'],
        [/^Exportación: (.+)$/, 'Export: $1'],
        [/^(.+)% · mantén esta pestaña visible$/, '$1% · keep this tab visible'],
        [/^(.+): el recorte no tiene duración\.$/, '$1: trim range has no duration.'],
        [/^(.+): revisa los tiempos SRT\.$/, '$1: review SRT timing.'],
        [
          /^(.+): hay capas con tiempos fuera del fragmento\.$/,
          '$1: some layers extend beyond the clip.',
        ],
        [/^(.+): todavía hay texto de ejemplo\.$/, '$1: placeholder text is still present.'],
        [
          /^(.+): el título tiene poco contraste con el fondo\.$/,
          '$1: title contrast against the background is low.',
        ],
        [/^Forma de onda de (.+)$/, 'Waveform for $1'],
        [
          /^(\d+) palabras · aproximadamente (.+) segundos a 140 palabras por minuto\.$/,
          '$1 words · about $2 seconds at 140 words per minute.',
        ],
        [/^Servicio conectado · (.+)$/, 'Service connected · $1'],
        [/^Seguimiento guardado: (.+)$/, 'Tracking saved: $1'],
        [/^Solicitud registrada: (.+)$/, 'Request registered: $1'],
        [/^(.+) MB · máximo (.+) MB por archivo$/, '$1 MB · maximum $2 MB per file'],
        [
          /^Este control pertenece a (.+)\. Abre las instrucciones de la sección para consultar sus pasos y controles\.$/,
          'This control belongs to $1. Open section help for steps and controls.',
        ],
        [
          /^Marca o desmarca «(.+)» para incluir o excluir esta opción en (.+)\. En este modo de ayuda la selección no cambia\.$/,
          'Check or uncheck “$1” to include or exclude this option in $2. Help mode does not change the selection.',
        ],
        [
          /^Elige el valor de «(.+)»\. Las opciones disponibles son: (.+)\. Consulta el capítulo para ver cómo se usa en el flujo\.$/,
          'Choose a value for “$1”. Available options: $2. See the chapter for workflow instructions.',
        ],

        [/^(\d+) escenas · ([\d.]+) s$/, '$1 scenes · $2 s'],
        [/^(\d+) capas seleccionadas$/, '$1 layers selected'],
        [/^(\d+) capas · local$/, '$1 layers · local'],
        [/^(\d+) caracteres$/, '$1 characters'],
        [
          /^(\d+) bloques válidos · tiempos relativos al fragmento\.$/,
          '$1 valid blocks · times relative to the clip.',
        ],
        [
          /^(\d+) tarjetas · Retirar una tarjeta no elimina el proyecto ni sus archivos\.$/,
          '$1 cards · Removing a card does not delete its project or files.',
        ],
        [/^Escena (\d+)$/, 'Scene $1'],
        [/^Mover escena (\d+) a la izquierda$/, 'Move scene $1 left'],
        [/^Mover escena (\d+) a la derecha$/, 'Move scene $1 right'],
        [/^Añadir (.+) al tablero$/, 'Add $1 to board'],
        [/^Retirar tarjeta (.+)$/, 'Remove card $1'],
        [
          /^(\d+) archivos añadidos al tablero y biblioteca\.$/,
          '$1 files added to board and library.',
        ],
        [/^(\d+) proyectos creados$/, '$1 projects created'],
        [
          /^(\d+) proyectos adaptados\. Ábrelos desde Mis proyectos o el tablero\.$/,
          '$1 adapted projects. Open them in My projects or the board.',
        ],
        [/^Montaje terminado · (.+)$/, 'Sequence complete · $1'],
        [/^Preparando (\d+)\/(\d+)$/, 'Preparing $1/$2'],
        [/^Exportando (.+)$/, 'Exporting $1'],
        [/^Subiendo (.+)$/, 'Uploading $1'],
        [/^Muestra las herramientas de (.+)$/, 'Show tools for $1'],
        [/^Portada (\d+)$/, 'Cover $1'],
        [/^(\d+) tareas preparadas(.*)$/, '$1 tasks prepared$2'],
        [/^Borrador · (.+)$/, 'Draft · $1'],
        [/^Listo · (.+)$/, 'Ready · $1'],
        [/^Preparado · (.+)$/, 'Prepared · $1'],
      ];
      for (const [pattern, replacement] of patterns)
        if (pattern.test(text)) return text.replace(pattern, replacement);
      if (arrow) {
        const nested = translate(arrow[1], locale);
        if (nested !== arrow[1]) return nested + arrow[2];
      }
      if (icon) {
        const nested = translate(icon[2], locale);
        if (nested !== icon[2]) return icon[1] + nested;
      }
      return input;
    }
    return { translate, normalize };
  }
  return { create, normalize };
});
