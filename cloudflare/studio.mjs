import { handleAccounts } from './accounts.mjs';
import { handleWorkspace } from './workspace.mjs';
import { handleImageAI } from './images.mjs';
export { ProjectRoom } from './project-room.mjs';
import { handleCatalog } from './catalog.mjs';
import { handleReview } from './review-service.mjs';
// Branded public entrypoint. Private routes retain the existing service's authentication.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/accounts/v1/')) return handleAccounts(request, env);
    if (url.pathname.startsWith('/cloud/v1/')) return handleWorkspace(request, env);
    if (url.pathname.startsWith('/images/v1/')) return handleImageAI(request, env, ctx);
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
