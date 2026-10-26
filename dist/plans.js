/* Pricing preview. This does not grant paid access or collect payment details. */
window.LumaPlans = (() => {
  let dialog;
  const plans = [
    {
      name: 'Gratis',
      price: '0',
      period: 'siempre',
      items: [
        'Editor y descarga local',
        'Filtros, textos y subtítulos locales',
        'Tus archivos permanecen en tu dispositivo',
      ],
      state: 'Disponible ahora',
    },
    {
      name: 'Pro',
      price: '5.99',
      period: 'mes · precio propuesto',
      items: [
        'Propuesta: kit de marca y recetas guardadas',
        'Propuesta: 5 GB de almacenamiento privado',
        'Propuesta: 30 minutos de render en nube al mes',
        'Propuesta: lotes de clips y formatos sociales',
      ],
      state: 'En preparación · sin cobro',
      featured: true,
    },
    {
      name: 'Pro Plus',
      price: '11.99',
      period: 'mes · precio propuesto',
      items: [
        'Propuesta: 20 GB de almacenamiento privado',
        'Propuesta: 90 minutos de render en nube al mes',
        'Propuesta: calendario y 3 conexiones sociales',
        'Propuesta: aprobaciones y versiones compartidas',
      ],
      state: 'En preparación · sin cobro',
    },
  ];
  function open() {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'plans-dialog';
      dialog.setAttribute('aria-labelledby', 'plans-title');
      dialog.innerHTML = `<div class="plans-head"><div><p class="eyebrow">FLEREMAHIAS · PLANES</p><h2 id="plans-title">Más tiempo para crear.</h2><p>La edición y descarga local siguen siendo gratuitas.</p></div><button aria-label="Cerrar planes" data-close>×</button></div><div class="plans-grid">${plans.map((p) => `<article class="plan-card ${p.featured ? 'featured' : ''}"><h3>${p.name}</h3><div class="plan-price">$${p.price} <span>USD / ${p.period}</span></div><ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul><p class="plan-status">${p.state}</p></article>`).join('')}</div><p>Los planes de pago son una propuesta de lanzamiento. Las cuotas están sujetas a pruebas de costes. No se venden suscripciones todavía.</p><details><summary>¿Cuándo podré suscribirme?</summary><p>Pro está en preparación. Antes del lanzamiento verás las funciones disponibles, las cuotas, el precio final y cómo cancelar. No necesitas tarjeta para usar el editor gratuito.</p></details><p>Los proyectos gratuitos guardados localmente no se suben automáticamente a la nube.</p>`;
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      document.body.append(dialog);
    }
    dialog.showModal();
  }
  return { open };
})();
