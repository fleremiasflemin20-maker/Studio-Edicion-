# Fleremahias Studio · Creator Workspace

Estudio web en español para crear contenido social. El editor base funciona localmente. Las herramientas de reconocimiento descargan modelos públicos bajo demanda; el servicio complementario tiene sus propias dependencias y configuración.

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
- Animaciones de capas: aparecer, subir, pop, flotar, rebote, giro, pulso y escritura.
- 24 filtros de imagen/video, incluyendo: Original, Cine, Cálido, Frío, Blanco y negro, Vintage, Vibrante, Suave, Nocturno, Atardecer, Mate y Noir.
- SRT importable, editable, distribuible por frases y exportable; ocho estilos visuales.
- Vista previa y exportación comparten el compositor de Canvas.
- Deshacer/rehacer, duplicación y checklist.

La imagen del medio se filtra antes de dibujar las capas: los textos y stickers mantienen sus colores.

## Música y audio

Ocho bases sintetizadas por Fleremahias: Lo-fi café, Vlog luminoso, Focus ambiental, House suave, Pulso urbano, Cine inspirador, Día soleado y Minimal tech. Se generan como WAV PCM localmente, pueden escucharse antes de añadirlas y quedan en la biblioteca. No se descargan canciones ni catálogos de terceros.

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

El código se ejecuta en un worker dentro de un iframe sandbox sin allow-same-origin. CSP bloquea red, recursos externos y formularios. Un watchdog termina un worker que no devuelve un cuadro en dos segundos. El laboratorio no modifica el código fuente de Fleremahias ni accede a los proyectos.

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

Incluye transcripción local opcional en v5, videos superpuestos y audio adicional. No incluye IA generativa de video, colaboración multiusuario en nube, títulos 3D ni chroma key. Las escenas principales son secuenciales; las pistas visuales adicionales pertenecen a cada escena.

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

Los patrones de biblioteca/inspector, selección directa y modo Fácil/Pro se adaptaron a edición social tras estudiar Encaja Studio. La implementación es propia de Fleremahias; no incorpora código o recursos del repositorio privado de Encaja.

## Novedades de la versión 4

El botón «Listo en un clic» reúne 16 estilos de texto, 12 composiciones editables, 24 filtros en total, ajustes de imagen, fondos, movimientos y exportación de imágenes. Puedes cortar escenas, cambiar la velocidad de videos, guardar elementos favoritos y montar un Reel con una duración por clip calculada a partir de un BPM que introduces tú.

Los subtítulos pueden importarse como SRT o distribuirse a partir de un guion. En v4 no se transcribía la voz; v5 incorpora un modelo local opcional. La revisión previa señala archivos ausentes, tiempos inválidos, textos pendientes y problemas básicos de contraste. La publicación rápida prepara archivos y textos: no publica automáticamente en cuentas sociales sin sus respectivas integraciones autorizadas.

El compositor compartido se encuentra en `dist/compositor.js`; la lógica pura de las herramientas, en `dist/pro-core.js`, y su interfaz, en `dist/pro-editor.js`. Las pruebas cubren cortes, velocidad, tiempos, normalización, revisión y catálogos, además de las funciones existentes.

## GitHub Pages

La acción `.github/workflows/pages.yml` verifica el código y publica `dist/` cuando se actualiza la rama `codex/luma-studio`. El sitio usa rutas relativas para funcionar en `/Studio-Edicion-/`.

Los proyectos y archivos se guardan localmente en el navegador por origen. El sitio anterior y GitHub Pages tienen almacenamientos separados: utiliza el respaldo para trasladar tus proyectos y medios.

## Novedades de la versión 5

Crear mi contenido reúne diez paneles conectados al proyecto:

