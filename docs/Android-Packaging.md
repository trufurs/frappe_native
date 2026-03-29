# Android TWA Packaging via Bubblewrap

Frappe Native includes native support for wrapping your PWA into a true Android `.apk` / `.aab` for publication on the Google Play Store using Trusted Web Activity (TWA).

## 1. `assetlinks.json` Verification

To publish a TWA, Android requires cryptographic proof that the developer of the app owns the website domain.

1.  Generate your App's SHA-256 fingerprint from the Play Console or your keystore.
2.  In the `PWA Settings` Frappe Desk form, find the **TWA Configuration** section.
3.  Enter your app's package name (e.g., `com.example.erpnext`) and the SHA-256 fingerprint.
4.  Frappe Native's `hooks.py` automatically routes requests for `/.well-known/assetlinks.json` to our custom endpoint. No NGINX configuration required!

## 2. Compiling with Bubblewrap

Google's Bubblewrap CLI is the easiest way to generate a TWA project.

### Prerequisites
*   Node.js v14+
*   Java Development Kit (JDK) 11+
*   Android Command Line Tools (SDK)

### Commands

**1. Initialize the wrapper**
```bash
npx @google/bubblewrap init --manifest="https://your-frappe-site.com/api/method/frappe_native.api.manifest.get_manifest"
```
*Bubblewrap will read your PWA manifest, download your icons, and prompt for keystore creation.*

**2. Build the `.apk` or `.aab`**
```bash
npx @google/bubblewrap build
```

The resulting `app-release-bundle.aab` can be uploaded directly to the Google Play Console!

## Benefits of TWA over standard PWA

1.  **Play Store Discoverability:** Users can search and download your Frappe site just like a native app.
2.  **No Browser UI:** The ugly Chrome URL bar is permanently hidden.
3.  **Monetization:** Access to Play Billing API.
4.  **Performance:** Same JS/Offline caching execution speeds as standard Chrome, but fully integrated into Android's recents menu.
