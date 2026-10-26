# Tablero creativo · decisiones de ingeniería

## Objetivo

Separar organización de campaña de composición audiovisual. Modo tablero muestra tarjetas enlazadas a proyectos reales, herramientas, medios, notas y zonas; Modo enfoque usa el editor existente con más espacio. Mantener una única representación del proyecto evita dos motores de edición que produzcan resultados distintos.

## Implementación

- `board-core.js`: normalización, geometría, zoom anclado al puntero, encuadre y movimiento de zonas; funciones puras probadas.
- `board.js`: controlador DOM, Pointer Events, persistencia, adaptación al editor y respaldo. No añade dependencias ni migra la app a React para introducir un tablero.
- `board.css`: tonos semánticos violeta, menta, melocotón, rosa y azul; animaciones suaves con respeto a reduced-motion.
- Coordenadas de mundo separadas de la cámara. La cámara transforma un contenedor; no modifica posiciones al acercarse. El zoom mantiene el punto bajo el puntero.
- Hasta 120 tarjetas, coordenadas acotadas y cadenas limitadas al importar. Referencias a IDs locales, nunca rutas o scripts ejecutables. Los textos se escapan.
- Arrastre por cabecera y movimiento con flechas; botones de añadir y aplicar para dispositivos sin arrastre. Las zonas mueven tarjetas totalmente contenidas.
- Las imágenes/videos de las tarjetas son vistas de recursos, no instancias completas del editor ni exportadores ejecutándose simultáneamente.
- Aplicar herramientas reutiliza el modelo de escenas y capas. Los filtros son reversibles y las acciones que requieren revisión abren los paneles existentes.
- Historial de doce acciones del tablero en memoria, descartado al salir para evitar deshacer ediciones posteriores hechas en otra vista. Las notas, posiciones y cámara se guardan localmente.
- Respaldo completo conserva medios y referencias; restauración remapea proyectos y archivos. Una tarjeta puede indicar un recurso ausente si se eliminó del navegador.

No es colaboración multiusuario ni un motor de automatización de nodos. Las tarjetas de herramientas no ejecutan trabajos por estar en el tablero ni al recargarlo. Servicios privados y publicación conectada conservan sus requisitos. No se abre acceso público a archivos R2 ni se comparten tokens.

## Referencias consultadas · 26 octubre 2026

- Stitch: lienzo amplio para explorar y organizar alternativas. https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/
- Figma: secciones para dar estructura al lienzo. https://help.figma.com/hc/en-us/articles/9771500257687-Organize-your-canvas-with-sections
- React Flow: navegación y accesibilidad de nodos. Se toma el criterio de accesibilidad, sin introducir la biblioteca en este proyecto sin React. https://reactflow.dev/learn/advanced-use/accessibility
- Encaja Studio: revisión de la captura y documentación locales ya obtenidas con acceso del titular; separación Enfoque/Tablero, biblioteca y tarjetas. Investigación de solo lectura. Implementación nueva para contenido social, sin copiar código privado ni hacer cambios a sus repositorios.

## Validación

Pruebas de invariantes de zoom, agrupación espacial, encuadre e importaciones malformadas. Comprobación visual en navegador del tablero, aplicación real de filtro por arrastre, deshacer y apertura de la misma pieza en enfoque. El historial de GitHub y las copias de respaldo corresponden a la entrega publicada.