- Montaje por objetivo: tutorial, producto, podcast, vlog o anuncio; archivos elegidos en orden, formato y guion opcional. Las plantillas son reglas editables, no generación semántica por IA.
- Grabación de cámara/micrófono, pantalla con el audio que permita el navegador o solo micrófono. Cuenta atrás y teleprompter; la toma se guarda en IndexedDB. Necesita HTTPS y permiso del dispositivo; no se han ejercitado los dispositivos personales durante las pruebas.
- Transcripción local con Transformers.js 3.8.1 y Whisper tiny; descarga inicial y tiempos por palabra. Cancelación mediante worker. Importación alternativa de palabras JSON. Probada con voz sintética en inglés; nombres, español, acentos y condiciones acústicas requieren revisión.
- Corrección por grupos de palabras, selección de frases para un montaje nuevo, candidatos de clips por duración/puntuación y resaltado de posibles muletillas. No se promete comprensión narrativa ni viralidad.
- Detección de pausas por RMS y golpes musicales por picos de energía. Los cortes propuestos se revisan antes de aplicar. El seguimiento facial usa MediaPipe 0.10.21 y guarda encuadres muestreados; descarga de recursos verificada, pendiente de comprobar con grabaciones de personas.
- Mejora de voz mediante filtros, compresión, atenuación de señal débil y normalización. No separa música ni elimina todo el ruido con IA.
- Videos superpuestos temporizados, imágenes y hasta 12 pistas adicionales de audio con inicio, final, posición de origen y volumen. El montaje exportado mezcla estas pistas. La vista previa de montaje completo usa la mezcla; el botón de reproducción de una sola escena mantiene la reproducción básica.
- Tiradores de tamaño y giro, selección con Shift, agrupación, movimiento conjunto y alineación de capas. Diseños de reacción y superposición en media pantalla.
- Tres portadas PNG desde el fotograma actual, recetas visuales guardables, zonas seguras conservadoras y tres variantes editables. Las zonas deben revisarse porque las interfaces de las redes cambian.
- Tabla CSV/TSV con vista previa y hasta 50 proyectos independientes. Los nombres de imágenes se resuelven contra la biblioteca; se validan todas las filas antes de crear proyectos.
- Versiones locales (hasta ocho), notas con segundo del montaje, restauración en copia y comparación visual de los dos últimos videos de la biblioteca. No es colaboración remota en tiempo real.
- Cola local persistente con reintento y comprobación de cambios, más interfaz para el servicio de render/publicación. El render local necesita la pestaña visible.

`dist/flow-core.js` contiene operaciones puras; `dist/flow-media.js` administra audio, video y modelos; `dist/flow.js` contiene el controlador. `dist/asr-worker.js` aísla la transcripción. Se conserva el compositor compartido de la versión anterior.

### Servicio opcional y funciones pendientes de activación

[backend/README.md](backend/README.md) explica el servicio de un propietario: render de proyectos mediante el editor incluido, subida privada/pública a YouTube según elección y envío de borradores a TikTok. Tiene trabajos persistentes, fechas UTC, cifrado de tokens, autenticación, CORS, OAuth e idempotencia. El servicio Cloudflare está desplegado y el render remoto está probado; todavía no se han autorizado cuentas sociales.

Los trabajos con Fleremahias cerrado se ejecutan con Workers, R2 y Browser Run en Cloudflare. Para activar cuentas se necesitan las aplicaciones y permisos de cada plataforma. Instagram, Facebook, LinkedIn, analítica por cuenta, detección semántica de momentos, denoise neuronal y colaboración multiusuario siguen pendientes. La interfaz no presenta estas conexiones como activas.

Los modelos de voz y detección se descargan desde Hugging Face, jsDelivr y Google. El reconocimiento se realiza en el dispositivo; no se transmite la grabación a esos proveedores para inferencia. La primera carga depende de red y memoria disponible.

## Despliegue elegido: Cloudflare

La carpeta cloudflare/ contiene la versión para Workers, R2, Durable Objects y Browser Run. Consulta [cloudflare/README.md](cloudflare/README.md). Compila con Wrangler y tiene pruebas propias. Esta opción no necesita un servidor Node encendido. El servicio de backend/ se conserva como alternativa autohospedada; no es el servicio que se desplegará en tu cuenta Cloudflare.

La interfaz pública sigue en Pages y Sites. La cuenta fue autorizada por el propietario, quien también activó R2. El estudio abre públicamente y permite descargar contenido local sin token. La API y los archivos del servidor requieren el token privado del servicio.

