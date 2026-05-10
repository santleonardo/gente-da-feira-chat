// ============================================
// GDF Chat — Service Worker v3
// Network-first, só para assets estáticos
// ============================================

const CACHE_NAME = 'gdf-v3';

// Instalar sem pré-cachear
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Buscar — Network First, só para assets estáticos
// NÃO intercepta API calls nem páginas
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só interceptar GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // NÃO interceptar: API, auth, realtime
  if (url.pathname.startsWith('/api')) return;
  if (url.pathname.startsWith('/auth')) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Só cachear assets estáticos (JS, CSS, imagens, fonts)
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)(\?|$)/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});
