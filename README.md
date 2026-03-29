# Frappe Native

> 🚀 World-class offline-first Progressive Web App (PWA) for Frappe Framework

Transform any Frappe/ERPNext site into a **true installable web app** with offline capabilities, push notifications, and Android packaging — no configuration required.

## ✨ Features

| Feature | Description |
|---|---|
| 📱 **Installable PWA** | "Add to Home Screen" prompt on mobile and desktop browsers |
| ⚡ **Smart Caching** | Multi-strategy service worker: cache-first for assets, network-first for APIs |
| 📴 **Offline Mode** | View and create documents while offline with IndexedDB storage |
| 🔔 **Push Notifications** | Real-time browser push notifications integrated with Frappe's notification system |
| 🔄 **Background Sync** | Queue changes offline, sync automatically when back online |
| ⚔️ **Conflict Resolution** | Visual diff dialog for sync conflicts with server-wins/client-wins/manual options |
| 🤖 **Android Packaging** | TWA (Trusted Web Activity) support for publishing to Google Play Store |
| 🎨 **Dynamic Manifest** | Configure app name, icons, colors, and display mode from Frappe desk |
| 🌙 **Dark Mode** | All UI components respect Frappe's dark theme |

## 📦 Installation

```bash
# Get the app
bench get-app frappe_native

# Install on your site
bench --site your-site.com install-app frappe_native

# Build assets
bench build --app frappe_native

# Migrate (creates DocTypes)
bench --site your-site.com migrate
```

## ⚙️ Configuration

1. Go to **PWA Settings** (`/app/pwa-settings`)
2. Set your app name, icons (192×192 and 512×512 PNG), and theme colors
3. Enable **Push Notifications** and click "Generate VAPID Keys"
4. Enable **Offline Mode** and select which DocTypes should work offline

## 🏗️ Architecture

```
frappe_native/
├── api/
│   ├── manifest.py     # Dynamic manifest.json + context injection
│   ├── push.py         # Web Push subscribe/unsubscribe + delivery
│   ├── offline.py      # Offline data sync + conflict resolution
│   └── twa.py          # Android TWA assetlinks.json
├── frappe_native/
│   └── doctype/
│       ├── pwa_settings/           # Main configuration (singleton)
│       ├── push_subscription/      # Browser push subscriptions
│       └── offline_doctype_config/ # Per-doctype offline settings
├── public/
│   ├── js/
│   │   ├── frappe_native.js   # SW registration, install prompt, push
│   │   └── offline_sync.js    # IndexedDB + sync queue manager
│   └── css/
│       └── frappe_native.css  # Install banner, status indicators
└── www/
    ├── sw.js           # Service Worker (multi-strategy caching)
    └── offline.html    # Offline fallback page
```

## 🔧 How It Works

### Service Worker Caching Strategies
- **Static assets** (JS, CSS, fonts): Cache-first with network fallback
- **API requests**: Network-first with cached fallback
- **Images**: Stale-while-revalidate
- **Navigation**: Network-first, offline fallback page

### Push Notifications
Hooks into Frappe's `Notification Log` DocType. When a notification is created, it's automatically sent as a Web Push to all of the user's subscribed browsers.

### Offline Sync
- Documents are cached in IndexedDB based on your per-doctype configuration
- Changes made offline are queued and synced when the connection restores
- Conflict resolution supports server-wins, client-wins, or manual merge

## 📋 Requirements

- Frappe Framework v15+
- HTTPS (required for Service Workers and Push Notifications)
- Python packages: `pywebpush`, `py-vapid` (installed automatically)

## 📄 License

MIT
