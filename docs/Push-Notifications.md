# Web Push Notifications Architecture

Frappe Native provides seamless, real-time push notifications integrated deeply with the Frappe Framework's routing and event system.

## Server-Side Implementation

1.  **VAPID Key Generation:** Managed securely within the `PWA Settings` interface via the `py-vapid` library.
2.  **Notification Log Integration:** `hooks.py` registers the `doc_events` trigger `NotificationLog.after_insert`. Every time a standard Frappe notification is created, Frappe Native intercepts it.
3.  **Delivery Pipeline:**
    *   `api.push.on_notification_created` acts as the trigger.
    *   It queries the `Push Subscription` DocType for all active browser subscriptions linked to the `for_user`.
    *   It utilizes `pywebpush` to encrypt and dispatch the payload directly to the browser vendors' push services (FCM, Mozilla Autopush, Apple Push).
4.  **Stale Subscription Cleanup:** The `daily_maintenance` scheduler task automatically purges subscriptions that have expired or throw `410 Gone` HTTP errors from the push service.

## Client-Side Implementation

1.  **Permission Request:** `frappe_native.js` gracefully requests notification permissions from the user.
2.  **Subscription Generation:** Upon approval, it creates a `PushSubscription` object using the VAPID Public Key and sends it to `/api/method/frappe_native.api.push.subscribe`.
3.  **Service Worker (`sw.js`):**
    *   The `push` event listener catches the incoming encrypted payload.
    *   It triggers `self.registration.showNotification` to display the native OS alert.
    *   *App Badging:* If supported, it increments the App Badge count using the `navigator.setAppBadge` API.
    *   The `notificationclick` event listener handles user interactions (opening the app, focusing an existing tab, or dismissing the notification to decrement the App Badge).