## Enlaces y estado final

- Estudio público Cloudflare: https://fleremahias-studio.analista-datos-pro.workers.dev/
- GitHub Pages: https://fleremiasflemin20-maker.github.io/Studio-Edicion-/
- Sites: https://luma-social-studio-251026.keenox19.chatgpt.site

La interfaz pública funciona sin iniciar sesión. La exportación local pertenece al visitante y se descarga en su equipo. No hay una galería pública de archivos privados ni publicación automática de todos los proyectos. El acceso a la API de render, R2 y cuentas sociales sigue protegido.

## Diseño Graphite y propuesta Pro

La interfaz ahora usa grafito, superficies oscuras y acentos del arcoíris con pinceladas originales, manteniendo los colores originales del lienzo y las muestras. El botón **Planes** presenta Gratis / Pro / Pro Plus como propuesta, con cobro desactivado. La edición y descarga local siguen abiertas. Consulta [MONETIZACION.md](MONETIZACION.md) para precios propuestos, cálculo de contribución, fuentes y requisitos multiusuario antes de vender.

La base `cloudflare/billing.mjs` está probada pero no conectada al Worker; aún faltan identidad, aislamiento por cliente, checkout, almacenamiento de suscripciones, webhooks e imposición transaccional de cuotas. No se anuncian como servicios ya activos.

## Identidad del estudio

Marca pública: **Fleremahias Studio**, firma **by fleremiasflemin**. Incluye monograma FM propio, favicon y nombres de descarga actualizados. Las claves internas, identificadores de respaldo y direcciones existentes conservan compatibilidad para mantener proyectos guardados y enlaces funcionando.

## Guía viva para creadores

En la primera visita se abre una bienvenida con manual y recorrido. El botón **Guía y ayuda** está siempre en la cabecera; los paneles de creación, estilos y formularios incluyen **Ayuda de esta sección**. El manual tiene 29 capítulos, buscador, instrucciones paso a paso y explicación de controles. El recorrido resalta los elementos reales y permite avanzar, volver y consultar su capítulo. **Explicar controles** intercepta el clic para explicar el control sin ejecutar su acción; Escape permite salir. Las animaciones respetan la preferencia de movimiento reducido.

La bienvenida se recuerda por navegador mediante una clave independiente de los proyectos. Borrar los datos del navegador o usar otro dispositivo vuelve a mostrarla. El recorrido no crea proyectos ni inicia grabaciones, exportaciones o publicaciones. La documentación distingue exportación local, acceso privado al servicio, OAuth y planes aún en preparación. Se mantiene en `dist/help-content.js`; el controlador está en `dist/help.js` y su diseño en `dist/help.css`.

## Tablero creativo y modo enfoque

La barra de modos abre un tablero local de hasta 120 tarjetas o la edición ampliada de una pieza. Permite arrastrar proyectos, herramientas y medios; añadir notas y zonas; desplazar y ampliar la vista; ordenar, ajustar y deshacer acciones. Soltar Cine, Vibrante u Original sobre un proyecto cambia sus filtros; Título editorial añade una capa. Las herramientas de voz, audio, portadas y exportación abren sus recorridos sin ejecutar procesos automáticamente.

Los archivos soltados desde el equipo o importados estando en el tablero se guardan como recursos, sin reemplazar la escena del proyecto abierto. Arrastrar un medio sobre una tarjeta de proyecto lo añade como escena o música. Las zonas mueven también las tarjetas completamente contenidas. Hay botones equivalentes al arrastre y movimiento de tarjetas con flechas. El respaldo completo incluye organización, proyectos y medios; restaurar remapea sus referencias y agrega las tarjetas al tablero actual.

La guía incluye ahora 29 capítulos con las instrucciones del tablero. La implementación independiente y las referencias están documentadas en [TABLERO-ARQUITECTURA.md](TABLERO-ARQUITECTURA.md). Encaja se consultó únicamente como referencia; no se modificó ni se incorporó su código privado.

