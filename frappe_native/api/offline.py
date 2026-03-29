# Copyright (c) 2026, Frappe Native Contributors and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _


@frappe.whitelist()
def get_offline_config():
	"""Return the list of doctypes configured for offline access.

	Returns a list of dicts with doctype name, sync settings, and field metadata.
	"""
	settings = frappe.get_single("PWA Settings")

	if not settings.enable_offline_mode:
		return {"enabled": False, "doctypes": []}

	doctypes = []
	for row in settings.offline_doctypes:
		meta = frappe.get_meta(row.doctype_name)
		fields = [
			{
				"fieldname": f.fieldname,
				"fieldtype": f.fieldtype,
				"label": f.label,
				"reqd": f.reqd,
				"options": f.options,
			}
			for f in meta.fields
			if f.fieldtype not in ("Section Break", "Column Break", "Tab Break", "HTML", "Button")
		]

		doctypes.append({
			"doctype": row.doctype_name,
			"sync_direction": row.sync_direction,
			"max_records": row.max_records or 100,
			"conflict_strategy": row.conflict_strategy,
			"title_field": meta.title_field or "name",
			"fields": fields,
		})

	return {"enabled": True, "doctypes": doctypes}


@frappe.whitelist()
def get_offline_data(doctype: str, last_sync: str = None):
	"""Fetch documents modified since last sync for offline storage.

	Args:
		doctype: The DocType to sync
		last_sync: ISO timestamp of last successful sync (None = full sync)

	Returns:
		dict with 'records' list and 'sync_timestamp'
	"""
	# Validate that this doctype is configured for offline access
	settings = frappe.get_single("PWA Settings")
	offline_config = None

	for row in settings.offline_doctypes:
		if row.doctype_name == doctype:
			offline_config = row
			break

	if not offline_config:
		frappe.throw(_("{0} is not configured for offline access").format(doctype))

	max_records = offline_config.max_records or 100

	filters = {}
	if last_sync:
		filters["modified"] = (">", last_sync)

	records = frappe.get_list(
		doctype,
		filters=filters,
		fields=["*"],
		limit_page_length=max_records,
		order_by="modified desc",
	)

	# Also get deleted records since last sync (for bidirectional sync)
	deleted = []
	if last_sync and offline_config.sync_direction == "bidirectional":
		deleted = frappe.get_all(
			"Deleted Document",
			filters={
				"deleted_doctype": doctype,
				"deleted_datetime": (">", last_sync),
			},
			fields=["deleted_name"],
			pluck="deleted_name",
		)

	return {
		"records": records,
		"deleted": deleted,
		"sync_timestamp": frappe.utils.now_datetime().isoformat(),
	}


@frappe.whitelist()
def push_offline_changes(changes: str):
	"""Receive and apply queued offline mutations.

	Args:
		changes: JSON string with list of changes:
			[{
				"action": "create" | "update" | "delete",
				"doctype": "...",
				"docname": "...",
				"data": {...},  # for create/update
				"client_modified": "ISO timestamp"
			}]

	Returns:
		dict with 'applied', 'conflicts', 'errors' lists
	"""
	changes_list = json.loads(changes)
	applied = []
	conflicts = []
	errors = []

	for change in changes_list:
		try:
			result = _apply_single_change(change)
			if result.get("conflict"):
				conflicts.append(result)
			else:
				applied.append(result)
		except Exception as e:
			errors.append({
				"change": change,
				"error": str(e),
			})

	frappe.db.commit()

	return {
		"applied": applied,
		"conflicts": conflicts,
		"errors": errors,
	}


def _apply_single_change(change: dict) -> dict:
	"""Apply a single offline change.

	Returns dict with status or conflict info.
	"""
	action = change.get("action")
	doctype = change.get("doctype")
	docname = change.get("docname")
	data = change.get("data", {})
	client_modified = change.get("client_modified")

	# Get conflict strategy for this doctype
	settings = frappe.get_single("PWA Settings")
	conflict_strategy = "server-wins"

	for row in settings.offline_doctypes:
		if row.doctype_name == doctype:
			conflict_strategy = row.conflict_strategy
			if row.sync_direction == "download-only":
				return {
					"action": action,
					"doctype": doctype,
					"docname": docname,
					"error": "This doctype is configured for download-only sync",
				}
			break

	if action == "create":
		doc = frappe.new_doc(doctype)
		doc.update(data)
		doc.insert()
		return {
			"action": "create",
			"doctype": doctype,
			"docname": doc.name,
			"status": "applied",
		}

	elif action == "update":
		if not frappe.db.exists(doctype, docname):
			return {
				"action": "update",
				"doctype": doctype,
				"docname": docname,
				"error": "Document not found",
			}

		doc = frappe.get_doc(doctype, docname)

		# Check for conflicts
		if client_modified and doc.modified and str(doc.modified) > client_modified:
			if conflict_strategy == "server-wins":
				return {
					"action": "update",
					"doctype": doctype,
					"docname": docname,
					"status": "skipped",
					"reason": "server-wins: server version is newer",
				}
			elif conflict_strategy == "manual":
				return {
					"action": "update",
					"doctype": doctype,
					"docname": docname,
					"conflict": True,
					"server_data": doc.as_dict(),
					"client_data": data,
					"server_modified": str(doc.modified),
					"client_modified": client_modified,
				}
			# else client-wins: proceed with update

		doc.update(data)
		doc.save()
		return {
			"action": "update",
			"doctype": doctype,
			"docname": docname,
			"status": "applied",
		}

	elif action == "delete":
		if frappe.db.exists(doctype, docname):
			frappe.delete_doc(doctype, docname)
		return {
			"action": "delete",
			"doctype": doctype,
			"docname": docname,
			"status": "applied",
		}

	return {"error": f"Unknown action: {action}"}
