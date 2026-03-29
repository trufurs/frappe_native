# Step-by-Step Testing Guide

This guide will walk you through verifying every feature of **Frappe Native** on your local machine. 

> **Important:** Progressive Web Apps, especially Service Workers and Web Push Notifications, require a secure context. **You must run your local Frappe bench with HTTPS enabled**, or test on a remote staging server. `http://localhost` works for testing basic Service Worker interception, but some APIs might refuse to connect.

## Step 1: Installation & Setup

Before testing, you need to install the module on your Frappe bench site.

```bash
# Navigate to your bench folder
cd /Users/spidy/frappe/sites/erp.localhost/workspace/release_20260325_185339

# Install Frappe Native on your local site
bench --site erp.localhost install-app frappe_native

# Rebuild Node assets (compiles frappe_native.js & sw.js)
bench build --app frappe_native

# Run database migrations to install DocTypes
bench --site erp.localhost migrate
```

## Step 2: Configure PWA Settings

1. Log in to the Desk UI of your Frappe site.
2. Search for **PWA Settings** or access it from the new **Frappe Native** workspace.
3. Fill out the **App Name**, **Theme Color**, and other basic settings.
4. Check **Enable Push Notifications** and click the **Generate VAPID Keys** button (don't forget to save!)
5. Check **Enable Offline Mode** and add at least one standard Frappe doctype (e.g. `ToDo` or `Customer`) to the table. Keep Conflict Strategy as `server-wins` for now.

## Step 3: Test Chrome Installation

1. Open a new Chrome Incognito window and visit your Desk URL (e.g. `https://erp.localhost/app`).
2. Log in. Within a few seconds, look for the little "Monitor with Down Arrow" icon in the far right of your Chrome URL bar.
3. Click it and select **Install Frappe Native** (or whatever you named the app).
4. The site should break out of Chrome into a native-looking standalone window on your desktop.

## Step 4: Test Service Worker Caching

1. In your new PWA window, press **F12** to open Developer Tools.
2. Go to the **Application** tab, and click **Service Workers** on the left menu.
3. Verify that `sw.js` is shown as `Status: Activated and is running`.
4. Now, go to the **Network** tab in Dev Tools.
5. Beside the "No throttling" dropdown, change it to **Offline**.
6. Refresh the page (`Cmd+R`).
7. Result: The Frappe skeleton UI should still load immediately from the Service Worker cache! If you click on a page you haven't visited yet, the beautifully styled fallback `offline.html` page should render instead of a generic browser dinosaur.

## Step 5: Test Web Push Notifications

1. Uncheck "Offline" in the Network tab to restore your connection.
2. Ensure you have accepted the browser prompt asking "Allow erp.localhost to send notifications".
3. In Frappe Desk, create a new document that triggers an alert or assignment (for example, assign a `ToDo` to yourself).
4. **Result:** Generating a `Notification Log` in Frappe will be intercepted by `hook.py`, sent via `pywebpush`, caught by `sw.js` in the background, and rendered as a real native pop-up notification in macOS!

## Step 6: Test Data Offline Sync

1. Go to the List View of the DocType you added to the Offline Mode config (e.g. `ToDo`).
2. Disconnect your internet (Network tab -> Offline).
3. Attempt to create a new `ToDo`. The Frappe Native `offline_sync.js` manager will intercept the save!
4. Check your Dev Tools **Application -> IndexedDB**. You will see the unsaved document waiting securely in the `mutations` sync queue store.
5. Restore your internet connection.
6. The Service Worker throws a `sync` event, the IndexedDB mutations are POSTed to `api.offline.push_offline_changes`, and the document is physically saved to the MariaDB server. When you refresh, the ToDo will be there.
