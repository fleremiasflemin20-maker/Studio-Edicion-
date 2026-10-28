/* Guest review UI: capability link only; owner credentials are never read or sent. */
(function () {
  'use strict';
  const CANONICAL = 'https://fleremahias-studio.analista-datos-pro.workers.dev';
  const API = location.origin === CANONICAL ? location.origin : CANONICAL;
  const token = location.hash.slice(1),
    validToken = /^[A-Za-z0-9_-]{32}$/.test(token);
  const $ = (id) => document.getElementById(id),
    words = {
      es: {
        eyebrow: 'REVISIÓN COMPARTIDA',
        loading: 'Cargando revisión…',
        description: 'Revisa el contenido y deja comentarios en el segundo exacto.',
        privacy:
          'Cualquier persona con este enlace puede ver estos archivos y comentar. El enlace caduca en un máximo de 72 horas. No necesitas una clave del propietario.',
        caption: 'Descripción de publicación',
        feedback: 'Comentarios',
        refresh: 'Actualizar',
        author: 'Tu nombre',
        time: 'Segundo del vídeo',
        useTime: 'Usar reproducción',
        comment: 'Tu comentario',
        submit: 'Enviar comentario',
        limit:
          'Hasta 20 comentarios al día por enlace. Tu nombre y comentario serán visibles para las demás personas con acceso.',
        openStudio: 'Abrir el estudio ↗',
        empty: 'Todavía no hay comentarios. Deja la primera observación.',
        noMedia: 'Este enlace contiene información del proyecto, sin archivos adjuntos.',
        noCaption: 'No hay descripción de publicación.',
        expired: 'Este enlace ha caducado o fue revocado. Pide un enlace nuevo al propietario.',
        invalid: 'El enlace de revisión no es válido o está incompleto.',
        unavailable: 'No se pudo cargar la revisión. Comprueba la conexión y vuelve a intentarlo.',
        notFound: 'No se encontró la revisión. Comprueba el enlace con el propietario.',
        sending: 'Enviando comentario…',
        sent: 'Comentario añadido.',
        ambiguous:
          'No se pudo confirmar el envío. Actualiza los comentarios antes de volver a intentarlo.',
        daily: 'Este enlace alcanzó su límite de 20 comentarios de hoy. Vuelve mañana.',
        badComment: 'Escribe tu nombre, un comentario y un segundo entre 0 y 120.',
        expires: 'Disponible hasta',
        download: 'Descargar',
        downloading: 'Preparando descarga…',
        downloadError: 'No se pudo descargar el archivo.',
        video: 'Vídeo',
        image: 'Imagen',
        unsafeMedia: 'Un archivo de la revisión tiene una dirección o tipo no admitido.',
        emptyName: 'Visitante',
        needsVideo: 'Selecciona un vídeo para usar su posición de reproducción.',
        noVideo: 'No hay vídeos en esta revisión.',
        retry: 'Volver a intentar',
      },
      en: {
        eyebrow: 'SHARED REVIEW',
        loading: 'Loading review…',
        description: 'Review the content and leave timestamped feedback.',
        privacy:
          'Anyone with this link can view these files and leave comments. The link expires within 72 hours. You do not need an owner key.',
        caption: 'Post caption',
        feedback: 'Feedback',
        refresh: 'Refresh',
        author: 'Your name',
        time: 'Video timestamp (seconds)',
        useTime: 'Use playback time',
        comment: 'Your comment',
        submit: 'Post comment',
        limit:
          'Up to 20 comments per day for this link. Your name and comment are visible to other people with access.',
        openStudio: 'Open the studio ↗',
        empty: 'No comments yet. Share your first observation.',
        noMedia: 'This link contains project information without attached files.',
        noCaption: 'No post caption provided.',
        expired: 'This link has expired or was revoked. Ask the owner for a new link.',
        invalid: 'This review link is invalid or incomplete.',
        unavailable: 'The review could not be loaded. Check your connection and try again.',
        notFound: 'Review not found. Check the link with its owner.',
        sending: 'Posting comment…',
        sent: 'Comment added.',
        ambiguous:
          'The submission could not be confirmed. Refresh the comments before trying again.',
        daily: 'This link has reached its daily limit of 20 comments. Please return tomorrow.',
        badComment: 'Enter your name, a comment, and a timestamp between 0 and 120 seconds.',
        expires: 'Available until',
        download: 'Download',
        downloading: 'Preparing download…',
        downloadError: 'The file could not be downloaded.',
        video: 'Video',
        image: 'Image',
        unsafeMedia: 'A review file uses an unsupported address or media type.',
        emptyName: 'Guest',
        needsVideo: 'Select a video to use its playback position.',
        noVideo: 'There are no videos in this review.',
        retry: 'Try again',
      },
    };
  let language = 'es';
  try {
    language =
      localStorage.getItem('fleremahias-language') ||
      (navigator.language.startsWith('es') ? 'es' : 'en');
  } catch {}
  if (!words[language]) language = 'es';
  let review = null,
    activeVideo = null,
    loading = false,
    posting = false,
    expired = false,
    fatalKey = 'expired',
    lastStatus = '',
    lastError = false;
  const t = (key) => words[language][key] || key;
  function status(key, error = false) {
    lastStatus = key;
    lastError = error;
    $('review-status').textContent = key ? t(key) : '';
    $('review-status').dataset.error = String(error);
  }
  function setLanguage(value) {
    language = value;
    try {
      localStorage.setItem('fleremahias-language', value);
    } catch {}
    document.documentElement.lang = value;
    document.title = 'Fleremahias · ' + (value === 'es' ? 'Revisión compartida' : 'Shared review');
    for (const el of document.querySelectorAll('[data-label]'))
      el.textContent = t(el.dataset.label);
    for (const el of document.querySelectorAll('[data-language]'))
      el.setAttribute('aria-pressed', String(el.dataset.language === value));
    if (review) {
      $('review-title').textContent = String(review.title || 'Fleremahias');
      $('review-description').textContent = t('description');
      $('review-caption').textContent = String(review.caption || t('noCaption'));
      $('review-expiry').textContent =
        t('expires') +
        ' ' +
        new Date(review.expiresAt).toLocaleString(value === 'es' ? 'es-EC' : 'en-US');
      renderComments();
      for (const button of document.querySelectorAll('[data-download]'))
        button.textContent = t('download');
    } else if (expired) {
      $('review-title').textContent = t(fatalKey);
    }
    for (const label of document.querySelectorAll('[data-medium]'))
      label.textContent =
        t(label.dataset.medium) + ' ' + label.dataset.index + ' · ' + label.dataset.size + ' MB';
    status(lastStatus, lastError);
    if (!validToken) status('invalid', true);
  }
  function setBusy() {
    $('review-submit').disabled = posting || loading || expired;
    $('review-refresh').disabled = posting || loading || expired;
    for (const field of $('review-form').querySelectorAll('input,textarea'))
      field.disabled = posting || expired;
  }
  async function request(path, options = {}) {
    const response = await fetch(API + '/review/v1/' + path, {
      ...options,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const error = Error('Request failed');
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  function expire(key = 'expired') {
    expired = true;
    fatalKey = key;
    $('review-retry').hidden = true;
    review = null;
    for (const video of document.querySelectorAll('video')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    $('review-media').replaceChildren();
    $('review-workspace').hidden = true;
    $('review-title').textContent = t(key);
    $('review-expiry').textContent = '';
    status(key, true);
    setBusy();
  }
  function safeMedia(item) {
    if (
      !item ||
      !['image/png', 'image/jpeg', 'video/mp4', 'video/webm'].includes(item.mime) ||
      !Number.isFinite(+item.size) ||
      item.size <= 0 ||
      item.size > 20 * 1024 * 1024
    )
      return null;
    try {
      const url = new URL(item.url);
      if (
        url.origin !== API ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/review/v1/share/' + token + '/media/' + String(item.id) ||
        !/^[0-9a-f-]{36}$/i.test(item.id)
      )
        return null;
      return url.href;
    } catch {
      return null;
    }
  }
  function stamp(time) {
    const value = Math.max(0, Math.min(120, Number(time) || 0));
    return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  }
  function renderComments() {
    const list = $('review-comments');
    list.replaceChildren();
    const comments = Array.isArray(review?.comments) ? review.comments.slice(-60) : [];
    if (!comments.length) {
      const p = document.createElement('li');
      p.className = 'review-empty';
      p.textContent = t('empty');
      list.append(p);
      return;
    }
    for (const comment of comments) {
      const item = document.createElement('li'),
        meta = document.createElement('div'),
        author = document.createElement('strong'),
        seek = document.createElement('button'),
        body = document.createElement('p'),
        date = document.createElement('small');
      meta.className = 'review-comment-meta';
      author.textContent = String(comment.author || t('emptyName')).slice(0, 80);
      seek.type = 'button';
      seek.textContent = stamp(comment.time);
      seek.setAttribute(
        'aria-label',
        (language === 'es' ? 'Ir al segundo ' : 'Go to timestamp ') + stamp(comment.time),
      );
      seek.onclick = () => {
        const video = activeVideo || document.querySelector('video');
        if (video) {
          const end = Number.isFinite(video.duration) ? video.duration : 120;
          video.currentTime = Math.max(0, Math.min(end, Number(comment.time) || 0));
          video.focus();
        } else status('noVideo', true);
      };
      body.textContent = String(comment.text || '').slice(0, 2000);
      date.className = 'review-comment-date';
      const created = new Date(comment.createdAt);
      date.textContent = Number.isFinite(created.getTime())
        ? created.toLocaleString(language === 'es' ? 'es-EC' : 'en-US')
        : '';
      meta.append(author, seek);
      item.append(meta, body, date);
      list.append(item);
    }
  }
  function renderMedia() {
    const container = $('review-media');
    container.replaceChildren();
    activeVideo = null;
    const media = Array.isArray(review.media) ? review.media.slice(0, 5) : [];
    if (!media.length) {
      const p = document.createElement('p');
      p.className = 'review-empty';
      p.dataset.label = 'noMedia';
      p.textContent = t('noMedia');
      container.append(p);
    }
    for (const [index, item] of media.entries()) {
      const url = safeMedia(item);
      if (!url) {
        status('unsafeMedia', true);
        continue;
      }
      const figure = document.createElement('figure'),
        caption = document.createElement('figcaption'),
        label = document.createElement('span'),
        download = document.createElement('button'),
        video = item.mime.startsWith('video/'),
        element = document.createElement(video ? 'video' : 'img');
      figure.className = 'review-media-card';
      if (video) {
        element.controls = true;
        element.preload = 'metadata';
        element.playsInline = true;
        element.addEventListener('play', () => {
          for (const other of container.querySelectorAll('video'))
            if (other !== element) other.pause();
          activeVideo = element;
        });
        element.addEventListener('focus', () => (activeVideo = element));
        element.addEventListener('error', () => status('unavailable', true));
        activeVideo ||= element;
      } else {
        element.alt = String(review.title || 'Fleremahias') + ' · ' + (index + 1);
        element.loading = 'lazy';
        element.addEventListener('error', () => status('unavailable', true));
      }
      element.src = url;
      label.dataset.medium = video ? 'video' : 'image';
      label.dataset.index = String(index + 1);
      label.dataset.size = (item.size / 1024 / 1024).toFixed(1);
      label.textContent =
        t(video ? 'video' : 'image') +
        ' ' +
        (index + 1) +
        ' · ' +
        (item.size / 1024 / 1024).toFixed(1) +
        ' MB';
      download.type = 'button';
      download.dataset.download = String(index);
      download.textContent = t('download');
      download.onclick = async () => {
        if (download.disabled || expired) return;
        download.disabled = true;
        try {
          status('downloading');
          const response = await fetch(url, {
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            signal: AbortSignal.timeout(30000),
          });
          if (response.status === 410) {
            expire();
            return;
          }
          if (!response.ok) throw Error('Download failed');
          const blob = await response.blob();
          if (blob.size > 20 * 1024 * 1024 || !blob.size) throw Error('Invalid file size');
          const objectURL = URL.createObjectURL(blob),
            a = document.createElement('a');
          a.href = objectURL;
          a.download =
            'Fleremahias-review-' +
            (index + 1) +
            '.' +
            (item.mime === 'image/png'
              ? 'png'
              : item.mime === 'image/jpeg'
                ? 'jpg'
                : item.mime === 'video/mp4'
                  ? 'mp4'
                  : 'webm');
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(objectURL), 60000);
          status('');
        } catch {
          status('downloadError', true);
        } finally {
          download.disabled = false;
        }
      };
      caption.append(label, download);
      figure.append(element, caption);
      container.append(figure);
    }
  }
  async function load(initial = false) {
    if (loading || posting || expired || !validToken) return;
    loading = true;
    $('review-retry').hidden = true;
    setBusy();
    try {
      const data = await request('share/' + token);
      if (!data || !Number.isFinite(+data.expiresAt) || data.expiresAt <= Date.now()) {
        expire();
        return;
      }
      review = data;
      $('review-workspace').hidden = false;
      setLanguage(language);
      if (initial) renderMedia();
      status('');
    } catch (error) {
      if (error.status === 410) expire();
      else if (error.status === 404) expire('notFound');
      else {
        status('unavailable', true);
        $('review-retry').hidden = false;
      }
    } finally {
      loading = false;
      setBusy();
    }
  }
  for (const button of document.querySelectorAll('[data-language]'))
    button.onclick = () => setLanguage(button.dataset.language);
  $('review-refresh').onclick = () => load(false);
  $('review-retry').onclick = () => load(!review);
  $('review-use-time').onclick = () => {
    const video = activeVideo || document.querySelector('video');
    if (!video) {
      status('needsVideo', true);
      return;
    }
    $('review-time').value = String(
      Math.min(120, Math.max(0, Math.round(video.currentTime * 10) / 10)),
    );
    status('');
  };
  $('review-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (posting || loading || expired || !review) return;
    const author = $('review-author').value.trim(),
      text = $('review-comment').value.trim(),
      time = Number($('review-time').value);
    if (!author || !text || !Number.isFinite(time) || time < 0 || time > 120) {
      status('badComment', true);
      return;
    }
    posting = true;
    setBusy();
    status('sending');
    try {
      const comment = await request('share/' + token + '/comments', {
        method: 'POST',
        body: JSON.stringify({ author: author.slice(0, 80), text: text.slice(0, 2000), time }),
      });
      review.comments = [...(review.comments || []), comment];
      $('review-comment').value = '';
      renderComments();
      status('sent');
    } catch (error) {
      if (error.status === 410) expire();
      else status(error.status === 429 ? 'daily' : 'ambiguous', true);
    } finally {
      posting = false;
      setBusy();
    }
  });
  setLanguage(language);
  if (validToken) load(true);
  else {
    expire('invalid');
  }
  setInterval(() => {
    if (review && Date.now() >= review.expiresAt) expire();
  }, 1000);
})();
