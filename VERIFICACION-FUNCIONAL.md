# Fleremahias Studio · verificación funcional y Motion

Actualización: 27 de octubre de 2026.

## Cambios comprobados

- La vista previa individual conserva su posición al pausar y reanudar, actualiza el contador y detiene el vídeo en el límite del recorte. Al cambiar de escena o reconstruir el editor se cancela el bucle anterior.
- Cancelar una grabación descarta el archivo parcial y libera sus pistas. Si el permiso llega después de cancelar, la grabación no comienza. Se rechazan grabaciones vacías y se liberan dispositivos si falla el codificador. Estos casos se verifican con medios simulados; no se ha grabado la cámara ni el micrófono del propietario.
- Las solicitudes al servicio privado admiten cancelación y tiempo máximo de espera.
- Motion incorpora React, Remotion y Three.js con seis composiciones originales, textos y colores, edición React/TSX, música sintetizada, vista previa, fotogramas, PNG, MP4/WebM, cancelación, descarga, biblioteca y adición al montaje abierto.
- El proyecto Motion se descarga en JSON y su borrador se incluye en el respaldo general. La guía contiene su capítulo en español e inglés.

## Pruebas reales en navegador

| Flujo                              | Resultado                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| Previsualizar composición 2D       | Correcto                                                             |
| Exportar PNG                       | Archivo generado                                                     |
| MP4 2D vertical, 1 segundo         | H.264, 720×1280, 30 FPS, 138786 bytes                                |
| MP4 3D con música, 1 segundo       | H.264 + AAC, 720×1280, 30 FPS, 226477 bytes                          |
| MP4 2D, alta resolución, 1 segundo | H.264, 2160×3840, 60 FPS, 1052240 bytes                              |
| React/TSX editable                 | Compilación y previsualización del ejemplo correctas                 |
| Cancelar render 3D                 | Render detenido; controles recuperados y último resultado conservado |
| Guardar resultado en Medios        | Recurso visible en biblioteca del editor                             |
| Añadir PNG al montaje abierto      | Segunda escena de seis segundos creada y seleccionada                |

Se inspeccionaron los MP4 descargados con ffprobe. Las pruebas cortas no garantizan el mismo rendimiento en todos los dispositivos ni en piezas más largas. 3D requiere WebGL; exportar vídeo requiere WebCodecs y códecs compatibles. También se descargó y verificó un WebM 3D: VP8, 720×1280, 30 FPS, un segundo, 497328 bytes.

## Pruebas automáticas

55 pruebas del editor y servicio local; 15 de Cloudflare. Incluyen ocho regresiones nuevas de reproducción y grabación y tres de configuración, proyecto portable y audio WAV de Motion. No sustituyen una prueba manual de cada botón en todos los navegadores.

## Dependencias que siguen requiriendo configuración

- Publicar automáticamente en YouTube/TikTok requiere aplicaciones OAuth aprobadas y cuentas conectadas. No se ha publicado contenido real en redes durante esta actualización.
- Cobros Pro: propuesta y estructura preparadas; no hay pasarela comercial activa ni se han realizado cobros.
- Colaboración multiusuario, métricas reales y otros conectores no deben presentarse como servicios activos sin configuración e integración verificadas.
- Reconocimiento de voz y seguimiento facial descargan modelos cuando se solicitan. Calidad, permisos y soporte dependen del dispositivo y deben revisarse con contenido real.
- El código React se ejecuta en un iframe de origen aislado y sin conexiones arbitrarias. Código propio que sature la CPU aún puede bloquear su vista previa; no es un servicio de ejecución de código no confiable de terceros.
- No se integra automáticamente Claude ni una cuenta de generación por IA. El usuario puede escribir o pegar código y revisarlo.

## Licencia

El propietario confirmó que trabaja solo. Se utiliza `free-license` de Remotion para la empresa individual. Las condiciones deben revisarse si el equipo supera tres personas. El contador técnico de Remotion no recibe textos, código ni archivos del proyecto. Documentación oficial: https://www.remotion.pro/license y https://www.remotion.dev/docs/client-side-rendering.

## Alcance de la revisión

Esta actualización corrige fallos concretos y verifica el nuevo flujo Motion de principio a fin. No certifica que todas las funciones existentes y todas las integraciones externas estén terminadas: las dependencias anteriores siguen pendientes y no se han probado cámara/micrófono físicos ni publicación en cuentas sociales reales.
