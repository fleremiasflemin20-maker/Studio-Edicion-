# Fleremahias en Cloudflare

Estudio público: https://fleremahias-studio.analista-datos-pro.workers.dev/

Cualquier visitante puede crear contenido y descargar sus videos, imágenes y respaldos sin autenticarse. Los proyectos del editor se guardan en su navegador y se separan por origen. Los archivos privados, cuentas y trabajos del servidor están protegidos por un token de servicio; no se muestran a otros visitantes.

## Recursos desplegados

- Worker público `fleremahias-studio` con el editor y el selector Español / English.
- Servicio interno de compatibilidad `luma-studio-service`: conserva el estado privado existente. Se accede desde el Worker público mediante un Service Binding, sin copiar secretos al cliente.
- Durable Object SQLite `LumaState` para cuentas cifradas, OAuth, trabajos programados e idempotencia.
- Bucket R2 Standard privado `luma-studio-media`. R2 fue activado por el propietario de la cuenta; no se cambió su plan de Workers.
- Browser Run para ejecutar el compositor en un navegador remoto y seguir exportando con la pestaña del usuario cerrada.

Límites internos: 64 MB por archivo remoto y 512 MB de archivos indexados por Fleremahias. La interfaz muestra el uso tras conectar y permite vaciar archivos temporales con confirmación, siempre que no haya trabajos pendientes. El render admite hasta 120 segundos, sujeto al tamaño del archivo y a las cuotas de la cuenta. Los videos grandes pueden exportarse localmente. Los archivos no se borran automáticamente.

El adaptador DurableFiles permite despliegues alternativos sin R2 (8 MB por archivo, 64 MB total), pero la configuración actual utiliza R2Files. La carpeta incluye pruebas de ambos adaptadores.

## Conectar el servicio privado

En Crear mi contenido > Publicar la dirección del servicio está preconfigurada. Introduce el token de servicio únicamente en tu propia sesión; se mantiene en sessionStorage de esa pestaña y no está incluido en el código público. La comprobación muestra cuentas y uso de almacenamiento. Desde Exportar puedes enviar proyectos al servidor y descargar trabajos terminados.

Las credenciales se generaron localmente fuera del repositorio y se guardaron como secretos de Workers. Nunca publiques `LUMA_SERVICE_TOKEN`, `LUMA_ENCRYPTION_KEY` ni tokens OAuth. La clave de cifrado contiene 32 bytes en hexadecimal. Los tokens de cuentas sociales se cifran con AES-256-GCM.

Para publicar en YouTube o enviar borradores a TikTok todavía debes registrar las aplicaciones y definir `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `TIKTOK_CLIENT_ID` y `TIKTOK_CLIENT_SECRET` con `wrangler secret put`. Registra estas redirecciones en los portales oficiales:

- https://fleremahias-studio.analista-datos-pro.workers.dev/oauth/youtube/callback
- https://fleremahias-studio.analista-datos-pro.workers.dev/oauth/tiktok/callback

Hasta completar esos pasos no hay cuentas conectadas. No se publicó contenido de prueba en redes sociales. TikTok es envío de borrador que el usuario completa en su aplicación; no es Direct Post público. Meta, LinkedIn y analítica social siguen pendientes.

## Desplegar cambios

Desde cloudflare/ ejecuta `npm ci`, autentica Wrangler si hace falta, comprueba con `npm run check` y despliega con `npm run deploy`. El comando actualiza primero el servicio interno con `wrangler.backend.jsonc` (STATE, MEDIA, BROWSER y ASSETS), y después el acceso público con `wrangler.jsonc` (ASSETS y PRIVATE_SERVICE). No crees otro bucket con el mismo nombre ni hagas público el existente.

Las alarmas ejecutan el siguiente trabajo pendiente. Las solicitudes usan claves de idempotencia; un resultado incierto pasa a Revisar estado y no se reenvía automáticamente. El editor de render interno bajo /studio requiere autenticación. Las peticiones del navegador remoto se restringen al propio servicio y las sesiones se cierran siempre. Los videos resultantes se suben directamente al almacén para evitar transportar todo el video en JSON.

## Verificación

Ocho pruebas específicas cubren cifrado, autenticación, orígenes, programación, idempotencia, archivos por bloques, límites R2 y separación entre estudio público y API privada. Wrangler compila y despliega. Una prueba real generó y descargó un video MP4 de dos segundos desde Cloudflare. La transcripción local y exportaciones con audio/capas también se probaron en el navegador.

La dependencia oficial @cloudflare/puppeteer arrastra avisos npm en herramientas de descarga de navegadores (extract-zip/proxy/FTP). Esas herramientas no aparecen en el bundle generado ni se usan con archivos del usuario. Mantén la dependencia fijada y revisa actualizaciones del proveedor.

## Cuotas y costes

Se mantienen las cuotas y condiciones de la cuenta del propietario. Browser Run Free incluye 10 minutos diarios; R2 Standard incluye 10 GB-mes y cuotas de operaciones, con cobro por exceso según la suscripción activada por el propietario. Los límites internos de Fleremahias no sustituyen los de Cloudflare ni garantizan que toda la cuenta esté dentro de su cuota.

Fuentes consultadas el 26/10/2026: [Browser Run](https://developers.cloudflare.com/browser-run/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [alarmas](https://developers.cloudflare.com/durable-objects/api/alarms/).
