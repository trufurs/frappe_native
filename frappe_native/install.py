import frappe


def after_install():
	"""Create default PWA Settings after app installation."""
	if not frappe.db.exists("PWA Settings"):
		doc = frappe.new_doc("PWA Settings")
		doc.app_name = frappe.get_system_settings("app_name") or "Frappe"
		doc.short_name = doc.app_name[:12] if doc.app_name else "Frappe"
		doc.description = "Powered by Frappe Framework"
		doc.start_url = "/app"
		doc.display = "standalone"
		doc.orientation = "any"
		doc.theme_color = "#0089FF"
		doc.background_color = "#FFFFFF"
		doc.enable_pwa = 1
		doc.insert(ignore_permissions=True)
		frappe.db.commit()
