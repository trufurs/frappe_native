# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class OfflineDocTypeConfig(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		conflict_strategy: DF.Literal["server-wins", "client-wins", "manual"]
		doctype_name: DF.Link
		max_records: DF.Int
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		sync_direction: DF.Literal["bidirectional", "download-only"]

	# end: auto-generated types
	pass
