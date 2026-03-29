# Service Worker v2 Engine

Frappe Native implements a highly optimized, multi-strategy Service Worker v2 designed for real-world Progressive Web Applications. It guarantees offline resilience, network adaptability, and immediate load times.

## 1. Multi-Strategy Caching Architecture

The Service Worker (`sw.js`) intercepts all network requests and intelligently routes them based on content type:

| Content Type | Strategy | Implementation logic |
| :--- | :--- | :--- |
| **Static Assets** (`.js`, `.css`, `.woff2`) | **Cache-First** | Returns cached version immediately. Revalidates from network in background and updates cache silently. |
| **API Endpoints** (`/api/*`) | **Network-First** | Attempts network fetch. Falls back to API Cache if offline, returning the smartest recent payload. |
| **Images** (`.png`, `.jpg`, `.svg`) | **Stale-While-Revalidate** | Immediate cache render for speed, downloads new image in the background, minimizing UI block. |
| **Html Navigational** (Pages) | **Network-Adaptive** | Strict 5s timeout fetch. Falls back to Dynamic Cache. If both fail, serves `offline.html`. |

## 2. Advanced Cache Management & Analytics

Frappe Native v2 guarantees it won't consume infinite device storage:

*   **FIFO Caching limits:** API requests limit at 100 entries, Images at 200, Dynamic Navigational at 50 entries.
*   **Periodic Purge:** A `periodicsync` background event (`frappe-native-cache-cleanup`) automatically purges any cached document older than 24 hours.
*   **Analytics Tracking:** Intercepted requests are counted (`hits`, `misses`, `networkErrors`) and can be reported to the `PWA Settings` Dashboard via `postMessage`.

## 3. Network-Adaptive Fallbacks

For weak "lie-fi" connections, the `navigationHandler` enforces a strict 5-second `AbortController` timeout on HTML fetches. Instead of presenting a blank screen for 30 seconds while the browser waits for a 2G network to respond, Frappe Native automatically aborts after 5s and serves the cached page or the `offline.html` fallback.

## 4. App Badging & Notification Management

Frappe Native abstracts notification clutter:
*   Incoming pushed notifications instantly trigger `navigator.setAppBadge()` to display unread counts right on the Android/iOS home screen.
*   Clicking "Dismiss" explicitly decrements the badge count via Service Worker events without waking the main thread.
