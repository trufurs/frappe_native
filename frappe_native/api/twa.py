# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

import json

import frappe


@frappe.whitelist(allow_guest=True)
def get_assetlinks():
	"""Serve /.well-known/assetlinks.json for TWA (Trusted Web Activity) verification.

	This allows Android apps built with TWA to be verified against this Frappe site.
	Configure the SHA-256 fingerprint in PWA Settings.
	"""
	settings = None
	try:
		settings = frappe.get_single("PWA Settings")
	except Exception:
		pass

	# Default empty response if not configured
	assetlinks = []

	if settings and getattr(settings, "twa_sha256_fingerprint", None):
		assetlinks = [
			{
				"relation": ["delegate_permission/common.handle_all_urls"],
				"target": {
					"namespace": "android_app",
					"package_name": getattr(settings, "twa_package_name", "com.example.app"),
					"sha256_cert_fingerprints": [settings.twa_sha256_fingerprint],
				},
			}
		]

	frappe.response["type"] = "json"
	return assetlinks
