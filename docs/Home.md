# Frappe Native Wiki

Welcome to the **Frappe Native** documentation wiki. Frappe Native is a world-class, offline-first Progressive Web App (PWA) engine designed to transform your Frappe/ERPNext site into a seamless, installable desktop and mobile application.

## Table of Contents

1. [Configuration & Setup](Configuration.md)
2. [Service Worker v2 & Advanced Caching](Service-Worker.md)
3. [Offline Sync & Conflict Resolution](Offline-Sync.md)
4. [Web Push Notifications](Push-Notifications.md)
5. [Android TWA Packaging](Android-Packaging.md)

## Core Architecture

Frappe Native is built with a separation of concerns that deeply integrates with Frappe's existing architecture:

*   **PWA Settings (DocType):** Centralized configuration accessible from the Desk (`/app/pwa-settings`). Controlsmanifest, themes, icons, and toggles for offline/push capabilities.
*   **Dynamic Manifest (`api/manifest.py`):** Dynamically generated `manifest.json` injected into both the Desk (`app.html`) and website pages (`base.html`), ensuring complete app installability across the platform.
*   **Service Worker v2 (`www/sw.js`):** The brain of the application. Features multi-strategy caching, network-adaptive navigation, App Badging API, and periodic background sync.
*   **IndexedDB Manager (`offline_sync.js`):** Client-side storage engine handling mutation queues and transparent conflict resolution dialogs.
*   **Push Subscription (`push.py`):** Server-side Web Push implementation utilizing `pywebpush` and `py-vapid`, hooked directly into `NotificationLog.after_insert`.

### Directory Structure

```text
frappe_native/
├── api/                   # Server-side business logic (sync, push, twa)
├── docs/                  # This wiki documentation
├── frappe_native/
│   └── doctype/          # Core abstractions (PWA Settings, Push Subscriptions)
├── public/               # Client-side implementations
│   ├── js/frappe_native.js # PWA Bootstrapper and Push Manager
│   └── js/offline_sync.js  # IndexedDB Sync Manager
└── www/                  # Service worker and fallback pages
    ├── sw.js             # Service Worker v2 Engine
    └── offline.html      # Network failure fallback
```

---

*For contributions and bug reports, please visit the main GitHub repository.*
