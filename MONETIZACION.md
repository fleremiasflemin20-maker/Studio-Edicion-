# Fleremahias Pro: propuesta de lanzamiento · Ecuador / internacional

Estado: PRELANZAMIENTO. El botón Planes muestra una propuesta; no existe checkout activo, no se cobra y no se otorgan permisos Pro. La edición y exportación local públicas siguen disponibles. Las funciones actuales del editor no se retiran para venderlas de nuevo.

## Planes propuestos

| Plan     | Mensual USD | Anual propuesto USD | Servicios nuevos propuestos                                                                                                                          |
| -------- | ----------: | ------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gratis   |           0 |                   0 | Edición, filtros, subtítulos y descarga local actuales                                                                                               |
| Pro      |        5.99 |               59.99 | Kit de marca persistente por cuenta, recetas reutilizables, lotes de formatos, 5 GB privados, hasta 30 minutos de salida renderizada en nube por mes |
| Pro Plus |       11.99 |              119.99 | 20 GB privados, hasta 90 minutos de salida renderizada en nube por mes, 3 conexiones sociales, programación y revisiones compartidas                 |

Cuotas provisionales, sujetas a medir render real, reintentos, operaciones y concurrencia. No son capacidad ya habilitada: el backend de propietario mantiene sus límites actuales. Las publicaciones dependen de OAuth y aprobación de cada plataforma. No prometer música comercial sin licencias, IA ilimitada, clonación de voz o publicación en todas las redes.

Prioridad del producto: 1) un botón para aplicar marca, tipografía y portadas; 2) convertir una grabación en varios clips revisables; 3) generar variantes vertical/cuadrado/horizontal; 4) kits de campaña y recetas; 5) nube y programación multiusuario. Traducción, doblaje y generación de vídeo con IA se ofrecerían después como paquetes medidos, tras contratar y evaluar un proveedor.

## Cobro desde Ecuador

Recomendación inicial: Lemon Squeezy, condicionado a que apruebe la tienda y la cuenta de desembolso. Ecuador figura en su lista de desembolsos bancarios. Permite suscripciones y actúa como Merchant of Record para el cobro y los impuestos de venta que gestiona; esto no sustituye las obligaciones fiscales propias del negocio ecuatoriano.

Comisión base publicada: 5% + USD0.50; +0.5% en suscripciones y +1.5% internacional fuera de EE.UU. PayPal puede añadir 1.5%. El cálculo siguiente usa tarjeta internacional y 7% + USD0.50, sin impuesto sobre la venta ni conversión o desembolso. Si el importe cobrado incluye impuestos, la comisión puede aplicarse a ese total.

Stripe no lista Ecuador para cuentas de pagos directas. Paddle es una alternativa a evaluar (5% + USD0.50 publicados), sujeta a verificación. No se ha abierto ni contratado ninguna cuenta.

## Rentabilidad: escenario, no beneficio garantizado

| Concepto por mes                          |  Pro | Pro Plus |
| ----------------------------------------- | ---: | -------: |
| Precio                                    | 5.99 |    11.99 |
| Comisión estimada 7% + 0.50               | 0.92 |     1.34 |
| Después de pasarela                       | 5.07 |    10.65 |
| Presupuesto variable objetivo por usuario | 1.00 |     2.00 |
| Contribución antes de costes fijos        | 4.07 |     8.65 |

Los presupuestos de USD1/2 son objetivos internos, NO costes medidos. Con 100 usuarios Pro: ingresos599, comisión91.93, presupuesto variable100 y supuesto coste fijo20 dejan387.07 antes de trabajo, publicidad, impuestos propios, devoluciones y otros gastos. El plan anual reduce ingreso mensual efectivo; recalcular antes de ofrecer descuentos.

Referencia de infraestructura: R2 Standard USD0.015/GB-mes más operaciones. Browser Run Paid incluye 10h/mes y después USD0.09/h, además de concurrencia; Free tiene 10 minutos/día. Los minutos de navegador no equivalen automáticamente a minutos de vídeo: medir preparación, exportación, reintentos y concurrencia. Para vender render a clientes se debe dimensionar el plan adecuado; no se ha cambiado el plan de Cloudflare ni contratado pagos nuevos.

Proteger margen: exportación local sin coste de cómputo servidor, cuotas mensuales sin acumulación, reserva atómica antes de cada trabajo, límites de tamaño y concurrencia, contador de tiempo real, política de limpieza de temporales, alertas de coste y paquetes adicionales prepagados. Sin cargos por exceso automáticos. No depender de cuotas gratuitas para calcular margen a escala.

## Base de código preparada y trabajo pendiente

`cloudflare/billing.mjs` contiene política borrador, verificación HMAC del cuerpo original, resolución conservadora de permisos desde una suscripción comprobada en servidor y cálculo de contribución. Sus pruebas cubren firmas falsas, modo test, vencimiento, impago y sobrecuota. El módulo está deliberadamente sin conectar a rutas de producción; NO es un sistema de cobro completo.

Antes de activar ventas:

1. Implementado: identidad WebAuthn y sesiones verificadas/revocables por usuario. Nunca repartir el token de propietario a clientes.
2. Implementado para proyectos, medios, coedición y trabajos fotográficos: aislamiento por cuenta y membresía, con pruebas en producción. Las cuentas OAuth del servicio administrativo todavía deben integrarse por usuario antes de vender publicación social. Se preserva el editor público local.
3. Crear planes/variantes en modo test de una tienda aprobada, guardar IDs permitidos y secretos sólo en Worker. El servidor debe vincular checkout a usuario autenticado y plan permitido; no aceptar precio, plan ni userId arbitrarios del navegador.
4. Webhook con HMAC sobre bytes originales, límite de cuerpo, modo test separado, verificación contra API del proveedor y validación de tienda/variante/propietario. Guardar eventos con deduplicación, rechazar regresiones de estado y reconciliar periódicamente. El helper de HMAC no proporciona por sí solo idempotencia ni protección ante eventos antiguos.
5. Guardar permisos en servidor; nunca en localStorage. Reservar cuotas en transacción y liberar reservas cuando falle el trabajo, midiendo consumo real para evitar abuso de reintentos. El helper de cuotas no proporciona atomicidad: necesita almacenamiento transaccional.
6. Portal autenticado para facturas, cancelar o cambiar plan. Cancelación mantiene acceso hasta fin del periodo pagado; impago bloquea nuevos trabajos pagados, conservando acceso a descargar datos según política publicada.
7. Pantalla con renovación, total/impuestos, cuotas y política de devolución; términos, privacidad, eliminación de datos y contacto del negocio definidos por el titular.
8. Probar checkout test, renovación, cancelación, impago, reembolso completo, webhook duplicado y aislamiento de usuarios. Abrir ventas sólo tras verificar estos recorridos y costes de carga.

## Fuentes oficiales consultadas · 26 octubre 2026

- https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- https://docs.lemonsqueezy.com/help/getting-started/fees
- https://docs.lemonsqueezy.com/help/webhooks/signing-requests
- https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
- https://www.lemonsqueezy.com/pricing
- https://stripe.com/global
- https://www.paddle.com/pricing
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/browser-run/pricing/
- https://www.capcut.com/pricing
- https://www.descript.com/pricing

CapCut combina plantillas premium, almacenamiento y créditos; Descript limita procesamiento por plan. Fleremahias debe diferenciarse por un flujo social rápido y asequible con herramientas locales, en lugar de competir por generación ilimitada.
