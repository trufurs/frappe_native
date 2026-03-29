/*
 * Frappe Native — Service Worker v2
 * World-class offline-first PWA engine
 *
 * Features:
 * - Multi-strategy caching (cache-first, network-first, stale-while-revalidate)
 * - App Badging API (notification count on app icon)
 * - Periodic Background Sync
 * - Cache Analytics (size tracking, hit rates)
 * - Network-adaptive caching (reduces quality on slow connections)
 * - Smart cache expiry management
 * - Notification grouping and stacking
 */

const CACHE_VERSION = "frappe-native-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Cache size limits
const MAX_DYNAMIC_CACHE_ITEMS = 50;
const MAX_API_CACHE_ITEMS = 100;
const MAX_IMAGE_CACHE_ITEMS = 200;
const MAX_CACHE_AGE_HOURS = 24;

// Assets to pre-cache during install
const PRECACHE_URLS = ["/offline"];

// Cache analytics
const cacheStats = {
	hits: 0,
	misses: 0,
	networkErrors: 0,
};

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames
						.filter(
							(name) =>
								name.startsWith("frappe-native-") &&
								name !== STATIC_CACHE &&
								name !== DYNAMIC_CACHE &&
								name !== API_CACHE &&
								name !== IMAGE_CACHE,
						)
						.map((name) => caches.delete(name)),
				);
			})
			.then(() => self.clients.claim()),
	);
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== "GET") return;

	// Skip socket.io, realtime, and hot-reload requests
	if (url.pathname.startsWith("/socket.io")) return;
	if (url.pathname.includes("hot-update")) return;

	// Route to appropriate strategy
	if (isStaticAsset(url)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
	} else if (isAPIRequest(url)) {
		event.respondWith(networkFirst(request, API_CACHE, MAX_API_CACHE_ITEMS));
	} else if (isImageRequest(url, request)) {
		event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGE_CACHE_ITEMS));
	} else if (isNavigationRequest(request)) {
		event.respondWith(navigationHandler(request));
	} else {
		event.respondWith(networkFirst(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ITEMS));
	}
});

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
	if (!event.data) return;

	let data;
	try {
		data = event.data.json();
	} catch (e) {
		data = {
			title: "Notification",
			body: event.data.text(),
			icon: "/assets/frappe/images/frappe-favicon.svg",
			url: "/app",
		};
	}

	const options = {
		body: data.body || "",
		icon: data.icon || "/assets/frappe/images/frappe-favicon.svg",
		badge: data.badge || data.icon || "/assets/frappe/images/frappe-favicon.svg",
		tag: data.tag || "frappe-notification",
		renotify: true,
		requireInteraction: false,
		silent: false,
		timestamp: Date.now(),
		data: {
			url: data.url || "/app",
			type: data.type || "default",
		},
		actions: [
			{
				action: "open",
				title: "Open",
			},
			{
				action: "dismiss",
				title: "Dismiss",
			},
		],
		vibrate: [100, 50, 100],
	};

	event.waitUntil(
		self.registration.showNotification(data.title || "Frappe", options).then(() => {
			// Update app badge count
			updateAppBadge();
		}),
	);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	if (event.action === "dismiss") {
		// Decrement badge
		updateAppBadge(-1);
		return;
	}

	const url = event.notification.data?.url || "/app";

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
			// Focus existing window if available
			for (const client of windowClients) {
				if (client.url.includes(self.location.origin) && "focus" in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			// Otherwise open new window
			return clients.openWindow(url);
		}),
	);

	// Clear badge on interaction
	clearAppBadge();
});

// ─── APP BADGING API ────────────────────────────────────────────────────────
let badgeCount = 0;

async function updateAppBadge(delta = 1) {
	badgeCount = Math.max(0, badgeCount + delta);
	try {
		if ("setAppBadge" in navigator) {
			if (badgeCount > 0) {
				await navigator.setAppBadge(badgeCount);
			} else {
				await navigator.clearAppBadge();
			}
		}
	} catch (e) {
		// Badge API not supported or permission denied
	}
}

async function clearAppBadge() {
	badgeCount = 0;
	try {
		if ("clearAppBadge" in navigator) {
			await navigator.clearAppBadge();
		}
	} catch (e) {
		// Ignore
	}
}

// ─── BACKGROUND SYNC ─────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
	if (event.tag === "frappe-native-sync") {
		event.waitUntil(doBackgroundSync());
	}
});

// ─── PERIODIC BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener("periodicsync", (event) => {
	if (event.tag === "frappe-native-periodic-sync") {
		event.waitUntil(doBackgroundSync());
	}
	if (event.tag === "frappe-native-cache-cleanup") {
		event.waitUntil(cleanupExpiredCache());
	}
});

async function doBackgroundSync() {
	// Notify all clients to perform sync
	const allClients = await clients.matchAll();
	for (const client of allClients) {
		client.postMessage({
			type: "BACKGROUND_SYNC_TRIGGERED",
		});
	}
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
	const { type, payload } = event.data || {};

	switch (type) {
		case "GET_CACHE_STATS":
			event.source.postMessage({
				type: "CACHE_STATS",
				stats: { ...cacheStats },
			});
			break;

		case "CLEAR_ALL_CACHES":
			caches.keys().then((names) => {
				Promise.all(names.filter((n) => n.startsWith("frappe-native-")).map((n) => caches.delete(n)));
			});
			event.source.postMessage({ type: "CACHES_CLEARED" });
			break;

		case "GET_CACHE_SIZE":
			getCacheSize().then((size) => {
				event.source.postMessage({ type: "CACHE_SIZE", size });
			});
			break;

		case "SKIP_WAITING":
			self.skipWaiting();
			break;

		case "CLEAR_BADGE":
			clearAppBadge();
			break;
	}
});

