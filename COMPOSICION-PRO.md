# Composición Pro · investigación e implementación propia

## Selección de funciones

Se revisaron las herramientas existentes antes de añadir controles. El estudio ya tiene filtros, marca local, estilos de texto, grabación, voz y texto, audio, variantes, calendario, tabla CSV y bloques preparados. Esta entrega prioriza composición y reutilización, en lugar de duplicar esas herramientas.

| Referencia funcional                     | Implementación para contenido social                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Figma: alineación y distribución         | Seis alineaciones; referencia al lienzo con margen o a la selección; espaciado uniforme de tres o más capas |
| Figma: organización de grupos            | Auto organizar en fila, columna o cuadrícula con espaciado y reducción para encajar                         |
| Figma: propiedades reutilizables         | Copiar y pegar formato sin sustituir texto, archivo, posición ni tiempos                                    |
| Figma: componentes                       | Bloques personales de varias capas, con copias agrupadas y nuevas identidades                               |
| Canva: redimensionar y adaptar contenido | Copias editables 9:16, 1:1, 4:5 y 16:9 con márgenes y ajuste tipográfico                                    |
| Creación social por páginas              | Numeración editable de escenas para carruseles                                                              |

La implementación es propia. No se copió código, identidad visual ni recursos de las referencias. Auto organizar no es un motor permanente de Auto Layout. Los bloques no se vinculan a una instancia maestra ni se sincronizan en nube. No se promete reencuadre por IA: el sujeto y los textos se revisan manualmente en cada copia.

## Diseño técnico

`design-core.js` agrupa operaciones puras. El controlador `design-editor.js` usa selección explícita de capas, respeta bloqueos y visibilidad y registra cambios en el historial del proyecto. La alineación usa medidas del compositor cuando están disponibles; otras capas usan sus cajas declaradas. Las capas giradas y el texto largo requieren revisión visual.

La vista previa usa el mismo compositor que PNG y video, con actualización limitada a unos cuatro cuadros por segundo mientras el panel esté abierto. Se cierra el ciclo al salir. Copiar estilo usa una lista permitida de propiedades visuales y no copia IDs, medios, textos, grupos ni tiempos.

Se conservan hasta doce bloques locales y cuarenta capas por escena. Insertar valida que sus medios estén disponibles y genera IDs y grupo nuevos. Los respaldos incluyen los archivos de los bloques y restauran sus referencias con los IDs nuevos del navegador de destino.

Las copias adaptadas conservan medios, cortes, audio y duración; ajustan texto y cajas a la nueva proporción. Se reinicia el seguimiento facial para revisar el nuevo encuadre. El original no se reemplaza. Numerar páginas añade capas normales editables a las escenas y permite deshacer.

## Validación

Pruebas de alineación respetando bloqueos, distribución sin alterar extremos, organización acotada, copia de estilo sin cambiar contenido, adaptación sin mutar el original y bloques con identidades nuevas. Verificación en navegador de alineación y deshacer, guardado/inserción de bloque, tres copias adaptadas y vista previa del medio real.

## Fuentes oficiales consultadas · 26 octubre 2026

- https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions
- https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma
- https://www.canva.com/video-editor/
- https://www.canva.com/help/resize/
- https://www.canva.com/en_gb/help/resize-and-crop/
- https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers
- https://www.canva.com/help/copy-style/
