# Luma Studio

Estudio web para preparar y editar contenido social. Aplicación estática en español, sin instalación de dependencias de producción.

## Ejecutar

Requisitos: Node.js 20 o superior y un navegador moderno.

```sh
npm start
```

Abre http://127.0.0.1:4173. Puedes usar PORT para seleccionar otro puerto. No abras index.html como archivo: la biblioteca y el laboratorio necesitan un origen HTTP/HTTPS.

```sh
npm test
npm run check
```

## Funciones

- Proyectos para TikTok, Instagram, YouTube, Facebook, LinkedIn y Pinterest.
- Lienzos 9:16, 1:1, 16:9 y 4:5, con recorte centrado de la imagen/video.
- Importación y biblioteca persistente de imágenes, video y audio mediante IndexedDB.
- Texto superpuesto, color y fondo, tamaño y posición vertical, brillo y saturación.
- Recorte por inicio/final; vista previa del fragmento.
- Mezcla del audio original y una pista adicional con volúmenes independientes.
- Subtítulos SRT importables y editables; distribución de frases por duración y exportación SRT.
- Exportación PNG y video con texto, filtros, subtítulos y mezcla de audio incorporados.
- MP4 H.264/AAC cuando MediaRecorder lo admite; WebM como alternativa. Resoluciones de ancho 720 o 1080 px.
- Vista y descarga del resultado terminado; opción para guardarlo en la biblioteca.
- Deshacer/rehacer, duplicación, búsqueda y filtrado de proyectos.
- Calendario de planificación, descripción, hashtags, checklist y descarga de eventos .ics.
- Teleprompter con velocidad, tamaño, modo espejo y pantalla completa.
- Estructuras de guion por plantillas, notas y estimación del tiempo de lectura.
- Respaldos JSON portables que incluyen proyectos y archivos multimedia; importación que agrega copias sin sobrescribir los proyectos existentes.

## Código creativo

La sección Código creativo acepta JavaScript para Canvas 2D. El código recibe:

| Variable | Contenido |
| --- | --- |
| ctx | Contexto Canvas 2D |
| w, h | Dimensiones del lienzo |
| t | Tiempo transcurrido en segundos |

Ejemplo:

```js
ctx.fillStyle = '#151329';
ctx.fillRect(0, 0, w, h);
ctx.fillStyle = '#ffffff';
ctx.textAlign = 'center';
ctx.font = '800 ' + w * 0.08 + 'px sans-serif';
ctx.fillText('Tu próxima historia', w / 2, h / 2 + Math.sin(t) * 20);
```

Incluye plantillas de título animado, contador de lanzamiento y tarjeta de carrusel. Permite importar/exportar .js, capturar PNG y grabar clips de hasta 30 segundos. Los resultados pueden descargarse o añadirse a la biblioteca para usarlos en el editor.

El JavaScript se ejecuta en un worker de un iframe sandbox sin allow-same-origin. La política CSP bloquea red, formularios y recursos externos. Un watchdog termina el worker si tarda más de dos segundos en devolver un cuadro. El código no tiene acceso al DOM de la app, sus proyectos ni credenciales. El laboratorio es para gráficos de Canvas; no instala paquetes ni modifica el código fuente de la aplicación.

## Almacenamiento

Los archivos permanecen en IndexedDB; los proyectos y notas, en localStorage. No hay cuenta, sincronización entre dispositivos ni servidor de almacenamiento. Borrar datos del navegador elimina ese trabajo: usa Respaldo completo antes. Los respaldos de v2 incorporan multimedia y se agregan al importarlos; los JSON de v1 solo conservan ajustes.

Límites: 120 segundos por video del editor; 30 segundos por animación del laboratorio; máximo aproximado de 180 MB de recursos por respaldo, 250 MB para importar un JSON. Son límites de memoria del navegador, no cuotas de una cuenta. El espacio disponible depende del navegador.

## Exportación

El video se procesa en tiempo real. Mantén la pestaña visible: al ocultarla se cancela para evitar archivos con cuadros perdidos. El rendimiento y los códecs dependen del dispositivo y navegador. Usa el MP4 final para publicación cuando esté disponible. Comprueba el archivo exportado antes de publicarlo.

El recorte usa segundos del archivo original. Los tiempos SRT empiezan en 0 al comienzo del fragmento exportado. Los filtros y subtítulos quedan incorporados al video. La vista previa de imagen es estática; al exportar se convierte en un clip de la duración configurada.

## Alcance actual

No publica automáticamente en redes, no conecta cuentas sociales, no transcribe voz automáticamente ni llama a servicios de IA. Los guiones son plantillas. El editor compone un archivo visual con una pista de audio adicional; no incluye montaje multipista con transiciones, keyframes o renderizado en servidor.

## Estructura

- dist/index.html: estructura y navegación.
- dist/style.css: interfaz adaptable.
- dist/app.js: proyectos, biblioteca, calendario y guiones base.
- dist/core.js: validación de proyectos, SRT y metadatos WebM.
- dist/studio.js: editor, render, respaldos, herramientas y laboratorio.
- server.cjs: servidor local sin dependencias.
- tests/core.test.cjs: validación de subtítulos, normalización, dimensiones y metadatos.

Sirve dist/ en cualquier hosting estático HTTPS. El servidor de desarrollo escucha solo en 127.0.0.1. No se requieren claves API ni secretos.

