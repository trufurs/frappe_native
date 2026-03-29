# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _


@frappe.whitelist(allow_guest=True)
def get_manifest():
	"""Serve the Web App Manifest as JSON.

	This endpoint is called by the browser when it encounters
	<link rel="manifest" href="/api/method/frappe_native.api.manifest.get_manifest">
	"""
	settings = _get_pwa_settings()

	if not settings or not settings.enable_pwa:
		frappe.throw(_("PWA is not enabled"), frappe.PermissionError)

	manifest = {
		"name": settings.app_name or "Frappe",
		"short_name": settings.short_name or (settings.app_name or "Frappe")[:12],
		"description": settings.description or "",
		"start_url": settings.start_url or "/app",
		"scope": "/",
		"display": settings.display or "standalone",
		"orientation": settings.orientation or "any",
		"theme_color": settings.theme_color or "#0089FF",
		"background_color": settings.background_color or "#FFFFFF",
		"icons": _build_icons_array(settings),
		"categories": ["business", "productivity"],
		"prefer_related_applications": False,
	}

	# Set proper content type for manifest
	frappe.response["type"] = "json"
	frappe.response["http_status_code"] = 200
	return manifest


def _build_icons_array(settings):
	"""Build the icons array for the manifest from settings."""
	icons = []

	if settings.app_icon_192:
		icons.append({
			"src": settings.app_icon_192,
			"sizes": "192x192",
			"type": "image/png",
			"purpose": "any maskable",
		})

	if settings.app_icon_512:
		icons.append({
			"src": settings.app_icon_512,
			"sizes": "512x512",
			"type": "image/png",
			"purpose": "any maskable",
		})

	# If no custom icons, provide defaults using favicon
	if not icons:
		favicon = frappe.get_website_settings("favicon") or "/assets/frappe/images/frappe-favicon.svg"
		icons = [
			{
				"src": favicon,
				"sizes": "192x192",
				"type": "image/svg+xml",
			},
			{
				"src": favicon,
				"sizes": "512x512",
				"type": "image/svg+xml",
			},
		]

	return icons


def _get_pwa_settings():
	"""Get PWA Settings singleton, returns None if not found."""
	try:
		return frappe.get_single("PWA Settings")
	except Exception:
		return None


def update_website_context(context):
	"""Hook: Inject manifest link and PWA meta tags into website pages.

	This is called via the `update_website_context` hook in hooks.py
	for all website (non-desk) pages rendered through base.html.
	"""
	settings = _get_pwa_settings()
	if not settings or not settings.enable_pwa:
		return

	# Inject manifest link and PWA meta tags into the <head>
	pwa_head = _get_pwa_head_html(settings)
	context.setdefault("head_include", "")
	context["head_include"] += pwa_head


def extend_bootinfo(bootinfo):
	"""Hook: Add PWA configuration to desk boot info.

	This is called via the `extend_bootinfo` hook in hooks.py
	when the desk app loads.
	"""
	settings = _get_pwa_settings()
	if not settings or not settings.enable_pwa:
		bootinfo["frappe_native"] = {"enabled": False}
		return

	bootinfo["frappe_native"] = {
		"enabled": True,
		"manifest_url": "/api/method/frappe_native.api.manifest.get_manifest",
		"push_enabled": bool(settings.enable_push_notifications),
		"vapid_public_key": settings.vapid_public_key or "",
		"offline_enabled": bool(settings.enable_offline_mode),
		"theme_color": settings.theme_color or "#0089FF",
	}


def _get_pwa_head_html(settings):
	"""Generate HTML to inject into <head> for PWA support."""
	html_parts = [
		'<link rel="manifest" href="/api/method/frappe_native.api.manifest.get_manifest">',
		f'<meta name="theme-color" content="{settings.theme_color or "#0089FF"}">',
		'<meta name="apple-mobile-web-app-capable" content="yes">',
		'<meta name="apple-mobile-web-app-status-bar-style" content="default">',
		f'<meta name="apple-mobile-web-app-title" content="{settings.app_name or "Frappe"}">',
	]

	if settings.app_icon_192:
		html_parts.append(f'<link rel="apple-touch-icon" href="{settings.app_icon_192}">')

	return "\n".join(html_parts)


def has_app_permission():
	"""Permission check for the apps screen entry."""
	return "System Manager" in frappe.get_roles()
