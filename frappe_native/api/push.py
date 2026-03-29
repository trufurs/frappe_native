# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _


@frappe.whitelist()
def subscribe(subscription_info: str, browser: str = "", device_type: str = "desktop"):
	"""Store a browser push subscription for the current user.

	Args:
		subscription_info: JSON string with { endpoint, keys: { p256dh, auth } }
		browser: Browser name (Chrome, Firefox, etc.)
		device_type: One of desktop, mobile, tablet
	"""
	info = json.loads(subscription_info)

	endpoint = info.get("endpoint")
	keys = info.get("keys", {})
	p256dh = keys.get("p256dh")
	auth = keys.get("auth")

	if not all([endpoint, p256dh, auth]):
		frappe.throw(_("Invalid subscription info"))

	# Check if this endpoint already exists
	existing = frappe.db.exists("Push Subscription", {"endpoint": endpoint})

	if existing:
		# Update existing subscription
		doc = frappe.get_doc("Push Subscription", existing)
		doc.p256dh_key = p256dh
		doc.auth_key = auth
		doc.browser = browser
		doc.device_type = device_type
		doc.user = frappe.session.user
		doc.save(ignore_permissions=True)
	else:
		# Create new subscription
		doc = frappe.new_doc("Push Subscription")
		doc.user = frappe.session.user
		doc.endpoint = endpoint
		doc.p256dh_key = p256dh
		doc.auth_key = auth
		doc.browser = browser
		doc.device_type = device_type
		doc.insert(ignore_permissions=True)

	frappe.db.commit()
	return {"status": "ok"}


@frappe.whitelist()
def unsubscribe(endpoint: str):
	"""Remove a push subscription by endpoint."""
	existing = frappe.db.exists("Push Subscription", {"endpoint": endpoint, "user": frappe.session.user})
	if existing:
		frappe.delete_doc("Push Subscription", existing, ignore_permissions=True)
		frappe.db.commit()
	return {"status": "ok"}


def generate_vapid_keys() -> dict:
	"""Generate a VAPID key pair for Web Push.

	Returns:
		dict with 'public_key' and 'private_key' (base64url encoded)
	"""
	try:
		from py_vapid import Vapid

		vapid = Vapid()
		vapid.generate_keys()

		return {
			"public_key": vapid.public_key_urlsafe_base64(),
			"private_key": vapid.private_key_urlsafe_base64(),
		}
	except ImportError:
		frappe.throw(
			_("py-vapid package is required for push notifications. Install it with: pip install py-vapid"),
			title=_("Missing Dependency"),
		)


def on_notification_created(doc, method):
	"""Hook: Called after a Notification Log is created.

	Sends a Web Push notification to all of the target user's subscriptions.
	"""
	settings = _get_pwa_settings()
	if not settings or not settings.enable_push_notifications:
		return

	if not settings.vapid_public_key or not settings.vapid_private_key:
		return

	# Get the target user
	user = doc.for_user
	if not user:
		return

	# Enqueue the push notification sending to background
	frappe.enqueue(
		"frappe_native.api.push.send_push_to_user",
		user=user,
		title=_get_notification_title(doc),
		body=_get_notification_body(doc),
		url=_get_notification_url(doc),
		icon=_get_notification_icon(settings),
		now=frappe.flags.in_test,
	)


def send_push_to_user(user: str, title: str, body: str, url: str = "/app", icon: str = ""):
	"""Send push notification to all of a user's subscriptions."""
	subscriptions = frappe.get_all(
		"Push Subscription",
		filters={"user": user},
		fields=["endpoint", "p256dh_key", "auth_key", "name"],
	)

	if not subscriptions:
		return

	settings = frappe.get_single("PWA Settings")
	vapid_private_key = settings.get_password("vapid_private_key")

	if not vapid_private_key:
		return

	payload = json.dumps({
		"title": title,
		"body": body,
		"icon": icon,
		"url": url,
		"badge": icon,
		"tag": f"frappe-notification-{frappe.utils.now_datetime().timestamp()}",
	})

	vapid_claims = {
		"sub": f"mailto:{settings.owner or 'admin@example.com'}",
	}

	stale_subscriptions = []

	for sub in subscriptions:
		try:
			from pywebpush import webpush, WebPushException

			webpush(
				subscription_info={
					"endpoint": sub.endpoint,
					"keys": {
						"p256dh": sub.p256dh_key,
						"auth": sub.auth_key,
					},
				},
				data=payload,
				vapid_private_key=vapid_private_key,
				vapid_claims=vapid_claims,
			)
		except Exception as e:
			# If the subscription is expired/invalid (410 Gone or 404), mark for cleanup
			error_str = str(e)
			if "410" in error_str or "404" in error_str or "expired" in error_str.lower():
				stale_subscriptions.append(sub.name)
			else:
				frappe.log_error(f"Push notification failed for {sub.endpoint}: {e}")

	# Clean up stale subscriptions
	for sub_name in stale_subscriptions:
		frappe.delete_doc("Push Subscription", sub_name, ignore_permissions=True, force=True)

	if stale_subscriptions:
		frappe.db.commit()


def cleanup_stale_subscriptions():
	"""Scheduled task: Remove push subscriptions older than 90 days without activity."""
	from frappe.query_builder import Interval
	from frappe.query_builder.functions import Now

	table = frappe.qb.DocType("Push Subscription")
	frappe.db.delete(table, filters=(table.modified < (Now() - Interval(days=90))))


def _get_pwa_settings():
	"""Get PWA Settings singleton."""
	try:
		return frappe.get_single("PWA Settings")
	except Exception:
		return None


def _get_notification_title(doc):
	"""Extract a title from the notification log document."""
	type_map = {
		"Mention": _("New Mention"),
		"Assignment": _("Assignment"),
		"Share": _("Document Shared"),
		"Energy Point": _("Energy Points"),
		"Alert": _("Alert"),
	}
	return type_map.get(doc.type, _("Notification"))


def _get_notification_body(doc):
	"""Extract body text from the notification log document."""
	from frappe.utils import strip_html

	if doc.subject:
		return strip_html(doc.subject)[:200]
	return _("You have a new notification")


def _get_notification_url(doc):
	"""Build the URL to navigate to when clicking the notification."""
	if doc.link:
		return doc.link
	if doc.document_type and doc.document_name:
		return f"/app/{frappe.scrub(doc.document_type).replace('_', '-')}/{doc.document_name}"
	return "/app"


def _get_notification_icon(settings):
	"""Get the notification icon URL."""
	return settings.app_icon_192 or "/assets/frappe/images/frappe-favicon.svg"
