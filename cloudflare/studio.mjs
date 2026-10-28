import { handleCatalog } from './catalog.mjs';
import { handleReview } from './review-service.mjs';
// Branded public entrypoint. Private routes retain the existing service's authentication.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/catalog/')) return handleCatalog(request, env);
    if (url.pathname.startsWith('/review/v1/')) return handleReview(request, env);
    if (/^\/(api|oauth|studio)\//.test(url.pathname)) {
      return env.PRIVATE_SERVICE.fetch(request);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/') url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, request));
  },
};
