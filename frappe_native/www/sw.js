/*
 * Frappe Native — Service Worker
 * Multi-strategy caching for offline-first PWA experience
 *
 * Caching strategies:
 * - Static assets (JS, CSS, fonts): Cache-first
 * - API calls: Network-first with cache fallback
 * - Images: Stale-while-revalidate
 * - Navigation: Network-first, offline fallback page
 */

const CACHE_VERSION = "frappe-native-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to pre-cache during install
const PRECACHE_URLS = ["/offline"];

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
						.filter((name) => name.startsWith("frappe-native-") && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
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

	// Skip socket.io and realtime requests
	if (url.pathname.startsWith("/socket.io")) return;

	// Route to appropriate strategy
	if (isStaticAsset(url)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE));
	} else if (isAPIRequest(url)) {
		event.respondWith(networkFirst(request, API_CACHE));
	} else if (isImageRequest(url, request)) {
		event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
	} else if (isNavigationRequest(request)) {
		event.respondWith(navigationHandler(request));
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
		data: {
			url: data.url || "/app",
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

	event.waitUntil(self.registration.showNotification(data.title || "Frappe", options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	if (event.action === "dismiss") return;

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
});

// ─── BACKGROUND SYNC ─────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
	if (event.tag === "frappe-native-sync") {
		event.waitUntil(doBackgroundSync());
	}
});

async function doBackgroundSync() {
	// Notify the client to perform sync
	const allClients = await clients.matchAll();
	for (const client of allClients) {
		client.postMessage({
			type: "BACKGROUND_SYNC_TRIGGERED",
		});
	}
}

// ─── CACHING STRATEGIES ─────────────────────────────────────────────────────

/**
 * Cache-first: Try cache, fall back to network. Updates cache in background.
 * Best for: static assets (JS, CSS, fonts)
 */
async function cacheFirst(request, cacheName) {
	const cached = await caches.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(cacheName);
			cache.put(request, response.clone());
		}
		return response;
	} catch (e) {
		return new Response("Offline", { status: 503 });
	}
}

/**
 * Network-first: Try network, fall back to cache.
 * Best for: API calls, dynamic content
 */
async function networkFirst(request, cacheName) {
	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(cacheName);
			cache.put(request, response.clone());
		}
		return response;
	} catch (e) {
		const cached = await caches.match(request);
		if (cached) return cached;
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
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);

	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) {
				cache.put(request, response.clone());
			}
			return response;
		})
		.catch(() => cached);

	return cached || fetchPromise;
}

/**
 * Navigation handler: Network-first, fall back to offline page.
 */
async function navigationHandler(request) {
	try {
		const response = await fetch(request);
		return response;
	} catch (e) {
		const cached = await caches.match(request);
		if (cached) return cached;

		// Serve offline fallback page
		const offlinePage = await caches.match("/offline");
		if (offlinePage) return offlinePage;

		return new Response(
			"<html><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>",
			{ headers: { "Content-Type": "text/html" } },
		);
	}
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
