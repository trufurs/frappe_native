app_name = "frappe_native"
app_title = "Frappe Native"
app_publisher = "Frappe Native Contributors"
app_description = "World-class offline-first PWA for Frappe — installable web app, push notifications, offline data sync, and Android packaging"
app_email = "hello@frappe.io"
app_license = "mit"

required_apps = ["frappe"]

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "frappe_native",
		"logo": "/assets/frappe_native/images/logo.svg",
		"title": "Frappe Native",
		"route": "/app/pwa-settings",
		"has_permission": "frappe_native.api.manifest.has_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_js = "/assets/frappe_native/js/frappe_native.js"
app_include_css = "/assets/frappe_native/css/frappe_native.css"

# include js, css files in header of web template
web_include_js = "/assets/frappe_native/js/frappe_native.js"

# Inject manifest link + PWA meta into website pages
update_website_context = ["frappe_native.api.manifest.update_website_context"]

# Add PWA config to boot info for desk
extend_bootinfo = ["frappe_native.api.manifest.extend_bootinfo"]

# Installation
# ------------

after_install = "frappe_native.install.after_install"

# Document Events
# ---------------
# Hook on notification creation to trigger push notifications

doc_events = {
	"Notification Log": {
		"after_insert": "frappe_native.api.push.on_notification_created"
	}
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily_maintenance": [
		"frappe_native.api.push.cleanup_stale_subscriptions",
	],
}

# Website Route Rules
# -------------------
# Serve assetlinks.json for TWA verification

website_route_rules = [
	{"from_route": "/.well-known/assetlinks.json", "to_route": "assetlinks"},
]

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True
