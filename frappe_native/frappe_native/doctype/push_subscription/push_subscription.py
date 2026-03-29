# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class PushSubscription(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		auth_key: DF.SmallText
		browser: DF.Data | None
		device_type: DF.Literal["desktop", "mobile", "tablet"]
		endpoint: DF.SmallText
		p256dh_key: DF.SmallText
		user: DF.Link

	# end: auto-generated types
	pass
