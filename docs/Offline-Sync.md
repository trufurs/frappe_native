# Offline Data Sync Architecture

Frappe Native implements a robust offline-first architecture utilizing IndexedDB for client-side storage and a custom synchronization engine with conflict resolution.

## How It Works

1.  **Selection:** In `PWA Settings`, administrators select which DocTypes to enable for offline access.
2.  **Initial Sync:** Upon application load, the `offline_sync.js` manager fetches all records for enabled DocTypes via `/api/method/frappe_native.api.offline.get_offline_data`.
3.  **Local Storage:** Documents are stored in IndexedDB (Database: `FrappeNativeDB`, Store: `documents`).
4.  **Offline Mutations:** When the user is offline, `frappe.call` and standard form saves are intercepted via Service Worker and stored in the `mutations` store as a Sync Queue.
5.  **Reconnection:** Upon network reconnection (detected via `window.addEventListener('online')` or the Service Worker `sync` event), the Sync Queue is processed.

## Conflict Resolution Strategies

When pushing local mutations to the server (`/api/method/frappe_native.api.offline.push_offline_changes`), conflicts may arise if the document was modified on the server while the client was offline.

Frappe Native supports three configurable strategies per DocType:

*   **Server Wins (Default):** The server's version is authoritative. The client's mutation is discarded, and the local IndexedDB record is overwritten with the server's state.
*   **Client Wins:** The client's local mutation forcefully overwrites the server's version, regardless of intervening changes.
*   **Manual Merge:** The server rejects the mutation and returns a `conflict: True` payload containing both the `server_data` and `client_data`. The `offline_sync.js` manager intercepts this and displays a visual Side-by-Side Diff Dialog to the user, allowing them to explicitly choose which version to keep.

## Background Sync Cleanup

The `periodic_sync_cleanup` cron job runs every 30 minutes on the server to clean up stale conflict records and optimize the synchronization delta logs.
