// ============================================
// GDF Chat — Service Worker v2
// Network-first para tudo (nunca serve stale)
// ============================================

const CACHE_NAME = 'gdf-v2';

// Instalar — não pré-cachear nada (evita falhas)
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Ativar — limpar caches antigos imediatamente
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

// Buscar — Network First para TUDO
// Sempre busca na rede primeiro. Só usa cache se offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Não interceptar non-GET
  if (request.method !== 'GET') return;

  // Não interceptar auth ou realtime
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Se a resposta foi OK, cachear para uso offline
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se offline, tentar o cache
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});