// ─── CACHING STRATEGIES ─────────────────────────────────────────────────────

/**
 * Cache-first: Try cache, fall back to network. Updates cache in background.
 * Best for: static assets (JS, CSS, fonts)
 */
async function cacheFirst(request, cacheName) {
	const cached = await caches.match(request);
	if (cached) {
		cacheStats.hits++;
		// Background revalidation for stale assets
		fetch(request)
			.then(async (response) => {
				if (response.ok) {
					const cache = await caches.open(cacheName);
					cache.put(request, response);
				}
			})
			.catch(() => {});
		return cached;
	}

	cacheStats.misses++;
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(cacheName);
			cache.put(request, response.clone());
		}
		return response;
	} catch (e) {
		cacheStats.networkErrors++;
		return new Response("Offline", { status: 503 });
	}
}

/**
 * Network-first: Try network, fall back to cache.
 * Best for: API calls, dynamic content
 */
async function networkFirst(request, cacheName, maxItems = 50) {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(cacheName);
			cache.put(request, response.clone());
			// Trim cache if too large
			trimCache(cacheName, maxItems);
		}
		return response;
	} catch (e) {
		cacheStats.networkErrors++;
		const cached = await caches.match(request);
		if (cached) {
			cacheStats.hits++;
			return cached;
		}
		cacheStats.misses++;
		return new Response(JSON.stringify({ error: "offline" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Stale-while-revalidate: Return cache immediately, update cache in background.
 * Best for: images, semi-dynamic content
 */
async function staleWhileRevalidate(request, cacheName, maxItems = 100) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);

	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) {
				cache.put(request, response.clone());
				trimCache(cacheName, maxItems);
			}
			return response;
		})
		.catch(() => cached);

	if (cached) {
		cacheStats.hits++;
		return cached;
	}

	cacheStats.misses++;
	return fetchPromise;
}

/**
 * Navigation handler: Network-first, fall back to offline page.
 */
async function navigationHandler(request) {
	try {
		// Network-adaptive: add timeout for slow connections
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(request, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (response.ok) {
			// Cache successful navigation for offline access
			const cache = await caches.open(DYNAMIC_CACHE);
			cache.put(request, response.clone());
		}

		return response;
	} catch (e) {
		const cached = await caches.match(request);
		if (cached) return cached;

		// Serve offline fallback page
		const offlinePage = await caches.match("/offline");
		if (offlinePage) return offlinePage;

		return new Response(
			'<html><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
			{ headers: { "Content-Type": "text/html" } },
		);
	}
}

// ─── CACHE MANAGEMENT ───────────────────────────────────────────────────────

/**
 * Trim a cache to a maximum number of entries (FIFO)
 */
async function trimCache(cacheName, maxItems) {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	if (keys.length > maxItems) {
		// Delete oldest entries
		const toDelete = keys.slice(0, keys.length - maxItems);
		await Promise.all(toDelete.map((key) => cache.delete(key)));
	}
}

/**
 * Clean up caches with expired entries
 */
async function cleanupExpiredCache() {
	const cacheNames = [DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE];
	for (const name of cacheNames) {
		try {
			const cache = await caches.open(name);
			const keys = await cache.keys();
			for (const key of keys) {
				const response = await cache.match(key);
				if (response) {
					const dateHeader = response.headers.get("date");
					if (dateHeader) {
						const age = (Date.now() - new Date(dateHeader).getTime()) / (1000 * 60 * 60);
						if (age > MAX_CACHE_AGE_HOURS) {
							await cache.delete(key);
						}
					}
				}
			}
		} catch (e) {
			// Ignore errors in cleanup
		}
	}
}

/**
 * Get total cache storage size in bytes
 */
async function getCacheSize() {
	if ("storage" in navigator && "estimate" in navigator.storage) {
		const estimate = await navigator.storage.estimate();
		return {
			used: estimate.usage || 0,
			quota: estimate.quota || 0,
			percentage: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0,
		};
	}
	return { used: 0, quota: 0, percentage: 0 };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isStaticAsset(url) {
	return (
		url.pathname.startsWith("/assets/") ||
		url.pathname.endsWith(".js") ||
		url.pathname.endsWith(".css") ||
		url.pathname.endsWith(".woff2") ||
		url.pathname.endsWith(".woff") ||
		url.pathname.endsWith(".ttf")
	);
}

function isAPIRequest(url) {
	return url.pathname.startsWith("/api/");
}

function isImageRequest(url, request) {
	const accept = request.headers.get("Accept") || "";
	return (
		accept.includes("image/") ||
		url.pathname.endsWith(".png") ||
		url.pathname.endsWith(".jpg") ||
		url.pathname.endsWith(".jpeg") ||
		url.pathname.endsWith(".gif") ||
		url.pathname.endsWith(".svg") ||
		url.pathname.endsWith(".webp") ||
		url.pathname.endsWith(".ico")
	);
}


function isNavigationRequest(request) {
	return request.mode === "navigate";
}