## Composición Pro

El editor incorpora **Composición Pro**: alineación por bordes/centros con referencia a lienzo o selección, distribución de espacios, organización en fila/columna/cuadrícula, copiar y pegar formato visual, biblioteca de bloques personales multicapa, copias adaptadas a formatos sociales y numeración editable de carruseles. Se abre desde la barra del editor o Ctrl/⌘ + K fuera de campos de texto.

Las operaciones trabajan sobre el modelo exportado y respetan capas bloqueadas u ocultas. Auto organizar es una acción puntual, sin reglas permanentes de Auto Layout. Los bloques son copias independientes, no componentes vinculados. La adaptación conserva el original y requiere revisar textos y recorte; no se anuncia como reencuadre semántico por IA. Los bloques y sus medios se incluyen en los respaldos completos. La guía incluye ahora 29 capítulos.

La investigación y decisiones están en [COMPOSICION-PRO.md](COMPOSICION-PRO.md). La lógica pura está en `dist/design-core.js`; el controlador y la vista previa comparten el compositor existente. No se incluyen código, plantillas, iconos ni recursos descargados de Figma o Canva.

## Español e inglés

Al entrar por primera vez aparece la elección **Español / English**. El botón permanente **ES / EN** permite cambiar de idioma. La elección se conserva en este navegador, sin necesidad de cuenta.

La interfaz, los paneles, la guía completa de 29 capítulos, los recorridos, las instrucciones de controles y los mensajes disponen de inglés. La búsqueda de ayuda reconoce términos ingleses. Los nombres y textos del creador, los medios y las claves de CSV/código se conservan. Las plantillas nuevas y los guiones de estructura usan el idioma elegido; cambiar el idioma no reescribe proyectos existentes.

La localización se resuelve localmente mediante `dist/i18n-catalog.js`, sin servicios de traducción ni dependencias nuevas. `dist/i18n-core.js` contiene traducción pura y formatos dinámicos; `dist/i18n.js` adapta los elementos de interfaz que generan los módulos existentes. Los valores de opciones, IDs, eventos y estados internos permanecen estables. Añade textos nuevos al catálogo y ejecuta `npm test`, que comprueba también la cobertura de todos los capítulos de ayuda.

## Motion 2D y 3D (React + Remotion)

Ejecuta `npm ci` y `npm run build` para reconstruir el motor desde `src/motion/`. El bundle se sirve localmente en `dist/motion/`; no necesita un servicio de render externo.

- Seis composiciones propias: tres 2D y tres escenas 3D reales con Three.js.
- Textos, colores, formato, duración, FPS y música sintetizada original editables.
- Ejemplo React/TSX editable con importaciones limitadas; se ejecuta en un iframe de origen aislado, sin acceso al almacenamiento del estudio ni conexiones arbitrarias.
- Vista previa, exportación PNG y vídeo MP4/WebM cuando el navegador admite sus códecs, cancelación, descarga, biblioteca y reutilización en un proyecto abierto.
- Proyecto Motion JSON portable; el respaldo general conserva el borrador Motion actual.
- Opciones 720/1080/2160 y 24/30/60 FPS. La disponibilidad y velocidad dependen de GPU, memoria, WebGL y WebCodecs. Se verificaron archivos cortos 720×1280/30 y 2160×3840/60; no es garantía universal de rendimiento.

Remotion se configura con `free-license`: el propietario confirmó que trabaja solo. Su licencia comercial gratuita cubre empresas de hasta tres personas; revisar las condiciones al crecer. El SDK registra un evento técnico de render en remotion.pro; no se envían texto, código ni archivos del proyecto. Se incluyen la licencia y avisos de terceros en `dist/motion/`. Referencias: https://www.remotion.pro/license y https://www.remotion.dev/docs/client-side-rendering.

Esta integración no incluye una cuenta de Claude ni generación de vídeo mediante una IA externa. El código React puede escribirse o pegarse en el panel y revisarse antes de ejecutarlo. El aislamiento protege los datos del estudio; código propio que consuma CPU excesiva puede bloquear su vista previa.
