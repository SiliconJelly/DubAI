// Service Worker for DubAI Frontend
// Provides offline functionality and caching

const CACHE_NAME = 'dubai-v1.0.0';
const STATIC_CACHE_NAME = 'dubai-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'dubai-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/hero-bg.jpg',
  // Add other static assets as needed
];

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/jobs',
  '/api/users/profile',
  '/api/users/stats',
  '/api/health'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleOtherRequest(request));
  }
});

// Check if request is for static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/assets/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.jpeg') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.ico') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2');
}

// Check if request is for API
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

// Check if request is navigation
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Handle static assets - Cache First strategy
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static asset fetch failed', error);
    // Return cached version if available
    return caches.match(request);
  }
}

// Handle API requests - Network First with cache fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses for specific endpoints
      if (isCacheableApi(url.pathname)) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone();
      response.headers.set('X-Served-By', 'service-worker-cache');
      return response;
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: API request failed', error);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      const response = cachedResponse.clone();
      response.headers.set('X-Served-By', 'service-worker-cache');
      response.headers.set('X-Cache-Status', 'offline');
      return response;
    }
    
    // Return offline response for specific endpoints
    if (url.pathname === '/api/jobs') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          jobs: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false }
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Served-By': 'service-worker-offline',
          'X-Cache-Status': 'offline'
        }
      });
    }
    
    throw error;
  }
}

// Handle navigation requests - Network First with offline fallback
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Navigation request failed', error);
    
    // Serve cached index.html for SPA routing
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DubAI - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f8fafc;
              color: #334155;
            }
            .container {
              text-align: center;
              padding: 2rem;
              max-width: 400px;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              margin: 0 0 1rem 0;
              font-size: 1.5rem;
              font-weight: 600;
            }
            p {
              margin: 0 0 2rem 0;
              color: #64748b;
              line-height: 1.5;
            }
            button {
              background: #3b82f6;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 0.5rem;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.2s;
            }
            button:hover {
              background: #2563eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📡</div>
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle other requests - Network First
async function handleOtherRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Check if API endpoint should be cached
function isCacheableApi(pathname) {
  return CACHEABLE_APIS.some(api => pathname.startsWith(api));
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-jobs') {
    event.waitUntil(syncFailedRequests());
  }
});

// Sync failed requests when back online
async function syncFailedRequests() {
  try {
    // Get failed requests from IndexedDB or localStorage
    // This would be implemented based on your offline queue strategy
    console.log('Service Worker: Syncing failed requests...');
    
    // Notify clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Service Worker: Failed to sync requests', error);
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_JOB_DATA':
      cacheJobData(payload);
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
      
    default:
      console.log('Service Worker: Unknown message type', type);
  }
});

// Cache job data for offline access
async function cacheJobData(jobData) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const response = new Response(JSON.stringify(jobData), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`/api/jobs/${jobData.id}`, response);
    console.log('Service Worker: Cached job data', jobData.id);
  } catch (error) {
    console.error('Service Worker: Failed to cache job data', error);
  }
}

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Service Worker: All caches cleared');
  } catch (error) {
    console.error('Service Worker: Failed to clear caches', error);
  }
}

// Get cache status
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = keys.length;
    }
    
    return status;
  } catch (error) {
    console.error('Service Worker: Failed to get cache status', error);
    return {};
  }
}

console.log('Service Worker: Script loaded');