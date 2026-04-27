// Nome do cache (mude a versão quando atualizar arquivos)
const CACHE_NAME = "gente-da-feira-v1";

// Arquivos essenciais para funcionar offline
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// INSTALAÇÃO
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache aberto");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// ATIVAÇÃO (limpa caches antigos)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Removendo cache antigo:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// FETCH (estratégia: cache primeiro, depois rede)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se tiver no cache → retorna
      if (response) {
        return response;
      }

      // Se não tiver → busca na internet
      return fetch(event.request)
        .then((networkResponse) => {
          // Opcional: salva no cache
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // fallback offline simples
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
