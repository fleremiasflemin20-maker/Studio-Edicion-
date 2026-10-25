# Luma Studio · Creator Workspace

Estudio web en español para crear contenido social. Sin dependencias de producción ni claves API.

## Ejecutar y comprobar

Necesitas Node.js 20 o superior y un navegador moderno.

```sh
npm start
npm test
npm run check
```

Abre http://127.0.0.1:4173. Usa PORT para elegir otro puerto. El servidor local escucha solo en 127.0.0.1. En producción, sirve dist/ mediante HTTPS.

## Crear contenido

1. Elige una de las ocho plantillas sociales o crea un lienzo en blanco.
2. Importa tus videos, fotos o audio.
3. Arrastra medios desde la biblioteca al lienzo para sustituir el fondo, o a la secuencia para añadir escenas.
4. Arrastra las escenas para ordenar el montaje; las flechas ofrecen una alternativa accesible.
5. Añade textos, formas, stickers o imágenes como capas. Selecciónalos en el lienzo y muévelos directamente. El inspector permite ajustar tamaño, posición, color, giro, opacidad, animación y bloqueo.
6. Añade música y prepara subtítulos SRT.
7. Reproduce el montaje completo y exporta el video final, una captura PNG o un carrusel ZIP.

Los modos Fácil/Pro cambian la cantidad de controles visibles y conservan el proyecto. El movimiento de textos usa ajuste a las guías centrales y márgenes. Con el lienzo enfocado, las flechas mueven la selección; Shift aumenta el paso y Suprimir elimina una capa adicional.

## Edición y composición

- Hasta 24 escenas y 40 capas por escena.
- Formatos 9:16, 1:1, 16:9 y 4:5.
- Recorte por tiempo, encuadre, ajuste completo o con recorte, y zoom.
- Entradas entre escenas: corte, fundido, deslizamiento y acercamiento.
- Texto principal y capas de texto, formas, stickers e imagen.
- Animaciones de capas: aparecer, subir, pop y flotar.
- Doce filtros de imagen/video: Original, Cine, Cálido, Frío, Blanco y negro, Vintage, Vibrante, Suave, Nocturno, Atardecer, Mate y Noir.
- SRT importable, editable, distribuible por frases y exportable; tres estilos visuales.
- Vista previa y exportación comparten el compositor de Canvas.
- Deshacer/rehacer, duplicación y checklist.

La imagen del medio se filtra antes de dibujar las capas: los textos y stickers mantienen sus colores.

## Música y audio

Ocho bases sintetizadas por Luma: Lo-fi café, Vlog luminoso, Focus ambiental, House suave, Pulso urbano, Cine inspirador, Día soleado y Minimal tech. Se generan como WAV PCM localmente, pueden escucharse antes de añadirlas y quedan en la biblioteca. No se descargan canciones ni catálogos de terceros.

Puedes importar tu propia música o voz. El montaje mezcla el audio de los videos y una pista adicional, con volúmenes independientes, bucle musical, atenuación musical según el nivel del audio original y compresión de picos.

## Publicación rápida

La automatización disponible prepara el contenido; no simula publicaciones remotas.

- Crea copias independientes para TikTok, Reels, Shorts, carruseles de Instagram y posts de Facebook/LinkedIn.
- Adapta el formato y rellena descripciones con las variables titulo, marca, cta y hashtags del kit de marca.
- Prepara varias tareas en un lote: renderiza videos o imágenes y conserva los archivos finales en la biblioteca.
- Marca como pendiente una tarea preparada si cambias su montaje.
- Descarga un ZIP por tarea o un paquete completo con archivos finales, descripciones y plan CSV.
- Descarga un calendario ICS con avisos de preparación.
- Copia el texto, abre la red y comparte los archivos mediante el menú del dispositivo si el navegador admite Web Share.

**La publicación directa y la programación en servidores de TikTok, Meta, YouTube u otras redes no están conectadas.** Requieren sus aplicaciones OAuth, permisos y cuentas. Las fechas de la cola son planificación local; el navegador cerrado no ejecuta trabajos. El botón de confirmación de subida registra una acción manual del usuario, no una respuesta de una plataforma.

## Código creativo y herramientas

El laboratorio recibe JavaScript para Canvas 2D con las variables ctx, w, h y t. Ofrece plantillas, vista previa, importación/exportación .js, capturas PNG y clips de hasta 30 segundos que se pueden incorporar al editor.

El código se ejecuta en un worker dentro de un iframe sandbox sin allow-same-origin. CSP bloquea red, recursos externos y formularios. Un watchdog termina un worker que no devuelve un cuadro en dos segundos. El laboratorio no modifica el código fuente de Luma ni accede a los proyectos.

También incluye teleprompter con velocidad, tamaño, espejo y pantalla completa; guiones por plantillas; notas; estimación de lectura; calendario y checklist.

## Almacenamiento y respaldos

Los medios se guardan en IndexedDB y los proyectos, notas y cola en localStorage. El kit de marca conserva colores, CTA y hashtags. No hay sincronización en la nube. Guarda respaldos antes de borrar los datos del navegador.

Los respaldos portables incluyen las escenas, capas, imágenes, videos, audio, tareas relacionadas y kit de marca. La importación crea identificadores nuevos y remapea las referencias sin sobrescribir proyectos existentes. Los JSON antiguos siguen admitiéndose.

El espacio disponible depende del navegador. El límite aproximado es de 180 MB de recursos por respaldo y 250 MB por archivo JSON importado.

## Exportación y límites

- Máximo 120 segundos de duración total por montaje.
- Video con ancho de 720 o 1080 píxeles, según la calidad elegida.
- MP4 H.264/AAC si MediaRecorder lo admite; WebM como alternativa.
- El procesamiento ocurre en tiempo real. Mantén la pestaña visible: ocultarla cancela la exportación para evitar archivos incompletos.
- Carruseles: PNG por escena, a 1080 píxeles de ancho, en orden.
- Los tiempos SRT son relativos al inicio de cada escena.
- Revisa el archivo terminado antes de subirlo a una red.

No incluye transcripción automática, IA generativa, colaboración en la nube, títulos 3D, chroma key ni montaje con pistas visuales independientes solapadas en el tiempo. Las escenas son secuenciales; las capas pertenecen a cada escena.

## Estructura

- dist/app.js: proyectos, biblioteca y funciones base.
- dist/studio.js: laboratorio de código y herramientas v2.
- dist/core.js: SRT, normalización base y metadatos WebM.
- dist/creator-core.js: escenas, capas, filtros, síntesis musical y ZIP.
- dist/creator.js: biblioteca, inspector, modo Fácil/Pro y arrastrar/soltar.
- dist/creator-render.js: compositor, secuencia, audio y exportación.
- dist/creator-workflows.js: plantillas, kit de marca, cola, variantes y paquetes.
- tests/: pruebas de normalización, referencias, subtítulos, audio y archivos.
- scripts/check.cjs: comprobación de sintaxis de todos los módulos.
- .github/workflows/check.yml: comprobaciones automáticas del repositorio.

Los patrones de biblioteca/inspector, selección directa y modo Fácil/Pro se adaptaron a edición social tras estudiar Encaja Studio. La implementación es propia de Luma; no incorpora código o recursos del repositorio privado de Encaja.

