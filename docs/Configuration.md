# PWA Settings Configuration Guide

All configuration for Frappe Native is managed through the **PWA Settings** single DocType within the Frappe Desk.

Navigate to: `Desk > Frappe Native > PWA Settings`

## 1. General Settings
*   **App Name:** The primary name of your application (e.g., "ERPNext Mobile").
*   **Short Name:** A shorter version used when space is limited (max 12 chars recommended).
*   **Description:** A brief description for the app installation prompt.
*   **Start URL:** The URL the app should load when launched (default: `/app`).

## 2. Theming & Display
*   **Theme Color:** The color of the OS status bar and browser address bar.
*   **Background Color:** The color shown on the splash screen during app launch.
*   **Display Mode:** 
    *   `Standalone` (Recommended): Looks and feels like a native app.
    *   `Fullscreen`: Hides the status bar (good for kiosks/games).
    *   `Minimal UI`: Native app look with navigation controls.
    *   `Browser`: Standard browser tab experience.

## 3. Web Push Notifications
1.  Check **Enable Push Notifications**.
2.  Provide a **VAPID Subject** (an email or URL indicating who sent the notification, e.g., `mailto:admin@example.com`).
3.  Click the **Generate VAPID Keys** button. This will automatically generate and populate the `VAPID Public Key` and `VAPID Private Key` using the underlying `py-vapid` integration.
4.  *Note: Ensure your site is served over HTTPS, or Web Push will not function.*

## 4. Offline Mode
1.  Check **Enable Offline Mode**.
2.  In the `Offline DocTypes` table, add the DocTypes you want accessible without a network connection.
3.  Configure the **Sync Direction** (`download-only` or `bidirectional`).
4.  Set the **Conflict Strategy** (`server-wins`, `client-wins`, or `manual`).

## 5. Icons
Upload a `192x192` and a `512x512` PNG file to serve as the application icons on the user's home screen.
