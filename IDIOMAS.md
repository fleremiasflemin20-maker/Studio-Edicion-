# Español / English — Fleremahias Studio

La elección inicial de idioma aparece antes de la bienvenida. El selector ES / EN permanece en la cabecera. La preferencia se guarda con la clave `fleremahias-language` en el almacenamiento local del navegador. En un dispositivo nuevo se vuelve a preguntar.

El catálogo profesional en inglés incluye navegación, formularios, herramientas, composición, tablero, publicación, mensajes y los 29 capítulos de la guía. Las ayudas accesibles y los cuadros nativos de confirmación también se localizan. Las búsquedas de ayuda y de herramientas admiten los nombres traducidos.

## Protección del trabajo

- Los textos introducidos, nombres de proyectos, archivos, código y subtítulos existentes no se traducen automáticamente.
- Las opciones mantienen sus valores internos originales, aunque cambie su etiqueta visible. Los estados y referencias de medios siguen siendo compatibles con los respaldos anteriores.
- Cambiar idioma no reconstruye el editor activo, ni inicia grabaciones, exportaciones, cobros o publicaciones.
- Las plantillas nuevas, elementos prediseñados y estructuras de guion usan el idioma elegido. Después se consideran contenido editable del creador.
- No se envía texto del usuario a un traductor ni se añade una dependencia de red para localizar la interfaz.

## Mantenimiento

`dist/i18n-catalog.js` es el catálogo editable de frases completas. `dist/i18n-core.js` solo transforma claves conocidas y patrones explícitos de interfaz: no sustituye palabras arbitrarias dentro del texto del usuario. `dist/i18n.js` conserva la fuente de cada etiqueta y atributo para poder volver al español; excluye campos de edición y zonas de contenido, y solo observa subárboles modificados.

Para nuevos controles: añade su clave al catálogo y, si muestra contenido del usuario, conserva una zona `translate="no"` o `data-i18n-ignore`. No traduzcas IDs, claves de variables, valores de opción ni enums de negocio. `tests/i18n.test.cjs` comprueba terminología, fechas y contadores, conservación de datos y cobertura íntegra del manual.

Los selectores nativos de fecha, archivos y permisos pueden seguir el idioma del navegador o del sistema operativo. Los rótulos y mensajes propios del estudio siguen la elección ES / EN.
