(function (root) {
  root.FleremahiasTransition = function (ctx, oldFrame, newFrame, amount, id) {
    const w = ctx.canvas.width,
      h = ctx.canvas.height,
      p = Math.max(0, Math.min(1, amount));
    ctx.drawImage(oldFrame, 0, 0);
    ctx.save();
    if (id === 'tr-clean-cut') {
      if (p < 0.5) {
        ctx.restore();
        return;
      }
    } else if (id === 'tr-soft-fade') ctx.globalAlpha = p;
    else if (id === 'tr-paper-slide') ctx.translate((1 - p) * w, 0);
    else if (id === 'tr-orbit-push') {
      ctx.globalAlpha = p;
      ctx.translate(w / 2, h / 2);
      ctx.rotate((1 - p) * 0.12);
      ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
      ctx.translate(-w / 2, -h / 2);
    } else if (id === 'tr-soft-zoom') {
      ctx.globalAlpha = p;
      ctx.translate(w / 2, h / 2);
      ctx.scale(1.2 - 0.2 * p, 1.2 - 0.2 * p);
      ctx.translate(-w / 2, -h / 2);
    } else if (id === 'tr-gentle-rise') {
      ctx.globalAlpha = p;
      ctx.translate(0, (1 - p) * h * 0.25);
    } else if (id === 'tr-page-turn') {
      ctx.translate(w / 2, 0);
      ctx.scale(Math.max(0.001, p), 1);
      ctx.translate(-w / 2, 0);
    } else {
      ctx.beginPath();
      if (id === 'tr-ribbon-reveal') {
        for (let i = 0; i < 12; i++) ctx.rect((i * w) / 12, 0, w / 12, p * h);
      } else if (id === 'tr-ink-dissolve') {
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 12; j++) {
            ctx.moveTo((i * w) / 7 + (p * w) / 9, (j * h) / 11);
            ctx.arc((i * w) / 7, (j * h) / 11, p * Math.hypot(w / 7, h / 11), 0, Math.PI * 2);
          }
      } else if (id === 'tr-frame-shift') ctx.rect(0, (1 - p) * h, w, p * h);
      else {
        ctx.moveTo(0, 0);
        ctx.lineTo(0, h);
        for (let i = 0; i <= 32; i++) {
          const y = h - (i * h) / 32,
            x =
              p * w +
              (id === 'tr-wave-flow'
                ? Math.sin(i * 0.5 + p * 6) * w * 0.07
                : Math.sin(i * 4.7) * w * 0.035) *
                Math.sin(p * Math.PI);
          ctx.lineTo(Math.max(0, x), y);
        }
        ctx.closePath();
      }
      ctx.clip();
    }
    ctx.drawImage(newFrame, 0, 0);
    ctx.restore();
  };
})(globalThis);
