# Servicio complementario de Fleremahias

Servicio de un solo propietario para renderizar proyectos y programar envíos con el navegador cerrado. No está alojado en GitHub Pages ni activado por subir este repositorio. Requiere Node 22, un servidor con disco persistente, HTTPS y Chromium. No introduzcas secretos en el código ni en archivos que publiques.

## Instalación

Desde backend/ ejecuta `npm install` y `npx playwright install --with-deps chromium`. Arranca con `npm start` después de definir las variables del entorno de tu proveedor. Para probar el servicio: `npm test`.

Variables obligatorias:

- `LUMA_SERVICE_TOKEN`: secreto aleatorio de al menos 32 caracteres para conectar tu interfaz. El navegador lo mantiene solo en memoria de la sesión.
- `LUMA_ENCRYPTION_KEY`: 32 bytes aleatorios codificados como 64 caracteres hexadecimales. Cifra tokens OAuth con AES-256-GCM. Conserva la clave en el almacén de secretos del servidor.
- `LUMA_PUBLIC_URL`: URL HTTPS de este servicio, sin barra final.
- `LUMA_ORIGINS`: orígenes permitidos separados por coma, por ejemplo `https://fleremiasflemin20-maker.github.io,https://luma-social-studio-251026.keenox19.chatgpt.site`.
- `LUMA_DATA`: directorio privado y persistente. Por defecto backend/data, excluido de Git. Respáldalo junto con la clave de cifrado por separado.
- `PORT`: por defecto 4180. `LUMA_BIND`: por defecto 127.0.0.1; en contenedores puedes usar 0.0.0.0 detrás de un proxy HTTPS.

Genera cada secreto con el generador criptográfico de tu plataforma. Un ejemplo de generación local es `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. No pegues el resultado en un chat ni lo subas a GitHub.

## Cuentas

YouTube: configura `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` de una aplicación web de Google con YouTube Data API habilitada. Registra exactamente `LUMA_PUBLIC_URL/oauth/youtube/callback` como redirección. Se solicita permiso de subida y lectura del canal. OAuth incluye estado de un solo uso, caducidad y PKCE. Los tokens se cifran y se renuevan al usarlos. Las subidas usan sesiones reanudables. La visibilidad predeterminada es privada; revisa la selección antes del envío.

TikTok: configura `TIKTOK_CLIENT_ID` (client key) y `TIKTOK_CLIENT_SECRET`. Registra `LUMA_PUBLIC_URL/oauth/tiktok/callback`. Este conector solicita `video.upload` y envía un borrador de hasta 64 MB a la bandeja de TikTok. Debes abrir la notificación y completar la publicación en TikTok. No es publicación pública automática ni Direct Post auditado. Las descripciones se preparan en Fleremahias; la API de borradores no las aplica. Revisa la aprobación de la aplicación y los permisos en el portal de TikTok.

Instagram, Facebook y LinkedIn siguen usando la preparación de paquetes local; no hay conectores OAuth de estas redes en este servicio. Se necesitan las aplicaciones y permisos correspondientes antes de implementar y verificar sus flujos. Las métricas y recomendaciones de horario por cuenta tampoco están conectadas.

En Fleremahias abre Crear mi contenido > Publicar, introduce la URL y tu token de servicio y pulsa Comprobar servicio. Conectar cuenta abre la pantalla oficial. Autoriza allí y vuelve a comprobar. No compartas tus contraseñas con Fleremahias.

## Trabajos y límites

- `/api/renders` recibe una copia del proyecto y referencias de archivos previamente subidos. Chromium abre el editor incluido en dist, usa el mismo compositor y genera el resultado. Solo puede pedir recursos al propio servicio. La transcripción y modelos externos no se ejecutan al renderizar.
- El procesamiento sigue siendo en tiempo real, pero ocurre en el servidor; el usuario puede cerrar su pestaña. Máximo 120 segundos por montaje. Imágenes y videos adicionales se componen en el mismo render.
- `/api/posts` guarda un envío con fecha UTC. El navegador convierte la hora local elegida. La cola se revisa cada cinco segundos mientras el servicio está encendido. No hay garantía de hora exacta por los tiempos de procesamiento y moderación de las redes.
- Las claves de idempotencia evitan duplicar solicitudes del cliente. Ante una respuesta incierta de la red o reinicio durante un envío, la tarea se marca Revisar estado y no se reenvía automáticamente. Verifica primero la plataforma.
- Renderizados interrumpidos conservan su estado y necesitan volver a enviarse. No se reanudan a mitad de fotograma.
- El servicio está diseñado para un solo propietario. No es una plataforma multiusuario. Usa control de acceso de tu proveedor y un volumen privado; no expongas backend/data.
- Los archivos se limitan a 200 MB por subida y la API usa lista explícita de orígenes, autenticación y rutas internas. Configura también límites de recursos, cuota de disco y copias de seguridad en el alojamiento.

## Estado de verificación

Las pruebas automáticas cubren cifrado, autenticación, CORS, persistencia, idempotencia y validación. Los conectores y el render en servidor requieren instalación y credenciales reales para una comprobación integral; no se han autorizado cuentas ni publicado contenido de prueba en redes.

Referencias: [YouTube OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [subidas reanudables](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol), [TikTok Upload](https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video).
