# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PWASettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from frappe_native.frappe_native.doctype.offline_doctype_config.offline_doctype_config import (
			OfflineDocTypeConfig,
		)

		app_icon_192: DF.AttachImage | None
		app_icon_512: DF.AttachImage | None
		app_name: DF.Data
		background_color: DF.Color | None
		description: DF.SmallText | None
		display: DF.Literal["standalone", "fullscreen", "minimal-ui", "browser"]
		enable_offline_mode: DF.Check
		enable_push_notifications: DF.Check
		enable_pwa: DF.Check
		offline_doctypes: DF.Table[OfflineDocTypeConfig]
		orientation: DF.Literal["any", "portrait", "landscape"]
		short_name: DF.Data | None
		start_url: DF.Data | None
		theme_color: DF.Color | None
		vapid_private_key: DF.Password | None
		vapid_public_key: DF.Code | None

	# end: auto-generated types

	def validate(self):
		if self.short_name and len(self.short_name) > 12:
			frappe.throw("Short Name must be 12 characters or less")

	@frappe.whitelist()
	def generate_vapid_keys(self):
		"""Generate VAPID key pair for Web Push Notifications."""
		from frappe_native.api.push import generate_vapid_keys

		keys = generate_vapid_keys()
		self.vapid_public_key = keys["public_key"]
		self.vapid_private_key = keys["private_key"]
		self.save()
		return {"public_key": keys["public_key"]}
