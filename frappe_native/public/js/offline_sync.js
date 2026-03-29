/**
 * Frappe Native — Offline Data Sync Manager
 *
 * Provides IndexedDB-based offline storage and sync queue for Frappe documents.
 * Loaded alongside frappe_native.js when offline mode is enabled.
 */

(function () {
	"use strict";

	const DB_NAME = "frappe_native_offline";
	const DB_VERSION = 1;
	const SYNC_QUEUE_STORE = "sync_queue";
	const DOCS_STORE = "documents";
	const META_STORE = "sync_meta";

	class OfflineDB {
		constructor() {
			this.db = null;
		}

		async open() {
			if (this.db) return this.db;

			return new Promise((resolve, reject) => {
				const request = indexedDB.open(DB_NAME, DB_VERSION);

				request.onupgradeneeded = (event) => {
					const db = event.target.result;

					// Store for cached documents (keyed by doctype-docname)
					if (!db.objectStoreNames.contains(DOCS_STORE)) {
						const docsStore = db.createObjectStore(DOCS_STORE, { keyPath: "id" });
						docsStore.createIndex("doctype", "doctype", { unique: false });
						docsStore.createIndex("modified", "modified", { unique: false });
					}

					// Store for offline mutation queue
					if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
						const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, {
							keyPath: "id",
							autoIncrement: true,
						});
						queueStore.createIndex("timestamp", "timestamp", { unique: false });
						queueStore.createIndex("doctype", "doctype", { unique: false });
					}

					// Store for sync metadata (last sync timestamps)
					if (!db.objectStoreNames.contains(META_STORE)) {
						db.createObjectStore(META_STORE, { keyPath: "key" });
					}
				};

				request.onsuccess = (event) => {
					this.db = event.target.result;
					resolve(this.db);
				};

				request.onerror = (event) => {
					reject(event.target.error);
				};
			});
		}

		async putDocument(doctype, docname, data) {
			const db = await this.open();
			const tx = db.transaction(DOCS_STORE, "readwrite");
			const store = tx.objectStore(DOCS_STORE);

			store.put({
				id: `${doctype}::${docname}`,
				doctype: doctype,
				docname: docname,
				data: data,
				modified: data.modified || new Date().toISOString(),
				cached_at: new Date().toISOString(),
			});

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async getDocument(doctype, docname) {
			const db = await this.open();
			const tx = db.transaction(DOCS_STORE, "readonly");
			const store = tx.objectStore(DOCS_STORE);
			const request = store.get(`${doctype}::${docname}`);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result?.data || null);
				request.onerror = () => reject(request.error);
			});
		}

		async getDocuments(doctype) {
			const db = await this.open();
			const tx = db.transaction(DOCS_STORE, "readonly");
			const store = tx.objectStore(DOCS_STORE);
			const index = store.index("doctype");
			const request = index.getAll(doctype);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result.map((r) => r.data));
				request.onerror = () => reject(request.error);
			});
		}

		async deleteDocument(doctype, docname) {
			const db = await this.open();
			const tx = db.transaction(DOCS_STORE, "readwrite");
			const store = tx.objectStore(DOCS_STORE);
			store.delete(`${doctype}::${docname}`);

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async addToSyncQueue(action, doctype, docname, data = null) {
			const db = await this.open();
			const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
			const store = tx.objectStore(SYNC_QUEUE_STORE);

			store.add({
				action: action,
				doctype: doctype,
				docname: docname,
				data: data,
				client_modified: new Date().toISOString(),
				timestamp: Date.now(),
			});

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async getSyncQueue() {
			const db = await this.open();
			const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
			const store = tx.objectStore(SYNC_QUEUE_STORE);
			const request = store.getAll();

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		}

		async clearSyncQueue() {
			const db = await this.open();
			const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
			const store = tx.objectStore(SYNC_QUEUE_STORE);
			store.clear();

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async removeSyncQueueItem(id) {
			const db = await this.open();
			const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
			const store = tx.objectStore(SYNC_QUEUE_STORE);
			store.delete(id);

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async getLastSyncTime(doctype) {
			const db = await this.open();
			const tx = db.transaction(META_STORE, "readonly");
			const store = tx.objectStore(META_STORE);
			const request = store.get(`last_sync_${doctype}`);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result?.value || null);
				request.onerror = () => reject(request.error);
			});
		}

		async setLastSyncTime(doctype, timestamp) {
			const db = await this.open();
			const tx = db.transaction(META_STORE, "readwrite");
			const store = tx.objectStore(META_STORE);
			store.put({ key: `last_sync_${doctype}`, value: timestamp });

			return new Promise((resolve, reject) => {
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}

		async getSyncQueueCount() {
			const db = await this.open();
			const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
			const store = tx.objectStore(SYNC_QUEUE_STORE);
			const request = store.count();

			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		}
	}

	class SyncManager {
		constructor() {
			this.offlineDB = new OfflineDB();
			this.syncing = false;
			this.config = null;
		}

		async init() {
			try {
				const response = await fetch("/api/method/frappe_native.api.offline.get_offline_config", {
					headers: {
						"X-Frappe-CSRF-Token": frappe?.csrf_token || "",
					},
				});
				const result = await response.json();
				this.config = result.message;

				if (this.config && this.config.enabled) {
					// Initial sync
					await this.pullFromServer();
				}
			} catch (e) {
				console.log("[Frappe Native Sync] Could not load offline config:", e.message);
			}
		}

		async pullFromServer() {
			if (!this.config || !this.config.enabled || !navigator.onLine) return;

			for (const dt of this.config.doctypes) {
				try {
					const lastSync = await this.offlineDB.getLastSyncTime(dt.doctype);

					const response = await fetch("/api/method/frappe_native.api.offline.get_offline_data", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Frappe-CSRF-Token": frappe?.csrf_token || "",
						},
						body: JSON.stringify({
							doctype: dt.doctype,
							last_sync: lastSync,
						}),
					});

					const result = await response.json();
					const data = result.message;

					// Store fetched records in IndexedDB
					for (const record of data.records || []) {
						await this.offlineDB.putDocument(dt.doctype, record.name, record);
					}

					// Handle deleted records
					for (const deletedName of data.deleted || []) {
						await this.offlineDB.deleteDocument(dt.doctype, deletedName);
					}

					// Update last sync time
					if (data.sync_timestamp) {
						await this.offlineDB.setLastSyncTime(dt.doctype, data.sync_timestamp);
					}

					console.log(`[Frappe Native Sync] Pulled ${(data.records || []).length} records for ${dt.doctype}`);
				} catch (e) {
					console.error(`[Frappe Native Sync] Pull failed for ${dt.doctype}:`, e);
				}
			}
		}

		async pushToServer() {
			if (!navigator.onLine || this.syncing) return;

			this.syncing = true;

			try {
				const queue = await this.offlineDB.getSyncQueue();
				if (queue.length === 0) {
					this.syncing = false;
					return;
				}

				const response = await fetch("/api/method/frappe_native.api.offline.push_offline_changes", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Frappe-CSRF-Token": frappe?.csrf_token || "",
					},
					body: JSON.stringify({
						changes: JSON.stringify(queue),
					}),
				});

				const result = await response.json();
				const syncResult = result.message;

				// Clear successfully applied items
				if (syncResult.applied && syncResult.applied.length > 0) {
					await this.offlineDB.clearSyncQueue();
				}

				// Handle conflicts
				if (syncResult.conflicts && syncResult.conflicts.length > 0) {
					this.showConflictDialog(syncResult.conflicts);
				}

				// Handle errors
				if (syncResult.errors && syncResult.errors.length > 0) {
					console.warn("[Frappe Native Sync] Some changes had errors:", syncResult.errors);
				}

				console.log(
					`[Frappe Native Sync] Push complete: ${syncResult.applied?.length || 0} applied, ${syncResult.conflicts?.length || 0} conflicts`,
				);
			} catch (e) {
				console.error("[Frappe Native Sync] Push failed:", e);
			} finally {
				this.syncing = false;
			}
		}

		async syncNow() {
			await this.pushToServer();
			await this.pullFromServer();
		}

		showConflictDialog(conflicts) {
			if (typeof frappe === "undefined" || !frappe.msgprint) return;

			for (const conflict of conflicts) {
				const dialog = new frappe.ui.Dialog({
					title: `Sync Conflict: ${conflict.doctype} — ${conflict.docname}`,
					size: "large",
					fields: [
						{
							fieldtype: "HTML",
							options: `
								<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
									<div>
										<h6 style="color:var(--blue-500);">Your Changes (Offline)</h6>
										<pre style="background:var(--bg-light-gray);padding:1rem;border-radius:8px;font-size:12px;max-height:300px;overflow:auto;">
${JSON.stringify(conflict.client_data, null, 2)}
										</pre>
									</div>
									<div>
										<h6 style="color:var(--green-500);">Server Version</h6>
										<pre style="background:var(--bg-light-gray);padding:1rem;border-radius:8px;font-size:12px;max-height:300px;overflow:auto;">
${JSON.stringify(conflict.server_data, null, 2)}
										</pre>
									</div>
								</div>
							`,
						},
					],
					primary_action_label: "Keep My Changes",
					primary_action: () => {
						// Re-queue with force flag
						this.offlineDB.addToSyncQueue("update", conflict.doctype, conflict.docname, conflict.client_data);
						dialog.hide();
					},
					secondary_action_label: "Use Server Version",
					secondary_action: () => {
						// Store server version locally
						this.offlineDB.putDocument(conflict.doctype, conflict.docname, conflict.server_data);
						dialog.hide();
					},
				});
				dialog.show();
			}
		}
	}

	// Initialize when ready
	if (typeof frappe !== "undefined" && frappe.boot?.frappe_native?.offline_enabled) {
		const syncManager = new SyncManager();

		// Expose for service worker communication
		window.FrappeNativeOfflineSync = syncManager;

		// Initialize after page load
		if (document.readyState === "complete") {
			syncManager.init();
		} else {
			window.addEventListener("load", () => syncManager.init());
		}

		// Sync when coming back online
		window.addEventListener("online", () => {
			setTimeout(() => syncManager.syncNow(), 1000);
		});
	}
})();
