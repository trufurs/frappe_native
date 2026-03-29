/**
 * Frappe Native — Main Entry Point
 *
 * Orchestrates PWA features: manifest injection, service worker registration,
 * push notification setup, offline sync, and install prompt.
 *
 * Included in both desk and website via app_include_js and web_include_js hooks.
 */

(function () {
	"use strict";

	// Wait for frappe to be ready
	if (typeof frappe === "undefined") {
		document.addEventListener("DOMContentLoaded", init);
	} else if (frappe.ready) {
		frappe.ready(init);
	} else {
		document.addEventListener("DOMContentLoaded", init);
	}

	function init() {
		const config = getConfig();
		if (!config || !config.enabled) return;

		injectManifestLink(config);
		registerServiceWorker();
		setupInstallPrompt();

		if (config.push_enabled && config.vapid_public_key) {
			setupPushNotifications(config.vapid_public_key);
		}

		if (config.offline_enabled) {
			setupOfflineIndicator();
		}
	}

	/**
	 * Get PWA configuration from boot info or meta tags
	 */
	function getConfig() {
		// Desk: config comes from bootinfo
		if (typeof frappe !== "undefined" && frappe.boot && frappe.boot.frappe_native) {
			return frappe.boot.frappe_native;
		}

		// Website: check for manifest link (injected via update_website_context)
		const manifestLink = document.querySelector('link[rel="manifest"]');
		if (manifestLink) {
			return {
				enabled: true,
				manifest_url: manifestLink.href,
				push_enabled: false,
				offline_enabled: false,
			};
		}

		return null;
	}

	/**
	 * Inject <link rel="manifest"> into the document head (for desk pages)
	 */
	function injectManifestLink(config) {
		if (document.querySelector('link[rel="manifest"]')) return;

		const link = document.createElement("link");
		link.rel = "manifest";
		link.href = config.manifest_url || "/api/method/frappe_native.api.manifest.get_manifest";
		document.head.appendChild(link);

		// Also inject theme-color meta if not present
		if (!document.querySelector('meta[name="theme-color"]') && config.theme_color) {
			const meta = document.createElement("meta");
			meta.name = "theme-color";
			meta.content = config.theme_color;
			document.head.appendChild(meta);
		}
	}

	/**
	 * Register the service worker
	 */
	function registerServiceWorker() {
		if (!("serviceWorker" in navigator)) {
			console.log("[Frappe Native] Service Worker not supported");
			return;
		}

		navigator.serviceWorker
			.register("/sw.js", { scope: "/" })
			.then((registration) => {
				console.log("[Frappe Native] Service Worker registered:", registration.scope);

				// Listen for updates
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					if (newWorker) {
						newWorker.addEventListener("statechange", () => {
							if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
								showUpdateBanner();
							}
						});
					}
				});
			})
			.catch((error) => {
				console.error("[Frappe Native] Service Worker registration failed:", error);
			});

		// Listen for messages from service worker
		navigator.serviceWorker.addEventListener("message", (event) => {
			if (event.data && event.data.type === "BACKGROUND_SYNC_TRIGGERED") {
				// Trigger sync from the offline sync module
				if (window.FrappeNativeOfflineSync) {
					window.FrappeNativeOfflineSync.syncNow();
				}
			}
		});
	}

	/**
	 * Handle the beforeinstallprompt event for install prompt
	 */
	function setupInstallPrompt() {
		let deferredPrompt = null;

		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			deferredPrompt = e;
			showInstallBanner(deferredPrompt);
		});

		window.addEventListener("appinstalled", () => {
			deferredPrompt = null;
			hideInstallBanner();
			console.log("[Frappe Native] App installed successfully!");
		});
	}

	/**
	 * Show the install prompt banner
	 */
	function showInstallBanner(deferredPrompt) {
		// Don't show if already dismissed recently
		const dismissed = localStorage.getItem("frappe_native_install_dismissed");
		if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
			return;
		}

		// Don't show if already installed
		if (window.matchMedia("(display-mode: standalone)").matches) {
			return;
		}

		// Remove existing banner if any
		hideInstallBanner();

		const banner = document.createElement("div");
		banner.id = "frappe-native-install-banner";
		banner.innerHTML = `
			<div class="fn-install-banner">
				<div class="fn-install-content">
					<div class="fn-install-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<polyline points="7 10 12 15 17 10"/>
							<line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
					</div>
					<div class="fn-install-text">
						<strong>Install App</strong>
						<span>Add to your home screen for a better experience</span>
					</div>
				</div>
				<div class="fn-install-actions">
					<button class="fn-install-btn fn-install-btn-primary" id="fn-install-accept">Install</button>
					<button class="fn-install-btn fn-install-btn-dismiss" id="fn-install-dismiss">Not now</button>
				</div>
			</div>
		`;
		document.body.appendChild(banner);

		// Animate in
		requestAnimationFrame(() => {
			banner.classList.add("fn-visible");
		});

		// Install button
		document.getElementById("fn-install-accept").addEventListener("click", async () => {
			if (!deferredPrompt) return;
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			console.log("[Frappe Native] Install prompt outcome:", outcome);
			deferredPrompt = null;
			hideInstallBanner();
		});

		// Dismiss button
		document.getElementById("fn-install-dismiss").addEventListener("click", () => {
			localStorage.setItem("frappe_native_install_dismissed", Date.now().toString());
			hideInstallBanner();
		});
	}

	function hideInstallBanner() {
		const banner = document.getElementById("frappe-native-install-banner");
		if (banner) {
			banner.classList.remove("fn-visible");
			setTimeout(() => banner.remove(), 300);
		}
	}

	/**
	 * Show update available banner
	 */
	function showUpdateBanner() {
		const banner = document.createElement("div");
		banner.id = "frappe-native-update-banner";
		banner.innerHTML = `
			<div class="fn-update-banner">
				<span>A new version is available</span>
				<button class="fn-install-btn fn-install-btn-primary" onclick="window.location.reload()">Refresh</button>
			</div>
		`;
		document.body.appendChild(banner);
		requestAnimationFrame(() => banner.classList.add("fn-visible"));
	}

	/**
	 * Setup push notifications
	 */
	function setupPushNotifications(vapidPublicKey) {
		if (!("PushManager" in window)) {
			console.log("[Frappe Native] Push notifications not supported");
			return;
		}

		// Check if already subscribed
		navigator.serviceWorker.ready.then(async (registration) => {
			const subscription = await registration.pushManager.getSubscription();

			if (subscription) {
				// Already subscribed, ensure server has this subscription
				sendSubscriptionToServer(subscription);
				return;
			}

			// Check notification permission
			if (Notification.permission === "granted") {
				subscribeToPush(registration, vapidPublicKey);
			} else if (Notification.permission !== "denied") {
				// Show a subtle prompt to enable notifications
				showNotificationPrompt(registration, vapidPublicKey);
			}
		});
	}

	function showNotificationPrompt(registration, vapidPublicKey) {
		// Only show if not dismissed recently
		const dismissed = localStorage.getItem("frappe_native_push_dismissed");
		if (dismissed && Date.now() - parseInt(dismissed) < 30 * 24 * 60 * 60 * 1000) {
			return;
		}

		// Wait a bit before showing
		setTimeout(() => {
			if (typeof frappe !== "undefined" && frappe.show_alert) {
				frappe.show_alert(
					{
						message: `
							<div style="display:flex;align-items:center;gap:8px;">
								<span>🔔 Enable push notifications to stay updated</span>
								<button class="btn btn-xs btn-primary"
									onclick="window.FrappeNativeEnablePush && window.FrappeNativeEnablePush()">
									Enable
								</button>
							</div>
						`,
						indicator: "blue",
					},
					10,
				);
			}
		}, 5000);

		// Expose enable function globally
		window.FrappeNativeEnablePush = () => {
			subscribeToPush(registration, vapidPublicKey);
			localStorage.removeItem("frappe_native_push_dismissed");
		};
	}

	async function subscribeToPush(registration, vapidPublicKey) {
		try {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				localStorage.setItem("frappe_native_push_dismissed", Date.now().toString());
				return;
			}

			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
			});

			await sendSubscriptionToServer(subscription);
			console.log("[Frappe Native] Push subscription successful");
		} catch (error) {
			console.error("[Frappe Native] Push subscription failed:", error);
		}
	}

	async function sendSubscriptionToServer(subscription) {
		try {
			const browser = detectBrowser();
			const deviceType = detectDeviceType();

			await fetch("/api/method/frappe_native.api.push.subscribe", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": frappe?.csrf_token || getCookie("csrf_token"),
				},
				body: JSON.stringify({
					subscription_info: JSON.stringify(subscription.toJSON()),
					browser: browser,
					device_type: deviceType,
				}),
			});
		} catch (error) {
			console.error("[Frappe Native] Failed to send subscription to server:", error);
		}
	}

	/**
	 * Show offline/online status indicator
	 */
	function setupOfflineIndicator() {
		function updateStatus() {
			let indicator = document.getElementById("frappe-native-status");

			if (!navigator.onLine) {
				if (!indicator) {
					indicator = document.createElement("div");
					indicator.id = "frappe-native-status";
					indicator.className = "fn-status-indicator fn-status-offline";
					indicator.innerHTML = `
						<span class="fn-status-dot"></span>
						<span>Offline — changes will sync when reconnected</span>
					`;
					document.body.appendChild(indicator);
					requestAnimationFrame(() => indicator.classList.add("fn-visible"));
				}
			} else {
				if (indicator) {
					indicator.classList.remove("fn-visible");
					setTimeout(() => indicator.remove(), 300);
				}
			}
		}

		window.addEventListener("online", () => {
			updateStatus();
			// Trigger background sync if registered
			if ("serviceWorker" in navigator && "SyncManager" in window) {
				navigator.serviceWorker.ready.then((registration) => {
					registration.sync.register("frappe-native-sync");
				});
			}
		});

		window.addEventListener("offline", updateStatus);
		updateStatus();
	}

	// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────

	function urlBase64ToUint8Array(base64String) {
		const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	function detectBrowser() {
		const ua = navigator.userAgent;
		if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
		if (ua.includes("Firefox")) return "Firefox";
		if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
		if (ua.includes("Edg")) return "Edge";
		return "Unknown";
	}

	function detectDeviceType() {
		const ua = navigator.userAgent;
		if (/tablet|ipad/i.test(ua)) return "tablet";
		if (/mobile|iphone|android/i.test(ua)) return "mobile";
		return "desktop";
	}

	function getCookie(name) {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop().split(";").shift();
		return "";
	}
})();
