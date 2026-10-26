# Luma en Cloudflare

Implementación del servicio para Workers, R2, Durable Objects con SQLite y Browser Run. La interfaz puede seguir en GitHub Pages y Sites; este Worker es el servicio privado de una sola persona. No se ha activado una cuenta ni contratado servicios por incluir estos archivos.

## Desplegar

1. Desde cloudflare/ ejecuta `npm ci`.
2. Autentica Wrangler con tu cuenta (`npx wrangler login`). No compartas tokens en el chat.
3. Activa R2 desde tu cuenta si aún no está disponible. Si Cloudflare solicita un método de pago o cambio de plan, revísalo tú antes de aceptar.
4. Crea el bucket privado `npx wrangler r2 bucket create luma-studio-media`. No lo hagas público.
5. Define con `npx wrangler secret put LUMA_SERVICE_TOKEN` un secreto aleatorio de al menos 32 caracteres y con `npx wrangler secret put LUMA_ENCRYPTION_KEY` una clave aleatoria de 32 bytes en hexadecimal. Guárdalos en tu gestor de secretos, no en Git.
6. Ejecuta `npm run check` para compilar sin desplegar; después `npm run deploy` para publicar el servicio.
7. En Luma > Crear mi contenido > Publicar, introduce la URL workers.dev y el token del servicio. Las claves de las redes se definen como secretos del Worker y nunca se introducen en la interfaz estática.

Configura opcionalmente `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `TIKTOK_CLIENT_ID` y `TIKTOK_CLIENT_SECRET` con `wrangler secret put`. Registra las redirecciones exactas `https://TU-WORKER.workers.dev/oauth/youtube/callback` y `/oauth/tiktok/callback` en sus portales oficiales. Los permisos y límites de cada red son los descritos en backend/README.md. TikTok es envío de borrador, no publicación pública directa.

## Funcionamiento

- R2 mantiene recursos y snapshots privados. Máximo 64 MB por archivo en esta configuración para limitar consumo de memoria y tamaño de respuesta. No envía archivos públicos por URL.
- Durable Objects almacena cuentas cifradas, OAuth de un solo uso, estados e idempotencia. Una alarma procesa la siguiente publicación o render pendiente incluso sin una pestaña abierta. Los estados inciertos no se reenvían automáticamente.
- Browser Run abre el mismo editor distribuido, carga el proyecto y exporta en un navegador remoto. Solo se permiten solicitudes al propio servicio; la credencial de servicio no se envía a orígenes externos. La sesión se cierra en finally. El render sigue siendo en tiempo real y no supera 120 segundos.
- El Worker sirve el editor bajo /studio únicamente para ese proceso autenticado. No reemplaza el sitio público.
- No hay sincronización multiusuario, analítica social ni conectores de Meta o LinkedIn en este despliegue.

## Costes y límites

Según documentación oficial consultada el 26/10/2026, Browser Run Free incluye 10 minutos al día. Workers Paid incluye 10 horas al mes y aplica cobro por exceso y concurrencia. R2 Standard incluye 10 GB-mes y cuotas de operaciones; el exceso es de pago. Revisa el panel de tu cuenta y configura alertas antes de ampliar uso. No se ha seleccionado ni contratado un plan.

Fuentes: [Browser Run precios](https://developers.cloudflare.com/browser-run/pricing/), [límites](https://developers.cloudflare.com/browser-run/limits/), [R2 precios](https://developers.cloudflare.com/r2/pricing/), [alarmas](https://developers.cloudflare.com/durable-objects/api/alarms/).

## Verificación

Compilación Wrangler sin despliegue y cuatro pruebas de cifrado, acceso, orígenes, persistencia, idempotencia y programación con almacenamiento simulado. La exportación remota y OAuth con cuentas reales requieren un despliegue autorizado; no se presentan como verificados antes de hacerlo.

La dependencia oficial @cloudflare/puppeteer arrastra avisos npm en herramientas de descarga de navegadores (extract-zip/proxy/FTP). Esas herramientas no aparecen en el bundle de Worker generado y no se usan para abrir archivos del usuario ni para instalar navegadores. Mantén la dependencia fijada y revisa las actualizaciones del proveedor.
